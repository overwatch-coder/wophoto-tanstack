"use server";

import { revalidatePath } from "next/cache";
import {
  InvitationStatus,
  NotificationCategory,
  NotificationType,
  TaskType,
  UserRole,
  UserStatus,
  WorkRequestStatus,
  WorkRequestType,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { parseInput } from "@/lib/validation/common";
import {
  acceptWorkRequestSchema,
  createWorkRequestSchema,
  respondToWorkRequestSchema,
  reviewWorkRequestSchema,
} from "@/lib/validation/work-requests";

export type WorkRequestActionState = { error?: string; success?: string; requestId?: string; taskId?: string; projectId?: string };
const safeMessage = (error: unknown) => error instanceof Error ? error.message : "The request could not be saved. Try again.";
const field = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const requestPaths = ["/client/work-requests", "/manager/work-requests", "/manager/tasks", "/manager/projects"];
const refreshRequestViews = () => requestPaths.forEach((path) => revalidatePath(path));

async function notify(input: Parameters<typeof createNotification>[0]) {
  try { await createNotification(input); }
  catch (error) { console.warn("[work-requests] Notification dispatch failed:", error); }
}

export async function createWorkRequest(_state: WorkRequestActionState, data: FormData): Promise<WorkRequestActionState> {
  const client = await requireRole(UserRole.CLIENT);
  try {
    const input = parseInput(createWorkRequestSchema, {
      type: field(data, "type"),
      projectId: field(data, "projectId"),
      title: field(data, "title"),
      details: field(data, "details"),
      requestedDueAt: field(data, "requestedDueAt"),
    });
    let managerId: string;
    let projectId: string | null = null;
    if (input.type === WorkRequestType.WORK) {
      const project = await prisma.project.findFirst({
        where: { id: input.projectId ?? undefined, clientId: client.id },
        select: { id: true, managerId: true },
      });
      if (!project) throw new Error("Choose a project that belongs to your account.");
      managerId = project.managerId;
      projectId = project.id;
    } else {
      const invitation = await prisma.invitation.findFirst({
        where: { acceptedUserId: client.id, status: InvitationStatus.USED, role: UserRole.CLIENT, invitedBy: { status: UserStatus.ACTIVE, role: UserRole.MANAGER } },
        select: { invitedById: true },
        orderBy: { usedAt: "desc" },
      });
      if (!invitation) throw new Error("Your account is not linked to an active studio manager. Contact the studio before submitting a project request.");
      managerId = invitation.invitedById;
    }
    const created = await prisma.workRequest.create({
      data: { ...input, projectId, managerId, clientId: client.id },
      select: { id: true, type: true, title: true, managerId: true, projectId: true },
    });
    await notify({
      userId: created.managerId,
      actorId: client.id,
      type: NotificationType.SYSTEM_ALERT,
      category: NotificationCategory.ACTION_REQUIRED,
      title: created.type === WorkRequestType.PROJECT ? "New Project Request" : "New Work Request",
      message: `${client.name || "A client"} submitted “${created.title}”.`,
      link: `/manager/work-requests?requestId=${encodeURIComponent(created.id)}`,
      projectId: created.projectId,
    });
    refreshRequestViews();
    return { success: "Request sent to the studio.", requestId: created.id };
  } catch (error) { return { error: safeMessage(error) }; }
}

export async function respondToWorkRequest(_state: WorkRequestActionState, data: FormData): Promise<WorkRequestActionState> {
  const client = await requireRole(UserRole.CLIENT);
  try {
    const input = parseInput(respondToWorkRequestSchema, {
      requestId: field(data, "requestId"),
      title: field(data, "title"),
      details: field(data, "details"),
      requestedDueAt: field(data, "requestedDueAt"),
    });
    const request = await prisma.workRequest.findFirst({ where: { id: input.requestId, clientId: client.id, status: WorkRequestStatus.NEEDS_INFO }, select: { id: true, title: true, managerId: true, projectId: true } });
    if (!request) throw new Error("This request is not awaiting more information.");
    const updated = await prisma.workRequest.updateMany({
      where: { id: request.id, clientId: client.id, status: WorkRequestStatus.NEEDS_INFO },
      data: { title: input.title, details: input.details, requestedDueAt: input.requestedDueAt, status: WorkRequestStatus.SUBMITTED, managerNote: null },
    });
    if (!updated.count) throw new Error("This request was updated by the studio. Refresh and check its latest status.");
    await notify({ userId: request.managerId, actorId: client.id, type: NotificationType.SYSTEM_ALERT, category: NotificationCategory.ACTION_REQUIRED, title: "Client Updated a Work Request", message: `${client.name || "A client"} provided the requested information for “${input.title}”.`, link: `/manager/work-requests?requestId=${encodeURIComponent(request.id)}`, projectId: request.projectId });
    refreshRequestViews();
    return { success: "Your updated request has been sent to the studio.", requestId: request.id };
  } catch (error) { return { error: safeMessage(error) }; }
}

export async function reviewWorkRequest(_state: WorkRequestActionState, data: FormData): Promise<WorkRequestActionState> {
  const manager = await requireRole(UserRole.MANAGER);
  try {
    const input = parseInput(reviewWorkRequestSchema, { requestId: field(data, "requestId"), nextStatus: field(data, "nextStatus"), managerNote: field(data, "managerNote") });
    const updated = await prisma.workRequest.updateMany({
      where: { id: input.requestId, managerId: manager.id, status: WorkRequestStatus.SUBMITTED },
      data: { status: input.nextStatus, managerNote: input.managerNote, reviewedAt: new Date() },
    });
    if (!updated.count) throw new Error("This request is no longer awaiting review.");
    const request = await prisma.workRequest.findFirst({ where: { id: input.requestId, managerId: manager.id }, select: { id: true, title: true, clientId: true, projectId: true } });
    if (request) {
      const asking = input.nextStatus === WorkRequestStatus.NEEDS_INFO;
      await notify({ userId: request.clientId, actorId: manager.id, type: NotificationType.SYSTEM_ALERT, category: NotificationCategory.UPDATE, title: asking ? "Studio Needs More Information" : "Studio Declined the Request", message: input.managerNote, link: `/client/work-requests?requestId=${encodeURIComponent(request.id)}`, projectId: request.projectId });
    }
    refreshRequestViews();
    return { success: input.nextStatus === WorkRequestStatus.NEEDS_INFO ? "More information requested." : "Request declined.", requestId: input.requestId };
  } catch (error) { return { error: safeMessage(error) }; }
}

export async function acceptWorkRequest(_state: WorkRequestActionState, data: FormData): Promise<WorkRequestActionState> {
  const manager = await requireRole(UserRole.MANAGER);
  try {
    const input = parseInput(acceptWorkRequestSchema, {
      requestId: field(data, "requestId"),
      workerIds: data.getAll("workerId").map(String),
      taskTitle: field(data, "taskTitle"),
      priority: field(data, "priority"),
      dueAt: field(data, "dueAt"),
    });
    const workerIds = [...new Set(input.workerIds)];
    const workers = await prisma.user.findMany({ where: { id: { in: workerIds }, role: UserRole.WORKER, status: UserStatus.ACTIVE, acceptedInvitation: { is: { invitedById: manager.id } } }, select: { id: true } });
    if (workers.length !== workerIds.length) throw new Error("Choose active workers on your studio team.");

    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "WorkRequest" WHERE "id" = ${input.requestId} FOR UPDATE`;
      const request = await tx.workRequest.findFirst({ where: { id: input.requestId, managerId: manager.id, status: WorkRequestStatus.SUBMITTED }, select: { id: true, type: true, title: true, details: true, requestedDueAt: true, clientId: true, projectId: true, createdTaskId: true, createdProjectId: true } });
      if (!request || request.createdTaskId || request.createdProjectId) throw new Error("This request is no longer available for acceptance.");

      let projectId = request.projectId;
      let createdProjectId: string | null = null;
      if (request.type === WorkRequestType.PROJECT) {
        const project = await tx.project.create({ data: { name: request.title, description: request.details, clientId: request.clientId, managerId: manager.id }, select: { id: true } });
        projectId = project.id;
        createdProjectId = project.id;
      }
      if (!projectId) throw new Error("The project for this work request is missing.");
      const task = await tx.task.create({
        data: {
          title: input.taskTitle,
          description: request.details,
          priority: input.priority,
          dueAt: input.dueAt ?? request.requestedDueAt,
          projectId,
          createdById: manager.id,
          type: TaskType.ASSIGNED,
          assignees: { create: workerIds.map((userId) => ({ userId })) },
        },
        select: { id: true },
      });
      await tx.workRequest.update({ where: { id: request.id }, data: { createdProjectId, createdTaskId: task.id, status: WorkRequestStatus.IN_PROGRESS, managerNote: null, reviewedAt: new Date() } });
      return { requestId: request.id, title: request.title, clientId: request.clientId, taskId: task.id, projectId, createdProjectId };
    });

    await Promise.all([
      notify({ userId: result.clientId, actorId: manager.id, type: NotificationType.SYSTEM_ALERT, category: NotificationCategory.UPDATE, title: "Request Approved", message: `The studio accepted “${result.title}” and started the work.`, link: `/client/work-requests?requestId=${encodeURIComponent(result.requestId)}`, projectId: result.projectId, taskId: result.taskId }),
      ...workerIds.map((userId) => notify({ userId, actorId: manager.id, type: NotificationType.TASK_ASSIGNED, title: "New Task Assigned", message: `You were assigned “${input.taskTitle}” from a client request.`, link: `/worker/tasks?taskId=${encodeURIComponent(result.taskId)}`, projectId: result.projectId, taskId: result.taskId, sendEmail: true })),
    ]);
    refreshRequestViews();
    return { success: result.createdProjectId ? "Project created and initial work assigned." : "Work request assigned to the team.", requestId: result.requestId, taskId: result.taskId, projectId: result.projectId };
  } catch (error) { return { error: safeMessage(error) }; }
}
