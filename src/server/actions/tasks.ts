import { createServerFn } from "@tanstack/react-start";
import { decodeActionArguments, encodeActionArguments, type EncodedActionArguments } from "@/lib/server-action-args";

import { NotificationCategory, Prisma, NotificationType, StudioArea, TaskStatus, TaskType, UserRole, UserStatus, WorkRequestStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { requireStudioManagerArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { createNotification, createStudioAreaNotification } from "@/lib/notifications";
import { notificationActionLink } from "@/lib/notification-links";
import { parseInput } from "@/lib/validation/common";
import {
  assignmentStatusSchema,
  createAssignedTaskSchema,
  dailyEntrySchema,
  restoreTaskIdsSchema,
  reviewTaskSchema,
  taskIdSchema,
  taskStatusSchema,
  updateAssignedTaskSchema,
  updateDailyEntrySchema,
} from "@/lib/validation/tasks";

export type TaskActionState = { error?: string; success?: string; taskId?: string };
const message = (error: unknown) => error instanceof Error ? error.message : "The task could not be saved. Try again.";
const formString = (data: FormData, key: string) => data.get(key) ?? "";
const taskFormFields = (data: FormData) => ({
  title: formString(data, "title"),
  description: formString(data, "description"),
  priority: formString(data, "priority"),
  startAt: formString(data, "startAt"),
  dueAt: formString(data, "dueAt"),
});
const stringList = (data: FormData, key: string) => data.getAll(key);
const validId = (s: string) => taskIdSchema.safeParse(s).success;
const checkWorkers = async (workerIds: string[]) => {
  if (!workerIds.length || workerIds.length > 50 || workerIds.some((id) => !validId(id))) throw new Error("Choose at least one worker.");
  const unique = [...new Set(workerIds)];
  const workers = await prisma.user.findMany({ where: { id: { in: unique }, role: UserRole.WORKER, status: UserStatus.ACTIVE }, select: { id: true } });
  if (workers.length !== unique.length) throw new Error("One or more selected workers are unavailable.");
  return unique;
};
async function lockTask(tx: Prisma.TransactionClient, taskId: string) {
  await tx.$queryRaw`SELECT "id" FROM "Task" WHERE "id" = ${taskId} FOR UPDATE`;
}
async function recompute(tx: Prisma.TransactionClient, taskId: string) {
  const states = await tx.taskAssignee.findMany({ where: { taskId }, select: { status: true } });
  const status = states.length && states.every((s) => s.status === TaskStatus.TODO)
    ? TaskStatus.TODO
    : states.length && states.every((s) => s.status === TaskStatus.IN_REVIEW)
      ? TaskStatus.IN_REVIEW : TaskStatus.IN_PROGRESS;
  await tx.task.update({ where: { id: taskId }, data: { status, completedAt: null } });
}
const invalidateTasks = () => (() => {})();

async function createAssignedTaskServerImplementation(_state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const { manager, context } = await requireStudioManagerArea(StudioArea.TASKS);
    const input = parseInput(createAssignedTaskSchema, {
      projectId: formString(data, "projectId"),
      ...taskFormFields(data),
      workerIds: stringList(data, "workerId"),
      serviceIds: stringList(data, "serviceId"),
    });
    const { projectId, workerIds: requestedWorkerIds, serviceIds, ...fields } = input;
    const workerIds = await checkWorkers(requestedWorkerIds);
    const project = await prisma.project.findFirst({ where: { id: projectId, managerId: manager.id }, select: { id: true } });
    if (!project) throw new Error("That project is not available to you.");
    const validServices = await prisma.studioService.findMany({ where: { id: { in: serviceIds }, studioId: context.studioId, isActive: true }, select: { id: true } });
    if (validServices.length !== serviceIds.length) throw new Error("One or more selected services are no longer available.");
    const task = await prisma.task.create({ data: { ...fields, projectId, createdById: manager.actorId, type: TaskType.ASSIGNED, assignees: { create: workerIds.map((userId) => ({ userId })) }, services: { create: serviceIds.map((serviceId) => ({ service: { connect: { id: serviceId } } })) } }, select: { id: true } });

    // Notify assigned workers
    try {
      await Promise.all(
        workerIds.map((userId) =>
          createNotification({
            userId,
            actorId: manager.actorId,
            type: NotificationType.TASK_ASSIGNED,
            title: "New Task Assigned",
            message: `You were assigned to "${fields.title}"`,
            link: notificationActionLink({ kind: "task", role: "WORKER", id: task.id }),
            projectId,
            taskId: task.id,
            sendEmail: true,
          })
        )
      );
    } catch (notifErr) {
      console.warn("[tasks] Failed to notify workers of assignment:", notifErr);
    }

    invalidateTasks();
    return { success: "Task created.", taskId: task.id };
  } catch (error) { return { error: message(error) }; }
}

async function updateAssignedTaskServerImplementation(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const { manager, context } = await requireStudioManagerArea(StudioArea.TASKS);
    const input = parseInput(updateAssignedTaskSchema, {
      taskId,
      ...taskFormFields(data),
      workerIds: stringList(data, "workerId"),
      serviceIds: stringList(data, "serviceId"),
    });
    const { taskId: validatedTaskId, workerIds: requestedWorkerIds, serviceIds, ...fields } = input;
    const workerIds = await checkWorkers(requestedWorkerIds);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, validatedTaskId);
      const task = await tx.task.findFirst({ where: { id: validatedTaskId, deletedAt: null, type: TaskType.ASSIGNED, status: { not: TaskStatus.COMPLETED }, project: { managerId: manager.id } }, select: { id: true, assignees: { select: { userId: true } } } });
      if (!task) throw new Error("This task cannot be edited.");
      const validServices = await tx.studioService.findMany({ where: { id: { in: serviceIds }, studioId: context.studioId, isActive: true }, select: { id: true } });
      if (validServices.length !== serviceIds.length) throw new Error("One or more selected services are no longer available.");
      const add = workerIds.filter((id) => !task.assignees.some((a) => a.userId === id));
      const remove = task.assignees.map((a) => a.userId).filter((id) => !workerIds.includes(id));
      const activeServices = await tx.studioService.findMany({ where: { studioId: context.studioId, isActive: true }, select: { id: true } });
      await tx.taskService.deleteMany({ where: { taskId: validatedTaskId, serviceId: { in: activeServices.map((service) => service.id) } } });
      await tx.task.update({ where: { id: validatedTaskId }, data: { ...fields, services: { create: serviceIds.map((serviceId) => ({ service: { connect: { id: serviceId } } })) } } });
      if (remove.length) await tx.taskAssignee.deleteMany({ where: { taskId: validatedTaskId, userId: { in: remove } } });
      if (add.length) await tx.taskAssignee.createMany({ data: add.map((userId) => ({ taskId: validatedTaskId, userId })) });
      await recompute(tx, validatedTaskId);
    });

    invalidateTasks();
    return { success: "Task updated.", taskId: validatedTaskId };
  } catch (error) { return { error: message(error) }; }
}

