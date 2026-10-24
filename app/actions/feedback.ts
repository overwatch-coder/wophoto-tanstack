"use server"

import { revalidatePath } from "next/cache"
import {
  FeedbackStatus,
  FeedbackType,
  NotificationType,
  TaskStatus,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { prisma } from "@/lib/prisma"
import { createNotification } from "@/lib/notifications"
import { notificationActionLink } from "@/lib/notification-links"
import { InputValidationError, parseInput } from "@/lib/validation/common"
import {
  createClientFeedbackSchema,
  deleteFeedbackSchema,
  feedbackDelegationSchema,
  feedbackResolutionSchema,
  updateClientFeedbackSchema,
  workerRevisionSchema,
} from "@/lib/validation/feedback"

export type FeedbackActionState = {
  error?: string
  success?: string
  createdId?: string
}

class FeedbackValidationError extends Error {}
const feedbackError = (error: unknown, fallback: string) =>
  error instanceof FeedbackValidationError || error instanceof InputValidationError
    ? error.message
    : fallback

export async function createClientFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const { projectId, taskId, type, score: scoreRaw, title: submittedTitle, details } = parseInput(createClientFeedbackSchema, {
      projectId: String(formData.get("projectId") ?? "").trim(),
      taskId: formData.get("taskId") ? String(formData.get("taskId")).trim() : "",
      type: formData.get("type") ? String(formData.get("type")).trim() : "REVISION",
      score: formData.get("score"),
      title: String(formData.get("title") ?? "").trim(),
      details: String(formData.get("details") ?? "").trim(),
    })
    const title = type === FeedbackType.REVIEW ? "Project review" : submittedTitle
    const score = type === FeedbackType.REVIEW ? scoreRaw! : null

    // Verify project belongs to this client
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        clientId: client.id,
      },
      select: { id: true, managerId: true, name: true },
    })

    if (!project) {
      throw new FeedbackValidationError(
        "This project is not accessible to your client account."
      )
    }

    // If taskId is provided, verify it belongs to this project
    if (taskId) {
      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          projectId: project.id,
          deletedAt: null,
        },
        select: { id: true },
      })

      if (!task) {
        throw new FeedbackValidationError(
          "Selected deliverable is not valid for this project."
        )
      }
    }

    const created = await prisma.clientFeedback.create({
      data: {
        projectId: project.id,
        taskId: taskId || null,
        clientId: client.id,
        type,
        status: FeedbackStatus.NEW,
        score,
        title,
        details,
      },
    })

    // Notify project manager of new feedback / revision request
    if (project?.managerId) {
      try {
        await createNotification({
          userId: project.managerId,
          actorId: client.id,
          type: NotificationType.FEEDBACK_RECEIVED,
          title: type === FeedbackType.REVISION ? "New Client Revision Request" : "New Client Review",
          message: `${client.name || "Client"} submitted ${type.toLowerCase()}: "${title}"`,
          link: notificationActionLink({ kind: "feedback", role: "MANAGER", id: created.id }),
          projectId: project.id,
          taskId: taskId || null,
          sendEmail: true,
          emailSubject: `New ${type === FeedbackType.REVISION ? "Revision Request" : "Review"}: ${project.name}`,
        })
      } catch (notifErr) {
        console.warn("[feedback] Failed to dispatch notification:", notifErr)
      }
    }

    revalidatePath("/client/project-feedback")
    revalidatePath("/manager/reviews")
    revalidatePath("/client")

    return {
      success:
        type === FeedbackType.REVIEW
          ? "Review submitted successfully."
          : "Request submitted successfully to the studio team.",
      createdId: created.id,
    }
  } catch (error) {
    if (!(error instanceof FeedbackValidationError)) {
      console.error("Client feedback submission failed:", error)
    }

    return {
      error: feedbackError(error, "Could not submit your request. Please try again."),
    }
  }
}

