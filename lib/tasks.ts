import "server-only";

import { TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { cleanClientName } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 50;

export async function getTasks(input: { cursor?: string; status?: string; priority?: string } = {}) {
  const user = await requireRole(UserRole.MANAGER, UserRole.WORKER);
  const status = Object.values(TaskStatus).includes(input.status as TaskStatus) ? input.status as TaskStatus : undefined;
  const priority = Object.values(TaskPriority).includes(input.priority as TaskPriority) ? input.priority as TaskPriority : undefined;
  const scope = user.role === UserRole.MANAGER
    ? { project: { managerId: user.id } }
    : { assignees: { some: { userId: user.id } } };
  const assignmentFilter = user.role === UserRole.WORKER ? { assignees: { some: { userId: user.id, ...(status ? { status } : {}) } } } : {};
  const rows = await prisma.task.findMany({
    where: { ...scope, ...assignmentFilter, deletedAt: null, ...(user.role === UserRole.MANAGER && status ? { status } : {}), ...(priority ? { priority } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
    select: {
      id: true, title: true, description: true, type: true, workDate: true, status: true, priority: true,
      startAt: true, dueAt: true, completedAt: true, createdAt: true, updatedAt: true, projectId: true,
      project: { select: { id: true, name: true, client: { select: { name: true } } } },
      assignees: { select: { userId: true, status: true, submittedAt: true, managerNote: true, user: { select: { name: true, email: true, image: true } } } },
      specializations: { select: { specialization: true } },
    },
  });
  const more = rows.length > PAGE_SIZE;
  const tasks = rows.slice(0, PAGE_SIZE).map((task) => ({
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
  }));
  const counts = user.role === UserRole.MANAGER
    ? await prisma.task.groupBy({ by: ["status"], where: { ...scope, deletedAt: null }, _count: { _all: true } })
    : await prisma.taskAssignee.groupBy({ by: ["status"], where: { userId: user.id, task: { deletedAt: null } }, _count: { _all: true } });
  return { tasks, nextCursor: more ? rows[PAGE_SIZE - 1]?.id ?? null : null, counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<Record<TaskStatus, number>> };
}

export async function getTaskFormOptions() {
  const user = await requireRole(UserRole.MANAGER, UserRole.WORKER);
  if (user.role === UserRole.MANAGER) {
    const [projects, workers] = await Promise.all([
      prisma.project.findMany({
        where: { managerId: user.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({ where: { role: UserRole.WORKER, status: UserStatus.ACTIVE }, orderBy: [{ name: "asc" }, { email: "asc" }], select: { id: true, name: true, email: true, image: true } }),
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
      workers,
    };
  }
  const projects = await prisma.project.findMany({
    where: { tasks: { some: { type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: user.id } } } } },
    orderBy: { name: "asc" },
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