async function createDailyEntryServerImplementation(_state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    const input = parseInput(dailyEntrySchema, {
      projectId: formString(data, "projectId"),
      ...taskFormFields(data),
      workDate: formString(data, "workDate"),
    });
    const { projectId, workDate: submittedWorkDate, ...fields } = input;
    const workDate = submittedWorkDate ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    if (workDate > new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))) throw new Error("Work date cannot be in the future.");
    const eligible = await prisma.project.findFirst({ where: { id: projectId, tasks: { some: { type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: worker.id } } } } }, select: { id: true } });
    if (!eligible) throw new Error("Choose a project where you have assigned work.");
    const task = await prisma.task.create({ data: { title: fields.title, description: fields.description, priority: fields.priority, projectId, createdById: worker.id, type: TaskType.DAILY_ENTRY, workDate, assignees: { create: { userId: worker.id } } }, select: { id: true } });
    invalidateTasks();
    return { success: "Daily entry created.", taskId: task.id };
  } catch (error) { return { error: message(error) }; }
}

async function updateDailyEntryServerImplementation(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    const input = parseInput(updateDailyEntrySchema, {
      taskId,
      ...taskFormFields(data),
      workDate: formString(data, "workDate"),
    });
    const { taskId: validatedTaskId, workDate, ...fields } = input;
    if (workDate > new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))) throw new Error("Choose today or a past work date.");
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, validatedTaskId);
      const task = await tx.task.findFirst({ where: { id: validatedTaskId, type: TaskType.DAILY_ENTRY, deletedAt: null, assignees: { some: { userId: worker.id, status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] } } } }, select: { id: true, projectId: true } });
      if (!task) throw new Error("This daily entry is locked or unavailable.");
      const eligible = await tx.task.findFirst({ where: { projectId: task.projectId, type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: worker.id } } }, select: { id: true } });
      if (!eligible) throw new Error("This project is no longer available for daily entries.");
      await tx.task.update({ where: { id: validatedTaskId }, data: { ...fields, workDate } });
    });
    invalidateTasks();
    return { success: "Daily entry updated.", taskId: validatedTaskId };
  } catch (error) { return { error: message(error) }; }
}

