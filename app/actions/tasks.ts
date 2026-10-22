"use server";

import { revalidatePath } from "next/cache";
import { Prisma, Specialization, TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getTasks } from "@/lib/tasks";

export type TaskActionState = { error?: string; success?: string; taskId?: string };
const paths = ["/manager/tasks", "/worker/tasks"];
const message = (error: unknown) => error instanceof Error ? error.message : "The task could not be saved. Try again.";
const stringValue = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const stringList = (data: FormData, key: string) => data.getAll(key).filter((v): v is string => typeof v === "string").map((v) => v.trim()).filter(Boolean);
const validId = (s: string) => s.length > 0 && s.length <= 191;
const validPriority = (s: string): s is TaskPriority => Object.values(TaskPriority).includes(s as TaskPriority);
const dateField = (s: string): Date | null => {
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Enter a valid date.");
  const d = new Date(`${s}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new Error("Enter a valid date.");
  return d;
};
const taskFields = (data: FormData) => {
  const title = stringValue(data, "title");
  const description = stringValue(data, "description");
  const priorityRaw = stringValue(data, "priority") || TaskPriority.MEDIUM;
  const startAt = dateField(stringValue(data, "startAt"));
  const dueAt = dateField(stringValue(data, "dueAt"));
  if (title.length < 1 || title.length > 160) throw new Error("Title must be between 1 and 160 characters.");
  if (description.length > 5000) throw new Error("Description must be 5,000 characters or fewer.");
  if (!validPriority(priorityRaw)) throw new Error("Choose a valid priority.");
  if (startAt && dueAt && dueAt < startAt) throw new Error("The due date cannot be before the start date.");
  return { title, description: description || null, priority: priorityRaw, startAt, dueAt };
};
const parseSpecializations = (data: FormData) => {
  const values = stringList(data, "specialization");
  if (values.some((s) => !Object.values(Specialization).includes(s as Specialization))) throw new Error("Choose valid specializations.");
  return [...new Set(values)] as Specialization[];
};
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
const invalidateTasks = () => paths.forEach((path) => revalidatePath(path));

export async function loadMoreTasks(cursor: string, status?: string, priority?: string) {
  return getTasks({ cursor, status, priority });
}

export async function filterTasks(status?: string, priority?: string) {
  return getTasks({ status, priority });
}

export async function createAssignedTask(_state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const manager = await requireRole(UserRole.MANAGER);
    const projectId = stringValue(data, "projectId");
    if (!validId(projectId)) throw new Error("Choose a project you manage.");
    const fields = taskFields(data);
    const workerIds = await checkWorkers(stringList(data, "workerId"));
    const specializations = parseSpecializations(data);
    const project = await prisma.project.findFirst({ where: { id: projectId, managerId: manager.id }, select: { id: true } });
    if (!project) throw new Error("That project is not available to you.");
    const task = await prisma.task.create({ data: { ...fields, projectId, createdById: manager.id, type: TaskType.ASSIGNED, assignees: { create: workerIds.map((userId) => ({ userId })) }, specializations: { create: specializations.map((specialization) => ({ specialization })) } }, select: { id: true } });
    invalidateTasks();
    return { success: "Task created.", taskId: task.id };
  } catch (error) { return { error: message(error) }; }
}

export async function updateAssignedTask(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const manager = await requireRole(UserRole.MANAGER);
    if (!validId(taskId)) throw new Error("Task not found.");
    const fields = taskFields(data);
    const workerIds = await checkWorkers(stringList(data, "workerId"));
    const specializations = parseSpecializations(data);
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, type: TaskType.ASSIGNED, status: { not: TaskStatus.COMPLETED }, project: { managerId: manager.id } }, select: { id: true, assignees: { select: { userId: true } } } });
      if (!task) throw new Error("This task cannot be edited.");
      const add = workerIds.filter((id) => !task.assignees.some((a) => a.userId === id));
      const remove = task.assignees.map((a) => a.userId).filter((id) => !workerIds.includes(id));
      await tx.task.update({ where: { id: taskId }, data: { ...fields, specializations: { deleteMany: {}, create: specializations.map((specialization) => ({ specialization })) } } });
      if (remove.length) await tx.taskAssignee.deleteMany({ where: { taskId, userId: { in: remove } } });
      if (add.length) await tx.taskAssignee.createMany({ data: add.map((userId) => ({ taskId, userId })) });
      await recompute(tx, taskId);
    });
    invalidateTasks();
    return { success: "Task updated.", taskId };
  } catch (error) { return { error: message(error) }; }
}

export async function createDailyEntry(_state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    const projectId = stringValue(data, "projectId");
    const fields = taskFields(data);
    const workDate = dateField(stringValue(data, "workDate")) ?? new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()));
    if (workDate > new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))) throw new Error("Work date cannot be in the future.");
    const eligible = await prisma.project.findFirst({ where: { id: projectId, tasks: { some: { type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: worker.id } } } } }, select: { id: true } });
    if (!eligible) throw new Error("Choose a project where you have assigned work.");
    const task = await prisma.task.create({ data: { title: fields.title, description: fields.description, priority: fields.priority, projectId, createdById: worker.id, type: TaskType.DAILY_ENTRY, workDate, assignees: { create: { userId: worker.id } } }, select: { id: true } });
    invalidateTasks();
    return { success: "Daily entry created.", taskId: task.id };
  } catch (error) { return { error: message(error) }; }
}

export async function updateDailyEntry(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    const fields = taskFields(data);
    const workDate = dateField(stringValue(data, "workDate"));
    if (!workDate || workDate > new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()))) throw new Error("Choose today or a past work date.");
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, type: TaskType.DAILY_ENTRY, deletedAt: null, assignees: { some: { userId: worker.id, status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] } } } }, select: { id: true, projectId: true } });
      if (!task) throw new Error("This daily entry is locked or unavailable.");
      const eligible = await tx.task.findFirst({ where: { projectId: task.projectId, type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: worker.id } } }, select: { id: true } });
      if (!eligible) throw new Error("This project is no longer available for daily entries.");
      await tx.task.update({ where: { id: taskId }, data: { ...fields, workDate } });
    });
    invalidateTasks();
    return { success: "Daily entry updated.", taskId };
  } catch (error) { return { error: message(error) }; }
}

export async function updateAssignmentStatus(taskId: string, next: TaskStatus): Promise<TaskActionState> {
  try {
    const worker = await requireRole(UserRole.WORKER);
    const workerStatuses: TaskStatus[] = [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];
    if (!workerStatuses.includes(next)) throw new Error("Choose a valid progress state.");
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, assignees: { some: { userId: worker.id } } }, select: { id: true, assignees: { where: { userId: worker.id }, select: { status: true } } } });
      const current = task?.assignees[0]?.status;
      const allowed: TaskStatus[] = current === TaskStatus.TODO ? [TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW] : current === TaskStatus.IN_PROGRESS ? [TaskStatus.TODO, TaskStatus.IN_REVIEW] : [];
      if (!task || !allowed.includes(next)) throw new Error("That progress change is not available.");
      await tx.taskAssignee.update({ where: { taskId_userId: { taskId, userId: worker.id } }, data: { status: next, submittedAt: next === TaskStatus.IN_REVIEW ? new Date() : null, managerNote: next === TaskStatus.IN_REVIEW ? null : undefined } });
      await recompute(tx, taskId);
    });
    invalidateTasks();
    return { success: "Progress updated.", taskId };
  } catch (error) { return { error: message(error) }; }
}

export async function reviewTask(taskId: string, _state: TaskActionState, data: FormData): Promise<TaskActionState> {
  try {
    const manager = await requireRole(UserRole.MANAGER);
    const decision = stringValue(data, "decision");
    await prisma.$transaction(async (tx) => {
      await lockTask(tx, taskId);
      const task = await tx.task.findFirst({ where: { id: taskId, deletedAt: null, status: TaskStatus.IN_REVIEW, project: { managerId: manager.id } }, select: { id: true, assignees: { select: { userId: true, status: true } } } });
      if (!task || task.assignees.some((a) => a.status !== TaskStatus.IN_REVIEW)) throw new Error("This task is not ready for review.");
      if (decision === "approve") {
        await tx.taskAssignee.updateMany({ where: { taskId, status: TaskStatus.IN_REVIEW }, data: { status: TaskStatus.COMPLETED, managerNote: null } });
        await tx.task.update({ where: { id: taskId }, data: { status: TaskStatus.COMPLETED, completedAt: new Date() } });
      } else if (decision === "return") {
        const userIds = [...new Set(stringList(data, "returnUserId"))];
        const note = stringValue(data, "managerNote");
        if (!note || note.length > 3000) throw new Error("Add a note of up to 3,000 characters for the selected workers.");
        if (!userIds.length || userIds.some((id) => !task.assignees.some((a) => a.userId === id))) throw new Error("Select at least one assigned worker to resubmit.");
        await tx.taskAssignee.updateMany({ where: { taskId, userId: { in: userIds } }, data: { status: TaskStatus.IN_PROGRESS, submittedAt: null, managerNote: note } });
        await tx.task.update({ where: { id: taskId }, data: { status: TaskStatus.IN_PROGRESS, completedAt: null } });
      } else throw new Error("Choose approve or return.");
    });
    invalidateTasks();
    return { success: decision === "approve" ? "Task approved." : "Selected workers were asked to resubmit.", taskId };
  } catch (error) { return { error: message(error) }; }
}

export async function softDeleteTask(taskId: string): Promise<TaskActionState> {
  try {
    const manager = await requireRole(UserRole.MANAGER);
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