export async function resolveFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const manager = await requireRole(UserRole.MANAGER)

  try {
    const { feedbackId, responseNote } = parseInput(feedbackResolutionSchema, {
      feedbackId: formData.get("feedbackId"),
      responseNote: formData.get("responseNote") ?? "",
    })

    // Verify feedback belongs to a project managed by this manager
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        project: {
          managerId: manager.id,
        },
      },
      select: { id: true, taskId: true, type: true, title: true, projectId: true, clientId: true },
    })

    if (!feedback) {
      throw new FeedbackValidationError(
        "You do not have permission to resolve this feedback."
      )
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews do not require a resolution action.")
    }

    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.RESOLVED,
        responseNote,
        respondedAt: new Date(),
        respondedById: manager.id,
      },
    })

    // If linked to a task, mark as completed
    if (feedback.taskId) {
      await prisma.taskAssignee.updateMany({
        where: { taskId: feedback.taskId },
        data: { status: TaskStatus.COMPLETED },
      })
      await prisma.task.update({
        where: { id: feedback.taskId },
        data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
      })
    }

    // Notify client that their feedback/revision has been resolved
    if (feedback?.clientId) {
      try {
        await createNotification({
          userId: feedback.clientId,
          actorId: manager.id,
          type: NotificationType.FEEDBACK_RESOLVED,
          title: "Feedback Ticket Resolved",
          message: `Studio lead recorded resolution: "${responseNote.slice(0, 120)}"`,
          link: notificationActionLink({ kind: "feedback", role: "CLIENT", id: feedback.id }),
          projectId: feedback.projectId,
          taskId: feedback.taskId || null,
          sendEmail: true,
          emailSubject: `Resolved: ${feedback.title}`,
        })
      } catch (notifErr) {
        console.warn("[feedback] Failed to dispatch resolution notification:", notifErr)
      }
    }

    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/reviews")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")
    revalidatePath("/client")

    return {
      success: "Resolution note recorded and ticket marked as resolved.",
    }
  } catch (error) {
    return {
      error: feedbackError(error, "Could not resolve the feedback item. Please try again."),
    }
  }
}

export async function delegateFeedbackToWorker(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const manager = await requireRole(UserRole.MANAGER)

  try {
    const { feedbackId, workerId, delegationNote } = parseInput(feedbackDelegationSchema, {
      feedbackId: formData.get("feedbackId"),
      workerId: formData.get("workerId"),
      delegationNote: formData.get("delegationNote") ?? "",
    })

    // Verify feedback belongs to a project managed by this manager
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        project: {
          managerId: manager.id,
        },
      },
      select: {
        id: true,
        type: true,
        taskId: true,
        projectId: true,
        title: true,
        details: true,
        project: { select: { name: true } },
      },
    })

    if (!feedback) {
      throw new FeedbackValidationError("You do not have permission to delegate this feedback.")
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews cannot be delegated to workers.")
    }

    // Verify worker exists and is active
    const worker = await prisma.user.findFirst({
      where: {
        id: workerId,
        role: UserRole.WORKER,
        status: UserStatus.ACTIVE,
      },
      select: { id: true, name: true },
    })

    if (!worker) {
      throw new FeedbackValidationError("The selected worker is not available.")
    }

    // If feedback is linked to a task, update task and assignee
    if (feedback.taskId) {
      const existingAssignee = await prisma.taskAssignee.findUnique({
        where: {
          taskId_userId: {
            taskId: feedback.taskId,
            userId: worker.id,
          },
        },
      })

      if (existingAssignee) {
        await prisma.taskAssignee.update({
          where: {
            taskId_userId: {
              taskId: feedback.taskId,
              userId: worker.id,
            },
          },
          data: {
            status: TaskStatus.IN_PROGRESS,
            submittedAt: null,
            managerNote: delegationNote,
          },
        })
      } else {
        await prisma.taskAssignee.create({
          data: {
            taskId: feedback.taskId,
            userId: worker.id,
            status: TaskStatus.IN_PROGRESS,
            managerNote: delegationNote,
          },
        })
      }

      await prisma.task.update({
        where: { id: feedback.taskId },
        data: {
          status: TaskStatus.IN_PROGRESS,
          completedAt: null,
        },
      })
    }

    // Update feedback record
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.ASSIGNED_TO_WORKER,
        assignedWorkerId: worker.id,
        delegationNote,
        delegatedAt: new Date(),
        workerNote: null,
        workerSubmittedAt: null,
      },
    })

    // Notify assigned worker of delegated revision
    try {
      await createNotification({
        userId: worker.id,
        actorId: manager.id,
        type: NotificationType.REVISION_DELEGATED,
        title: "Revision Delegated to You",
        message: `Manager delegated revision on "${feedback.title}": "${delegationNote.slice(0, 120)}"`,
        link: notificationActionLink({ kind: "feedback", role: "WORKER", id: feedback.id }),
        projectId: feedback.projectId,
        taskId: feedback.taskId || null,
        sendEmail: true,
        emailSubject: `Action Required: Revision Delegated for ${feedback.project?.name ?? "Project"}`,
      })
    } catch (notifErr) {
      console.warn("[feedback] Failed to dispatch delegation notification:", notifErr)
    }

    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/reviews")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")

    return {
      success: `Revision delegated to ${worker.name || "worker"}.`,
    }
  } catch (error) {
    return {
      error: feedbackError(error, "Could not delegate this feedback. Please try again."),
    }
  }
}