async function updateAssignmentStatusServerImplementation(taskId: string, next: TaskStatus): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    taskId = parseInput(taskIdSchema, taskId);
    next = parseInput(assignmentStatusSchema, next);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, assignees: { some: { userId: worker.id } } }, select: { id: true, assignees: { where: { userId: worker.id }, select: { status: true } } } });
      const current = task?.assignees[0]?.status;
      const allowed: TaskStatus[] = current === TaskStatus.TODO ? [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] : current === TaskStatus.IN_PROGRESS ? [TaskStatus.TODO, TaskStatus.IN_REVIEW] : [];
      if (!task || !allowed.includes(next)) throw new Error("That progress change is not available.");
      await tx.taskAssignee.update({ where: { taskId_userId: { taskId, userId: worker.id } }, data: { status: next, submittedAt: next === TaskStatus.IN_REVIEW ? new Date() : null, managerNote: next === TaskStatus.IN_REVIEW ? null : undefined } });
      await recompute(tx, taskId);
    });

    if (next === TaskStatus.IN_REVIEW) {
      try {
        const fullTask = await prisma.task.findUnique({
          where: { id: taskId },
          select: { title: true, projectId: true, project: { select: { managerId: true, studioId: true, name: true } } },
        });
        if (fullTask?.project?.managerId) {
          await createStudioAreaNotification(fullTask.project.studioId, StudioArea.TASKS, {
            actorId: worker.id,
            type: NotificationType.TASK_REVIEW_READY,
            title: "Deliverable Ready for Review",
            message: `${worker.name || "Worker"} submitted "${fullTask.title}" for review`,
            link: notificationActionLink({ kind: "task", role: "MANAGER", id: taskId, action: "review" }),
            projectId: fullTask.projectId,
            taskId,
            sendEmail: true,
            emailSubject: `Review Needed: ${fullTask.title} (${fullTask.project.name})`,
          });
        }
      } catch (notifErr) {
        console.warn("[tasks] Failed to notify manager of review ready:", notifErr);
      }
    }

    invalidateTasks();
    return { success: "Progress updated.", taskId };
  } catch (error) { return { error: message(error) }; }
}

async function updateTaskStatusServerImplementation(taskId: string, next: TaskStatus): Promise<TaskActionState> {
  try {
    const current = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
    const studioManager = current.role === UserRole.WORKER ? null : await requireStudioManagerArea(StudioArea.TASKS);
    const user = studioManager ? studioManager.manager : current;
    taskId = parseInput(taskIdSchema, taskId);
    next = parseInput(taskStatusSchema, next);

    if (user.role === UserRole.WORKER) {
      return updateAssignmentStatus(taskId, next);
    }

    const completedRequest = await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
          project: studioManager
            ? { studioId: studioManager.context.studioId }
            : { managerId: user.id },
        },
        select: { id: true, status: true, projectId: true },
      });
      if (!task) throw new Error("Task not found or inaccessible.");

      if (next === TaskStatus.COMPLETED) {
        await tx.taskAssignee.updateMany({
          where: { taskId },
          data: { status: TaskStatus.COMPLETED, managerNote: null },
        });
        await tx.task.update({
          where: { id: taskId },
          data: { status: TaskStatus.COMPLETED, completedAt: new Date() },
        });
        const linkedRequest = await tx.workRequest.findFirst({ where: { createdTaskId: taskId, status: WorkRequestStatus.IN_PROGRESS }, select: { id: true, title: true, clientId: true } });
        if (linkedRequest) {
          await tx.workRequest.update({ where: { id: linkedRequest.id }, data: { status: WorkRequestStatus.COMPLETED } });
          return { ...linkedRequest, projectId: task.projectId };
        }
      } else {
        await tx.taskAssignee.updateMany({
          where: { taskId },
          data: { status: next, submittedAt: next === TaskStatus.IN_REVIEW ? new Date() : null },
        });
        await tx.task.update({
          where: { id: taskId },
          data: { status: next, completedAt: null },
        });
      }
      return null;
    });

    if (completedRequest) {
      try {
        await createNotification({ userId: completedRequest.clientId, actorId: user.id, type: NotificationType.SYSTEM_ALERT, category: NotificationCategory.UPDATE, title: "Requested Work Completed", message: `The studio completed “${completedRequest.title}”.`, link: `/client/work-requests?requestId=${encodeURIComponent(completedRequest.id)}`, projectId: completedRequest.projectId, taskId });
      } catch (error) { console.warn("[tasks] Could not notify client about completed request:", error); }
    }

    invalidateTasks();
    return { success: `Task updated to ${next.toLowerCase().replaceAll("_", " ")}.`, taskId };
  } catch (error) {
    return { error: message(error) };
  }
}

