import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";
import { CommentVisibility, DeliverableType, EditCause, NotificationCategory, NotificationType, TaskStatus } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";

export type TaskWorkflowActionState = {
  error?: string;
  success?: string;
};

async function requestTaskEditServerImplementation(input: {
  taskId: string;
  cause: EditCause;
  description: string;
}): Promise<TaskWorkflowActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const { taskId, cause, description } = input;
  if (!taskId || !description?.trim()) {
    return { error: "Please provide a detailed description of what needs to be edited." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        project: {
          include: {
            collaborators: true,
          },
        },
        assignees: {
          select: { userId: true },
        },
      },
    });

    if (!task) return { error: "Task not found." };

    const isManager = task.project.managerId === session.user.id;
    const isPrimaryClient = task.project.clientId === session.user.id;
    const isCollaborator = task.project.collaborators.some((c) => c.userId === session.user.id);

    if (!isManager && !isPrimaryClient && !isCollaborator) {
      return { error: "Only project clients and managers can request revisions." };
    }

    await prisma.$transaction(async (tx) => {
      // 1. Create the revision record
      await tx.taskRevision.create({
        data: {
          taskId,
          cause,
          description: description.trim(),
          requestedById: session.user.id,
        },
      });

      // 2. Update task status to TO_EDIT
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.TO_EDIT,
          completedAt: null,
        },
      });

      // 3. Update assignees status so workers see it requires attention
      await tx.taskAssignee.updateMany({
        where: { taskId },
        data: {
          status: TaskStatus.TO_EDIT,
          managerNote: `Revision requested (${cause === EditCause.REQUIREMENT_ADJUSTMENT ? "Requirement Adjustment" : "Quality Issue"}): ${description.trim().slice(0, 150)}`,
        },
      });
    });

    // 4. Notify workers and manager
    const recipientIds = new Set<string>();
    if (task.project.managerId !== session.user.id) {
      recipientIds.add(task.project.managerId);
    }
    for (const assignee of task.assignees) {
      if (assignee.userId !== session.user.id) {
        recipientIds.add(assignee.userId);
      }
    }

    const causeLabel =
      cause === EditCause.REQUIREMENT_ADJUSTMENT ? "Requirement Adjustment" : "Quality Issue";

    for (const recipientId of recipientIds) {
      await createNotification({
        userId: recipientId,
        actorId: session.user.id,
        type: NotificationType.TASK_RETURNED,
        category: NotificationCategory.ACTION_REQUIRED,
        title: `Revision requested: ${task.title}`,
        message: `Cause: ${causeLabel}. "${description.trim().slice(0, 100)}"`,
        link: `/manager/tasks?taskId=${task.id}`,
        projectId: task.projectId,
      });
    }

    return { success: "Revision request submitted to the team." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to request revision." };
  }
}

async function submitTaskRatingServerImplementation(input: {
  taskId: string;
  score: number;
  feedback?: string;
}): Promise<TaskWorkflowActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const { taskId, score, feedback } = input;
  if (!taskId || score < 1 || score > 5) {
    return { error: "Please provide a rating between 1 and 5 stars." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        project: {
          include: {
            collaborators: true,
          },
        },
        assignees: {
          select: { userId: true },
        },
      },
    });

    if (!task) return { error: "Task not found." };

    const isManager = task.project.managerId === session.user.id;
    const isPrimaryClient = task.project.clientId === session.user.id;
    const isCollaborator = task.project.collaborators.some((c) => c.userId === session.user.id);

    if (!isManager && !isPrimaryClient && !isCollaborator) {
      return { error: "Only project participants can rate this task." };
    }

    await prisma.rating.upsert({
      where: {
        clientId_taskId: {
          clientId: session.user.id,
          taskId,
        },
      },
      create: {
        score,
        feedback: feedback?.trim() || null,
        clientId: session.user.id,
        projectId: task.projectId,
        taskId,
      },
      update: {
        score,
        feedback: feedback?.trim() || null,
      },
    });

    // Notify assigned workers and manager
    const recipientIds = new Set<string>();
    if (task.project.managerId !== session.user.id) {
      recipientIds.add(task.project.managerId);
    }
    for (const assignee of task.assignees) {
      if (assignee.userId !== session.user.id) {
        recipientIds.add(assignee.userId);
      }
    }

    for (const recipientId of recipientIds) {
      await createNotification({
        userId: recipientId,
        actorId: session.user.id,
        type: NotificationType.SYSTEM_ALERT,
        category: NotificationCategory.UPDATE,
        title: `Task Rated: ${task.title} (${score} ★)`,
        message: feedback ? `"${feedback.trim().slice(0, 100)}"` : `Client rated this task ${score} out of 5 stars.`,
        link: `/manager/tasks?taskId=${task.id}`,
        projectId: task.projectId,
      });
    }

    return { success: `Thank you for rating! (${score} ★)` };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to submit rating." };
  }
}

