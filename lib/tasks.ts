import "server-only";

import { Prisma, Specialization, TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { cleanClientName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination";

export async function getTasks(input: {
  page?: number;
  status?: string;
  priority?: string;
  taskId?: string;
  q?: string;
  specialization?: string;
} = {}) {
  const user = await requireRole(UserRole.MANAGER, UserRole.WORKER);
  const taskId = input.taskId?.trim().slice(0, 191) || undefined;
  const status = Object.values(TaskStatus).includes(input.status as TaskStatus) ? input.status as TaskStatus : undefined;
  const priority = Object.values(TaskPriority).includes(input.priority as TaskPriority) ? input.priority as TaskPriority : undefined;
  const q = input.q?.trim().slice(0, 100) || undefined;
  const spec = Object.values(Specialization).includes(input.specialization as Specialization)
    ? (input.specialization as Specialization)
    : undefined;

  const scope = user.role === UserRole.MANAGER
    ? { project: { managerId: user.id } }
    : { assignees: { some: { userId: user.id } } };
  const assignmentFilter = user.role === UserRole.WORKER ? { assignees: { some: { userId: user.id, ...(!taskId && status ? { status } : {}) } } } : {};

  const searchFilter = q
    ? {
        OR: [
          { title: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: q, mode: Prisma.QueryMode.insensitive } },
          { project: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } },
          { project: { client: { name: { contains: q, mode: Prisma.QueryMode.insensitive } } } },
        ],
      }
    : {};

  const specFilter = spec
    ? { specializations: { some: { specialization: spec } } }
    : {};

  const where = {
    ...scope,
    ...assignmentFilter,
    deletedAt: null,
    ...searchFilter,
    ...specFilter,
    ...(taskId ? { id: taskId } : {}),
    ...(!taskId && user.role === UserRole.MANAGER && status ? { status } : {}),
    ...(!taskId && priority ? { priority } : {}),
  };

  const total = await prisma.task.count({ where });
  const totalPages = getPageCount(total);
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);

  const taskSelect = {
    id: true, title: true, description: true, type: true, workDate: true, status: true, priority: true,
    startAt: true, dueAt: true, completedAt: true, createdAt: true, updatedAt: true, projectId: true,
    project: { select: { id: true, name: true, client: { select: { name: true } } } },
    assignees: { select: { userId: true, status: true, submittedAt: true, managerNote: true, user: { select: { name: true, email: true, image: true } } } },
    specializations: { select: { specialization: true } },
  };

  const [rows, boardRows, counts] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DEFAULT_PAGE_SIZE,
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      select: taskSelect,
    }),
    prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 150,
      select: taskSelect,
    }),
    user.role === UserRole.MANAGER
      ? prisma.task.groupBy({ by: ["status"], where: { ...scope, deletedAt: null }, _count: { _all: true } })
      : prisma.taskAssignee.groupBy({ by: ["status"], where: { userId: user.id, task: { deletedAt: null } }, _count: { _all: true } }),
  ]);

  const formatTask = (task: typeof rows[number]) => ({
    ...task,
    project: {
      ...task.project,
      client: task.project.client?.name ? { name: cleanClientName(task.project.client.name) } : null,
    },
    assignees: task.assignees.map((assignment) => ({
      ...assignment,
      managerNote: user.role === UserRole.MANAGER || assignment.userId === user.id ? assignment.managerNote : null,
      isCurrentUser: assignment.userId === user.id,
    })),
    myStatus: task.assignees.find((assignment) => assignment.userId === user.id)?.status ?? null,
  });

  const tasks = rows.map(formatTask);
  const boardTasks = boardRows.map(formatTask);

  return {
    tasks,
    boardTasks,
    page,
    total,
    totalPages,
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<Record<TaskStatus, number>>,
  };
}

export type TasksPageData = Awaited<ReturnType<typeof getTasks>>;

