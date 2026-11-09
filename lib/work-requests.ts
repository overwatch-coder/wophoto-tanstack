
import { Prisma, UserRole, UserStatus, WorkRequestStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE } from "@/lib/pagination";
import { parseInput } from "@/lib/validation/common";
import { workRequestQuerySchema } from "@/lib/validation/work-requests";

const requestSelect = {
  id: true,
  type: true,
  title: true,
  details: true,
  requestedDueAt: true,
  status: true,
  managerNote: true,
  createdAt: true,
  updatedAt: true,
  client: { select: { id: true, name: true, email: true, image: true } },
  project: { select: { id: true, name: true } },
  createdProject: { select: { id: true, name: true } },
  createdTask: {
    select: {
      id: true,
      title: true,
      status: true,
      dueAt: true,
      assignees: { select: { user: { select: { id: true, name: true, email: true } } } },
    },
  },
} satisfies Prisma.WorkRequestSelect;

function toView(request: Prisma.WorkRequestGetPayload<{ select: typeof requestSelect }>) {
  return {
    ...request,
    requestedDueAt: request.requestedDueAt?.toISOString() ?? null,
    createdAt: request.createdAt.toISOString(),
    updatedAt: request.updatedAt.toISOString(),
    createdTask: request.createdTask ? {
      ...request.createdTask,
      dueAt: request.createdTask.dueAt?.toISOString() ?? null,
    } : null,
  };
}

export async function getClientWorkRequestOptions(clientId: string) {
  const projects = await prisma.project.findMany({
    where: { clientId },
    select: { id: true, name: true },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: 100,
  });
  return { projects };
}

export async function getManagerWorkRequestOptions(managerId: string) {
  const workers = await prisma.user.findMany({
    where: { role: UserRole.WORKER, status: UserStatus.ACTIVE, acceptedInvitation: { is: { invitedById: managerId } } },
    select: { id: true, name: true, email: true },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    take: 100,
  });
  return { workers };
}

export async function getClientWorkRequests(clientId: string, rawQuery: unknown = {}) {
  const query = parseInput(workRequestQuerySchema, rawQuery);
  const take = query.limit || DEFAULT_PAGE_SIZE;
  const rows = await prisma.workRequest.findMany({
    where: { clientId, ...(query.status !== "ALL" ? { status: query.status } : {}) },
    select: requestSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  return { items: page.map(toView), nextCursor: hasMore ? page.at(-1)?.id ?? null : null };
}

export async function getClientWorkRequestById(clientId: string, requestId: string) {
  const request = await prisma.workRequest.findFirst({ where: { id: requestId, clientId }, select: requestSelect });
  return request ? toView(request) : null;
}

export async function getManagerWorkRequests(managerId: string, rawQuery: unknown = {}) {
  const query = parseInput(workRequestQuerySchema, rawQuery);
  const take = query.limit || DEFAULT_PAGE_SIZE;
  const where: Prisma.WorkRequestWhereInput = {
    managerId,
    ...(query.status !== "ALL" ? { status: query.status } : {}),
    ...(query.query ? {
      OR: [
        { title: { contains: query.query, mode: "insensitive" } },
        { details: { contains: query.query, mode: "insensitive" } },
        { client: { name: { contains: query.query, mode: "insensitive" } } },
        { client: { email: { contains: query.query, mode: "insensitive" } } },
        { project: { name: { contains: query.query, mode: "insensitive" } } },
        { createdProject: { name: { contains: query.query, mode: "insensitive" } } },
      ],
    } : {}),
  };
  const rows = await prisma.workRequest.findMany({
    where,
    select: requestSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: take + 1,
    ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  const page = hasMore ? rows.slice(0, take) : rows;
  const [submitted, needsInfo, active, completed, declined] = await Promise.all([
    prisma.workRequest.count({ where: { managerId, status: WorkRequestStatus.SUBMITTED } }),
    prisma.workRequest.count({ where: { managerId, status: WorkRequestStatus.NEEDS_INFO } }),
    prisma.workRequest.count({ where: { managerId, status: WorkRequestStatus.IN_PROGRESS } }),
    prisma.workRequest.count({ where: { managerId, status: WorkRequestStatus.COMPLETED } }),
    prisma.workRequest.count({ where: { managerId, status: WorkRequestStatus.DECLINED } }),
  ]);
  return {
    items: page.map(toView),
    nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
    counts: { submitted, needsInfo, active, completed, declined },
  };
}

export async function getManagerWorkRequestById(managerId: string, requestId: string) {
  const request = await prisma.workRequest.findFirst({ where: { id: requestId, managerId }, select: requestSelect });
  return request ? toView(request) : null;
}