async function addTaskCommentServerImplementation(input: {
  taskId: string;
  body: string;
}): Promise<TaskWorkflowActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const { taskId, body } = input;
  if (!taskId || !body?.trim()) {
    return { error: "Comment text cannot be empty." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        project: {
          include: {
            collaborators: true,
          },
        },
        assignees: {
          select: { userId: true },
        },
      },
    });

    if (!task) return { error: "Task not found." };

    const isManager = task.project.managerId === session.user.id;
    const isPrimaryClient = task.project.clientId === session.user.id;
    const isCollaborator = task.project.collaborators.some((c) => c.userId === session.user.id);
    const isAssignee = task.assignees.some((a) => a.userId === session.user.id);

    if (!isManager && !isPrimaryClient && !isCollaborator && !isAssignee) {
      return { error: "Permission denied." };
    }

    await prisma.comment.create({
      data: {
        body: body.trim(),
        visibility: CommentVisibility.CLIENT_VISIBLE,
        authorId: session.user.id,
        projectId: task.projectId,
        taskId,
      },
    });

    // Notify other participants
    const recipientIds = new Set<string>();
    if (task.project.managerId !== session.user.id) {
      recipientIds.add(task.project.managerId);
    }
    if (task.project.clientId !== session.user.id) {
      recipientIds.add(task.project.clientId);
    }
    for (const c of task.project.collaborators) {
      if (c.userId !== session.user.id) recipientIds.add(c.userId);
    }
    for (const a of task.assignees) {
      if (a.userId !== session.user.id) recipientIds.add(a.userId);
    }

    for (const recipientId of recipientIds) {
      await createNotification({
        userId: recipientId,
        actorId: session.user.id,
        type: NotificationType.SYSTEM_ALERT,
        category: NotificationCategory.UPDATE,
        title: `New comment on: ${task.title}`,
        message: `${session.user.name || "A team member"}: "${body.trim().slice(0, 80)}"`,
        link: `/manager/tasks?taskId=${task.id}`,
        projectId: task.projectId,
      });
    }

    return { success: "Comment posted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to post comment." };
  }
}