export async function submitWorkerRevision(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const worker = await requireRole(UserRole.WORKER)

  try {
    const { feedbackId, workerNote } = parseInput(workerRevisionSchema, {
      feedbackId: formData.get("feedbackId"),
      workerNote: formData.get("workerNote") ?? "",
    })

    // Verify feedback is assigned to this worker
    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        assignedWorkerId: worker.id,
      },
      select: {
        id: true,
        type: true,
        taskId: true,
        title: true,
        projectId: true,
        project: { select: { name: true, managerId: true } },
      },
    })

    if (!feedback) {
      throw new FeedbackValidationError("You do not have permission to submit revisions for this feedback.")
    }

    if (feedback.type === FeedbackType.REVIEW) {
      throw new FeedbackValidationError("Client reviews do not have a worker revision workflow.")
    }

    // If feedback is linked to a task, update the task assignee status to IN_REVIEW
    if (feedback.taskId) {
      await prisma.taskAssignee.updateMany({
        where: {
          taskId: feedback.taskId,
          userId: worker.id,
        },
        data: {
          status: TaskStatus.IN_REVIEW,
          submittedAt: new Date(),
        },
      })

      await prisma.task.update({
        where: { id: feedback.taskId },
        data: {
          status: TaskStatus.IN_REVIEW,
        },
      })
    }

    // Update feedback status to IN_REVIEW
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        status: FeedbackStatus.IN_REVIEW,
        workerNote,
        workerSubmittedAt: new Date(),
      },
    })

    // Notify project manager that worker submitted revision
    if (feedback.project?.managerId) {
      try {
        await createNotification({
          userId: feedback.project.managerId,
          actorId: worker.id,
          type: NotificationType.REVISION_SUBMITTED,
          title: "Worker Revision Ready for Review",
          message: `${worker.name || "Worker"} completed revision on "${feedback.title}": "${workerNote.slice(0, 120)}"`,
          link: notificationActionLink({ kind: "feedback", role: "MANAGER", id: feedback.id }),
          projectId: feedback.projectId,
          taskId: feedback.taskId || null,
          sendEmail: true,
          emailSubject: `Revision Submitted: ${feedback.project?.name ?? "Project"}`,
        })
      } catch (notifErr) {
        console.warn("[feedback] Failed to dispatch revision submission notification:", notifErr)
      }
    }

    revalidatePath("/worker/reviews")
    revalidatePath("/manager/reviews")
    revalidatePath("/client/project-feedback")
    revalidatePath("/worker/tasks")
    revalidatePath("/manager/tasks")

    return {
      success: "Revisions submitted to manager for review.",
    }
  } catch (error) {
    return {
      error: feedbackError(error, "Could not submit your revision. Please try again."),
    }
  }
}