export async function getTaskFormOptions() {
  const user = await requireRole(UserRole.MANAGER, UserRole.WORKER);
  if (user.role === UserRole.MANAGER) {
    const [projects, workers] = await Promise.all([
      prisma.project.findMany({
        where: { managerId: user.id },
        orderBy: { name: "asc" }, take: 100,
        select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({ where: { role: UserRole.WORKER, status: UserStatus.ACTIVE, acceptedInvitation: { is: { invitedById: user.id } } }, orderBy: [{ name: "asc" }, { email: "asc" }], take: 100, select: { id: true, name: true, email: true, image: true, preferences: { select: { workerAvailability: true } } } }),
    ]);

    const clientsMap = new Map<string, string>();
    for (const p of projects) {
      if (p.clientId && p.client) {
        clientsMap.set(p.clientId, cleanClientName(p.client.name) || "Unnamed client");
      }
    }
    const clients = Array.from(clientsMap.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return {
      projects: projects.map((p) => ({
        id: p.id,
        name: p.name,
        clientId: p.clientId,
        clientName: cleanClientName(p.client?.name),
      })),
      clients,
      workers: workers.map(({ preferences, ...worker }) => ({
        ...worker,
        availability: preferences?.workerAvailability ?? "AVAILABLE",
      })),
    };
  }
  const projects = await prisma.project.findMany({
    where: { tasks: { some: { type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: user.id } } } } },
    orderBy: { name: "asc" }, take: 100,
    select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true } } },
  });
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      clientName: cleanClientName(p.client?.name),
    })),
    clients: [],
    workers: [],
  };
}

export async function getDeletedTasks(input: {
  page?: number;
  search?: string;
  projectId?: string;
  priority?: string;
} = {}) {
  const manager = await requireRole(UserRole.MANAGER);
  const search = input.search?.trim().slice(0, 120) ?? "";
  const projectId = input.projectId && input.projectId !== "ALL" ? input.projectId : undefined;
  const priority = Object.values(TaskPriority).includes(input.priority as TaskPriority)
    ? input.priority as TaskPriority
    : undefined;
  const where: Prisma.TaskWhereInput = {
    deletedAt: { not: null },
    project: {
      managerId: manager.id,
      ...(projectId ? { id: projectId } : {}),
    },
    ...(priority ? { priority } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
            { project: { name: { contains: search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
  const trashWhere: Prisma.TaskWhereInput = {
    deletedAt: { not: null },
    project: { managerId: manager.id },
  };
  const [total, trashCount] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.count({ where: trashWhere }),
  ]);
  const totalPages = getPageCount(total);
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);
  const [rows, projects] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ deletedAt: "desc" }, { id: "desc" }],
      take: DEFAULT_PAGE_SIZE,
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      status: true,
      priority: true,
      deletedAt: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      assignees: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              image: true,
            },
          },
        },
      },
      specializations: {
        select: {
          specialization: true,
        },
      },
      },
    }),
    prisma.project.findMany({
      where: { managerId: manager.id, tasks: { some: { deletedAt: { not: null } } } },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: 100,
    }),
  ]);

  const now = Date.now();
  const RETENTION_DAYS = 30;

  const tasks = rows.map((task) => {
    const deletedTime = task.deletedAt ? new Date(task.deletedAt).getTime() : now;
    const daysPassed = Math.floor((now - deletedTime) / (1000 * 60 * 60 * 24));
    const daysRemaining = Math.max(0, RETENTION_DAYS - daysPassed);

    const deletedBy = task.project?.manager ?? task.createdBy;

    return {
      id: task.id,
      title: task.title,
      description: task.description,
      type: task.type,
      status: task.status,
      priority: task.priority,
      projectId: task.projectId,
      projectName: task.project?.name ?? "Unknown Project",
      deletedAt: task.deletedAt ? task.deletedAt.toISOString() : new Date().toISOString(),
      daysRemaining,
      deletedById: deletedBy?.id ?? manager.id,
      deletedByName: deletedBy?.name ?? "Manager",
      deletedByEmail: deletedBy?.email ?? "",
      deletedByImage: deletedBy?.image ?? null,
      assignees: task.assignees.map((a) => ({
        id: a.user.id,
        name: a.user.name ?? "Worker",
        email: a.user.email,
        image: a.user.image,
      })),
      specializations: task.specializations.map((s) => s.specialization),
    };
  });
  return { tasks, projects, page, total, totalPages, trashCount };
}

export type DeletedTasksPage = Awaited<ReturnType<typeof getDeletedTasks>>;
export type DeletedTaskItem = DeletedTasksPage["tasks"][number];