async function reviewTaskServerImplementation(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.TASKS);
    const input = parseInput(reviewTaskSchema, {
      taskId,
      decision: formString(data, "decision"),
      returnUserIds: stringList(data, "returnUserId"),
      managerNote: formString(data, "managerNote"),
    });
    taskId = input.taskId;
    const { decision, returnUserIds, managerNote } = input;
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, status: TaskStatus.IN_REVIEW, project: { managerId: manager.id } }, select: { id: true, projectId: true, assignees: { select: { userId: true, status: true } }, workRequestFor: { select: { id: true, title: true, clientId: true } } } });
      if (!task || task.assignees.some((a) => a.status !== TaskStatus.IN_REVIEW)) throw new Error("This task is not ready for review.");
      if (decision === "approve") {
        await tx.taskAssignee.updateMany({ where: { taskId, status: TaskStatus.IN_REVIEW }, data: { status: TaskStatus.COMPLETED, managerNote: null } });
        await tx.task.update({ where: { id: taskId }, data: { status: TaskStatus.COMPLETED, completedAt: new Date() } });
        if (task.workRequestFor) {
          await tx.workRequest.updateMany({ where: { id: task.workRequestFor.id, status: WorkRequestStatus.IN_PROGRESS }, data: { status: WorkRequestStatus.COMPLETED } });
        }
      } else if (decision === "return") {
        const userIds = [...new Set(returnUserIds)];
        if (userIds.some((id) => !task.assignees.some((a) => a.userId === id))) throw new Error("Select at least one assigned worker to resubmit.");
        await tx.taskAssignee.updateMany({ where: { taskId, userId: { in: userIds } }, data: { status: TaskStatus.IN_PROGRESS, submittedAt: null, managerNote } });
        await tx.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS, completedAt: null } });
      } else throw new Error("Choose approve or return.");
    });

    if (decision === "approve") {
      try {
        const completedRequest = await prisma.workRequest.findFirst({ where: { createdTaskId: taskId, status: WorkRequestStatus.COMPLETED }, select: { id: true, title: true, clientId: true, projectId: true, createdProjectId: true } });
        if (completedRequest) {
          await createNotification({
            userId: completedRequest.clientId,
            actorId: manager.actorId,
            type: NotificationType.SYSTEM_ALERT,
            category: NotificationCategory.UPDATE,
            title: "Requested Work Completed",
            message: `The studio completed “${completedRequest.title}”.`,
            link: `/client/work-requests?requestId=${encodeURIComponent(completedRequest.id)}`,
            projectId: completedRequest.projectId ?? completedRequest.createdProjectId,
            taskId,
          });
        }
        const fullTask = await prisma.task.findUnique({
          where: { id: taskId },
          select: { title: true, projectId: true, assignees: { select: { userId: true } } },
        });
        if (fullTask) {
          await Promise.all(
            fullTask.assignees.map((a) =>
              createNotification({
                userId: a.userId,
                actorId: manager.actorId,
                type: NotificationType.TASK_APPROVED,
                title: "Task Approved & Completed",
                message: `Manager approved "${fullTask.title}"`,
                link: notificationActionLink({ kind: "task", role: "WORKER", id: taskId }),
                projectId: fullTask.projectId,
                taskId,
                sendEmail: false,
              })
            )
          );
        }
      } catch (notifErr) {
        console.warn("[tasks] Failed to notify workers of approval:", notifErr);
      }
    } else if (decision === "return") {
      try {
        const userIds = [...new Set(returnUserIds)];
        const fullTask = await prisma.task.findUnique({
          where: { id: taskId },
          select: { title: true, projectId: true, project: { select: { name: true } } },
        });
        if (fullTask) {
          await Promise.all(
            userIds.map((userId) =>
              createNotification({
                userId,
                actorId: manager.actorId,
                type: NotificationType.TASK_RETURNED,
                title: "Task Returned for Revisions",
                message: `Manager returned "${fullTask.title}": "${managerNote.slice(0, 120)}"`,
                link: notificationActionLink({ kind: "task", role: "WORKER", id: taskId }),
                projectId: fullTask.projectId,
                taskId,
                sendEmail: true,
                emailSubject: `Revisions Needed: ${fullTask.title} (${fullTask.project.name})`,
              })
            )
          );
        }
      } catch (notifErr) {
        console.warn("[tasks] Failed to notify workers of returned task:", notifErr);
      }
    }

    invalidateTasks();
    return { success: decision === "approve" ? "Task approved." : "Selected workers were asked to resubmit.", taskId };
  } catch (error) { return { error: message(error) }; }
}