export async function updateClientFeedback(
  _previousState: FeedbackActionState,
  formData: FormData
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const { feedbackId, projectId, taskId, type, score: scoreRaw, title: submittedTitle, details } = parseInput(updateClientFeedbackSchema, {
      feedbackId: String(formData.get("feedbackId") ?? "").trim(),
      projectId: String(formData.get("projectId") ?? "").trim(),
      taskId: formData.get("taskId") ? String(formData.get("taskId")).trim() : "",
      type: formData.get("type") ? String(formData.get("type")).trim() : "REVISION",
      score: formData.get("score"),
      title: String(formData.get("title") ?? "").trim(),
      details: String(formData.get("details") ?? "").trim(),
    })
    const title = type === FeedbackType.REVIEW ? "Project review" : submittedTitle

    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id: feedbackId,
        clientId: client.id,
        status: FeedbackStatus.NEW,
      },
      select: { id: true },
    })
    if (!feedback) {
      throw new FeedbackValidationError("Only new requests can be edited.")
    }

    const project = await prisma.project.findFirst({
      where: { id: projectId, clientId: client.id },
      select: { id: true, managerId: true, name: true },
    })
    if (!project) {
      throw new FeedbackValidationError(
        "This project is not accessible to your client account."
      )
    }

    if (taskId) {
      const task = await prisma.task.findFirst({
        where: { id: taskId, projectId: project.id, deletedAt: null },
        select: { id: true },
      })
      if (!task) {
        throw new FeedbackValidationError(
          "Selected deliverable is not valid for this project."
        )
      }
    }

    const score = type === FeedbackType.REVIEW ? scoreRaw! : null
    await prisma.clientFeedback.update({
      where: { id: feedback.id },
      data: {
        projectId: project.id,
        taskId,
        type,
        score,
        title,
        details,
      },
    })

    // Notify project manager of new feedback / revision request
    if (project?.managerId) {
      try {
        await createNotification({
          userId: project.managerId,
          actorId: client.id,
          type: NotificationType.FEEDBACK_RECEIVED,
          title: type === FeedbackType.REVISION ? "New Client Revision Request" : "New Client Review",
          message: `${client.name || "Client"} submitted ${type.toLowerCase()}: "${title}"`,
          link: notificationActionLink({ kind: "feedback", role: "MANAGER", id: feedback.id }),
          projectId: project.id,
          taskId: taskId || null,
          sendEmail: true,
          emailSubject: `New ${type === FeedbackType.REVISION ? "Revision Request" : "Review"}: ${project.name}`,
        })
      } catch (notifErr) {
        console.warn("[feedback] Failed to dispatch notification:", notifErr)
      }
    }

    revalidatePath("/client/project-feedback")
    revalidatePath("/client")
    return {
      success: type === FeedbackType.REVIEW
        ? "Review updated."
        : "Feedback request updated.",
    }
  } catch (error) {
    return {
      error: feedbackError(error, "Could not update your request. Please try again."),
    }
  }
}

export async function deleteClientFeedback(
  feedbackId: string
): Promise<FeedbackActionState> {
  const client = await requireRole(UserRole.CLIENT)

  try {
    const id = parseInput(deleteFeedbackSchema, feedbackId)

    const feedback = await prisma.clientFeedback.findFirst({
      where: {
        id,
        clientId: client.id,
        status: FeedbackStatus.NEW,
      },
      select: { id: true },
    })
    if (!feedback) {
      throw new FeedbackValidationError("Only new requests can be deleted.")
    }

    await prisma.clientFeedback.delete({ where: { id: feedback.id } })
    revalidatePath("/client/project-feedback")
    revalidatePath("/client")
    revalidatePath("/manager/reviews")
    return { success: "Feedback request deleted." }
  } catch (error) {
    return {
      error: feedbackError(error, "Could not delete this request. Please try again."),
    }
  }
}