async function uploadTaskDeliverableServerImplementation(input: {
  taskId: string;
  name: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
  type?: DeliverableType;
}): Promise<TaskWorkflowActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  const { taskId, name, fileUrl, fileSize, mimeType, type = DeliverableType.OUTPUT } = input;
  if (!taskId || !name || !fileUrl) {
    return { error: "Missing required file details." };
  }

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId, deletedAt: null },
      include: {
        project: {
          include: {
            collaborators: true,
          },
        },
      },
    });

    if (!task) return { error: "Task not found." };

    await prisma.taskDeliverable.create({
      data: {
        taskId,
        name: name.trim(),
        fileUrl: fileUrl.trim(),
        fileSize: fileSize || null,
        mimeType: mimeType || null,
        type,
        uploadedById: session.user.id,
      },
    });

    // If output deliverable, notify clients and manager
    if (type === DeliverableType.OUTPUT) {
      const recipientIds = new Set<string>();
      if (task.project.clientId !== session.user.id) {
        recipientIds.add(task.project.clientId);
      }
      for (const c of task.project.collaborators) {
        if (c.userId !== session.user.id) recipientIds.add(c.userId);
      }
      if (task.project.managerId !== session.user.id) {
        recipientIds.add(task.project.managerId);
      }

      for (const recipientId of recipientIds) {
        await createNotification({
          userId: recipientId,
          actorId: session.user.id,
          type: NotificationType.TASK_REVIEW_READY,
          category: NotificationCategory.ACTION_REQUIRED,
          title: `Deliverable ready for: ${task.title}`,
          message: `A new file "${name}" has been uploaded and is ready for your review.`,
          link: `/client/projects/${task.projectId}`,
          projectId: task.projectId,
        });
      }
    }

    return { success: "File uploaded successfully." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to save deliverable." };
  }
}

async function deleteTaskDeliverableServerImplementation(
  deliverableId: string
): Promise<TaskWorkflowActionState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Unauthorized." };

  try {
    const deliverable = await prisma.taskDeliverable.findUnique({
      where: { id: deliverableId },
      include: {
        task: {
          include: {
            project: true,
          },
        },
      },
    });

    if (!deliverable) return { error: "File not found." };

    const isUploader = deliverable.uploadedById === session.user.id;
    const isManager = deliverable.task.project.managerId === session.user.id;

    if (!isUploader && !isManager) {
      return { error: "Permission denied." };
    }

    await prisma.taskDeliverable.delete({
      where: { id: deliverableId },
    });

    return { success: "File deleted." };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Failed to delete file." };
  }
}



const requestTaskEditServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof requestTaskEditServerImplementation>>) => args)
  .handler(async ({ data }) => requestTaskEditServerImplementation(...decodeActionArguments<Parameters<typeof requestTaskEditServerImplementation>>(data)));
export const requestTaskEdit = async (...args: Parameters<typeof requestTaskEditServerImplementation>) => requestTaskEditServerFunction({ data: await encodeActionArguments(args) });

const submitTaskRatingServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof submitTaskRatingServerImplementation>>) => args)
  .handler(async ({ data }) => submitTaskRatingServerImplementation(...decodeActionArguments<Parameters<typeof submitTaskRatingServerImplementation>>(data)));
export const submitTaskRating = async (...args: Parameters<typeof submitTaskRatingServerImplementation>) => submitTaskRatingServerFunction({ data: await encodeActionArguments(args) });

const addTaskCommentServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof addTaskCommentServerImplementation>>) => args)
  .handler(async ({ data }) => addTaskCommentServerImplementation(...decodeActionArguments<Parameters<typeof addTaskCommentServerImplementation>>(data)));
export const addTaskComment = async (...args: Parameters<typeof addTaskCommentServerImplementation>) => addTaskCommentServerFunction({ data: await encodeActionArguments(args) });

const uploadTaskDeliverableServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof uploadTaskDeliverableServerImplementation>>) => args)
  .handler(async ({ data }) => uploadTaskDeliverableServerImplementation(...decodeActionArguments<Parameters<typeof uploadTaskDeliverableServerImplementation>>(data)));
export const uploadTaskDeliverable = async (...args: Parameters<typeof uploadTaskDeliverableServerImplementation>) => uploadTaskDeliverableServerFunction({ data: await encodeActionArguments(args) });


const deleteTaskDeliverableServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof deleteTaskDeliverableServerImplementation>>) => args)
  .handler(async ({ data }) => deleteTaskDeliverableServerImplementation(...decodeActionArguments<Parameters<typeof deleteTaskDeliverableServerImplementation>>(data)));
export const deleteTaskDeliverable = async (...args: Parameters<typeof deleteTaskDeliverableServerImplementation>) => deleteTaskDeliverableServerFunction({ data: await encodeActionArguments(args) });