async function softDeleteTaskServerImplementation(taskId: string): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.TASKS);
    taskId = parseInput(taskIdSchema, taskId);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const found = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, project: { managerId: manager.id } }, select: { id: true } });
      if (!found) throw new Error("Task not found or already deleted.");
      await tx.task.update({ where: { id: taskId }, data: { deletedAt: new Date() } });
    });
    invalidateTasks();
    return { success: "Task deleted.", taskId };
  } catch (error) { return { error: message(error) }; }
}

async function restoreTaskServerImplementation(taskId: string): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.TASKS);
    taskId = parseInput(taskIdSchema, taskId);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const found = await tx.task.findFirst({
        where: { id: taskId, deletedAt: { not: null }, project: { managerId: manager.id } },
        select: { id: true },
      });
      if (!found) throw new Error("Task not found or is not in trash.");
      await tx.task.update({ where: { id: taskId }, data: { deletedAt: null } });
    });
    invalidateTasks();
    return { success: "Task restored successfully.", taskId };
  } catch (error) {
    return { error: message(error) };
  }
}

async function restoreMultipleTasksServerImplementation(taskIds: string[]): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.TASKS);
    taskIds = parseInput(restoreTaskIdsSchema, taskIds);
    const uniqueIds = [...new Set(taskIds)];
    const result = await prisma.task.updateMany({
      where: {
        id: { in: uniqueIds },
        deletedAt: { not: null },
        project: { managerId: manager.id },
      },
      data: { deletedAt: null },
    });
    invalidateTasks();
    return { success: `${result.count} task(s) restored successfully.` };
  } catch (error) {
    return { error: message(error) };
  }
}

async function permanentlyDeleteTaskServerImplementation(taskId: string): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.TASKS);
    taskId = parseInput(taskIdSchema, taskId);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const found = await tx.task.findFirst({
        where: { id: taskId, deletedAt: { not: null }, project: { managerId: manager.id } },
        select: { id: true },
      });
      if (!found) throw new Error("Task not found or is not in trash.");
      await tx.task.delete({ where: { id: taskId } });
    });
    invalidateTasks();
    return { success: "Task permanently deleted.", taskId };
  } catch (error) {
    return { error: message(error) };
  }
}

async function emptyTrashServerImplementation(): Promise<TaskActionState> {
  try {
    const { manager } = await requireStudioManagerArea(StudioArea.DELETED_TASKS);
    const result = await prisma.task.deleteMany({
      where: {
        deletedAt: { not: null },
        project: { managerId: manager.id },
      },
    });
    invalidateTasks();
    return { success: `Trash emptied. ${result.count} task(s) permanently removed.` };
  } catch (error) {
    return { error: message(error) };
  }
}


const createAssignedTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createAssignedTaskServerImplementation>>) => args)
  .handler(async ({ data }) => createAssignedTaskServerImplementation(...decodeActionArguments<Parameters<typeof createAssignedTaskServerImplementation>>(data)));
export const createAssignedTask = async (...args: Parameters<typeof createAssignedTaskServerImplementation>) => createAssignedTaskServerFunction({ data: await encodeActionArguments(args) });

const updateAssignedTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateAssignedTaskServerImplementation>>) => args)
  .handler(async ({ data }) => updateAssignedTaskServerImplementation(...decodeActionArguments<Parameters<typeof updateAssignedTaskServerImplementation>>(data)));
export const updateAssignedTask = async (...args: Parameters<typeof updateAssignedTaskServerImplementation>) => updateAssignedTaskServerFunction({ data: await encodeActionArguments(args) });

const createDailyEntryServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof createDailyEntryServerImplementation>>) => args)
  .handler(async ({ data }) => createDailyEntryServerImplementation(...decodeActionArguments<Parameters<typeof createDailyEntryServerImplementation>>(data)));
export const createDailyEntry = async (...args: Parameters<typeof createDailyEntryServerImplementation>) => createDailyEntryServerFunction({ data: await encodeActionArguments(args) });

const updateDailyEntryServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateDailyEntryServerImplementation>>) => args)
  .handler(async ({ data }) => updateDailyEntryServerImplementation(...decodeActionArguments<Parameters<typeof updateDailyEntryServerImplementation>>(data)));
export const updateDailyEntry = async (...args: Parameters<typeof updateDailyEntryServerImplementation>) => updateDailyEntryServerFunction({ data: await encodeActionArguments(args) });

const updateAssignmentStatusServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateAssignmentStatusServerImplementation>>) => args)
  .handler(async ({ data }) => updateAssignmentStatusServerImplementation(...decodeActionArguments<Parameters<typeof updateAssignmentStatusServerImplementation>>(data)));
export const updateAssignmentStatus = async (...args: Parameters<typeof updateAssignmentStatusServerImplementation>) => updateAssignmentStatusServerFunction({ data: await encodeActionArguments(args) });

const updateTaskStatusServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof updateTaskStatusServerImplementation>>) => args)
  .handler(async ({ data }) => updateTaskStatusServerImplementation(...decodeActionArguments<Parameters<typeof updateTaskStatusServerImplementation>>(data)));
export const updateTaskStatus = async (...args: Parameters<typeof updateTaskStatusServerImplementation>) => updateTaskStatusServerFunction({ data: await encodeActionArguments(args) });

const reviewTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof reviewTaskServerImplementation>>) => args)
  .handler(async ({ data }) => reviewTaskServerImplementation(...decodeActionArguments<Parameters<typeof reviewTaskServerImplementation>>(data)));
export const reviewTask = async (...args: Parameters<typeof reviewTaskServerImplementation>) => reviewTaskServerFunction({ data: await encodeActionArguments(args) });

const softDeleteTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof softDeleteTaskServerImplementation>>) => args)
  .handler(async ({ data }) => softDeleteTaskServerImplementation(...decodeActionArguments<Parameters<typeof softDeleteTaskServerImplementation>>(data)));
export const softDeleteTask = async (...args: Parameters<typeof softDeleteTaskServerImplementation>) => softDeleteTaskServerFunction({ data: await encodeActionArguments(args) });

const restoreTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof restoreTaskServerImplementation>>) => args)
  .handler(async ({ data }) => restoreTaskServerImplementation(...decodeActionArguments<Parameters<typeof restoreTaskServerImplementation>>(data)));
export const restoreTask = async (...args: Parameters<typeof restoreTaskServerImplementation>) => restoreTaskServerFunction({ data: await encodeActionArguments(args) });

const restoreMultipleTasksServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof restoreMultipleTasksServerImplementation>>) => args)
  .handler(async ({ data }) => restoreMultipleTasksServerImplementation(...decodeActionArguments<Parameters<typeof restoreMultipleTasksServerImplementation>>(data)));
export const restoreMultipleTasks = async (...args: Parameters<typeof restoreMultipleTasksServerImplementation>) => restoreMultipleTasksServerFunction({ data: await encodeActionArguments(args) });

const permanentlyDeleteTaskServerFunction = createServerFn({ method: "POST" })
  .validator((args: EncodedActionArguments<Parameters<typeof permanentlyDeleteTaskServerImplementation>>) => args)
  .handler(async ({ data }) => permanentlyDeleteTaskServerImplementation(...decodeActionArguments<Parameters<typeof permanentlyDeleteTaskServerImplementation>>(data)));
export const permanentlyDeleteTask = async (...args: Parameters<typeof permanentlyDeleteTaskServerImplementation>) => permanentlyDeleteTaskServerFunction({ data: await encodeActionArguments(args) });


const emptyTrashServerFunction = createServerFn({ method: "POST" })
  .handler(async () => emptyTrashServerImplementation());
export const emptyTrash = () => emptyTrashServerFunction();
