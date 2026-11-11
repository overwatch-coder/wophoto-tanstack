
import { Prisma, TaskPriority, TaskStatus, TaskType, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { requireStudioArea } from "@/lib/studio-access";
import { StudioArea } from "@/generated/prisma/client";
import { cleanClientName } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination";

export async function getTasks(input: {
  page?: number;
  status?: string;
  priority?: string;
  taskId?: string;
  q?: string;
  serviceId?: string;
} = {}) {
  const current = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = current.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.TASKS);
  const user = current.role === UserRole.WORKER ? current : { ...current, id: studio!.context.ownerUserId };
  const taskId = input.taskId?.trim().slice(0, 191) || undefined;
  const status = Object.values(TaskStatus).includes(input.status as TaskStatus) ? input.status as TaskStatus : undefined;
  const priority = Object.values(TaskPriority).includes(input.priority as TaskPriority) ? input.priority as TaskPriority : undefined;
  const q = input.q?.trim().slice(0, 100) || undefined;
  const serviceId = input.serviceId?.trim().slice(0, 191) || undefined;

  const scope = user.role !== UserRole.WORKER
    ? { project: { studioId: studio!.context.studioId } }
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

  const serviceFilter = serviceId
    ? { services: { some: { serviceId } } }
    : {};

  const where = {
    ...scope,
    ...assignmentFilter,
    deletedAt: null,
    ...searchFilter,
    ...serviceFilter,
    ...(taskId ? { id: taskId } : {}),
    ...(!taskId && user.role !== UserRole.WORKER && status ? { status } : {}),
    ...(!taskId && priority ? { priority } : {}),
  };

  const total = await prisma.task.count({ where });
  const totalPages = getPageCount(total);
  const page = Math.min(Math.max(1, input.page ?? 1), totalPages);

  const taskSelect = {
    id: true, title: true, description: true, type: true, workDate: true, status: true, priority: true,
    startAt: true, dueAt: true, completedAt: true, createdAt: true, updatedAt: true, projectId: true,
    project: {
      select: {
        id: true,
        name: true,
        client: { select: { id: true, name: true, image: true } },
        creativeBriefs: {
          select: { tags: true },
          take: 1,
        },
      },
    },
    assignees: {
      select: {
        userId: true,
        status: true,
        submittedAt: true,
        managerNote: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    },
    specializations: { select: { specialization: true } },
    services: { select: { service: { select: { id: true, name: true } } } },
    deliverables: {
      select: {
        id: true,
        type: true,
        name: true,
        fileUrl: true,
        fileSize: true,
        mimeType: true,
        version: true,
        createdAt: true,
        uploadedBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" as const },
    },
    comments: {
      select: {
        id: true,
        body: true,
        createdAt: true,
        author: { select: { id: true, name: true, image: true, role: true } },
      },
      orderBy: { createdAt: "asc" as const },
    },
    ratings: {
      select: {
        id: true,
        score: true,
        feedback: true,
      },
    },
    revisions: {
      select: {
        id: true,
        cause: true,
        description: true,
        createdAt: true,
        requestedBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { createdAt: "desc" as const },
    },
  } satisfies Prisma.TaskSelect;

  const [rows, counts] = await Promise.all([
    prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: DEFAULT_PAGE_SIZE,
      skip: (page - 1) * DEFAULT_PAGE_SIZE,
      select: taskSelect,
    }),
    user.role !== UserRole.WORKER
      ? prisma.task.groupBy({ by: ["status"], where: { ...scope, deletedAt: null }, _count: { _all: true } })
      : prisma.taskAssignee.groupBy({ by: ["status"], where: { userId: user.id, task: { deletedAt: null } }, _count: { _all: true } }),
  ]);

  const formatTask = (task: typeof rows[number]) => ({
    ...task,
    project: {
      ...task.project,
      client: task.project.client?.name
        ? {
            id: task.project.client.id,
            name: cleanClientName(task.project.client.name),
            image: task.project.client.image,
          }
        : null,
      program: task.project.creativeBriefs?.[0]?.tags?.[0] || "No program",
    },
    assignees: task.assignees.map((assignment) => ({
      ...assignment,
      managerNote:
        user.role !== UserRole.WORKER || assignment.userId === user.id
          ? assignment.managerNote
          : null,
      isCurrentUser: assignment.userId === user.id,
    })),
    myStatus:
      task.assignees.find((assignment) => assignment.userId === user.id)?.status ?? null,
    services: task.services.map((item) => item.service),
    deliverablesCount:
      task.deliverables?.filter((d) => d.type === "OUTPUT").length ?? 0,
    attachmentsCount:
      task.deliverables?.filter((d) => d.type === "INPUT").length ?? 0,
    commentsCount: task.comments?.length ?? 0,
  });

  const tasks = rows.map(formatTask);

  return {
    tasks,
    boardTasks: tasks,
    page,
    total,
    totalPages,
    counts: Object.fromEntries(counts.map((row) => [row.status, row._count._all])) as Partial<Record<TaskStatus, number>>,
    currentUserId: current.id,
  };
}

export type TasksPageData = Awaited<ReturnType<typeof getTasks>>;

export async function getTaskFormOptions() {
  const current = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = current.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.TASKS);
  const user = current.role === UserRole.WORKER ? current : { ...current, id: studio!.context.ownerUserId };
  if (user.role !== UserRole.WORKER) {
    const [projects, workers, services] = await Promise.all([
      prisma.project.findMany({
        where: { studioId: studio!.context.studioId },
        orderBy: { name: "asc" }, take: 100,
        select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true } } },
      }),
      prisma.user.findMany({ where: { role: UserRole.WORKER, status: UserStatus.ACTIVE, acceptedInvitation: { is: { studioId: studio!.context.studioId } } }, orderBy: [{ name: "asc" }, { email: "asc" }], take: 100, select: { id: true, name: true, email: true, image: true, preferences: { select: { workerAvailability: true } } } }),
      prisma.studioService.findMany({ where: { studioId: studio!.context.studioId, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
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
      services,
    };
  }
  const [projects, services] = await Promise.all([prisma.project.findMany({
    where: { tasks: { some: { type: TaskType.ASSIGNED, deletedAt: null, assignees: { some: { userId: user.id } } } } },
    orderBy: { name: "asc" }, take: 100,
    select: { id: true, name: true, clientId: true, client: { select: { id: true, name: true } } },
  }), prisma.studioService.findMany({ where: { tasks: { some: { task: { assignees: { some: { userId: user.id } } } } }, isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } })]);
  return {
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      clientName: cleanClientName(p.client?.name),
    })),
    clients: [],
    workers: [],
    services,
  };
}

export async function getDeletedTasks(input: {
  page?: number;
  search?: string;
  projectId?: string;
  priority?: string;
} = {}) {
  const { context } = await requireStudioArea(StudioArea.DELETED_TASKS);
  const managerId = context.ownerUserId;
  const search = input.search?.trim().slice(0, 120) ?? "";
  const projectId = input.projectId && input.projectId !== "ALL" ? input.projectId : undefined;
  const priority = Object.values(TaskPriority).includes(input.priority as TaskPriority)
    ? input.priority as TaskPriority
    : undefined;
  const where: Prisma.TaskWhereInput = {
    deletedAt: { not: null },
    project: {
      studioId: context.studioId,
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
    project: { studioId: context.studioId },
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
      where: { studioId: context.studioId, tasks: { some: { deletedAt: { not: null } } } },
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
      deletedById: deletedBy?.id ?? managerId,
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

export async function getTaskDetails(taskId: string) {
  const current = await requireRole(
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.COLLABORATOR,
    UserRole.WORKER,
    UserRole.CLIENT,
  );
  const isWorker = current.role === UserRole.WORKER;
  const isClient = current.role === UserRole.CLIENT;
  const studio = isWorker || isClient ? null : await requireStudioArea(StudioArea.TASKS);
  const user = isWorker || isClient ? current : { ...current, id: studio!.context.ownerUserId };

  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      deletedAt: null,
      ...(isWorker
        ? { assignees: { some: { userId: user.id } } }
        : isClient
          ? {
              project: {
                OR: [
                  { clientId: user.id },
                  { collaborators: { some: { userId: user.id } } },
                ],
              },
            }
          : { project: { studioId: studio!.context.studioId } }),
    },
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      workDate: true,
      status: true,
      priority: true,
      startAt: true,
      dueAt: true,
      completedAt: true,
      createdAt: true,
      updatedAt: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          client: { select: { id: true, name: true, image: true } },
          creativeBriefs: {
            select: { tags: true },
            take: 1,
          },
        },
      },
      assignees: {
        select: {
          userId: true,
          status: true,
          submittedAt: true,
          managerNote: true,
          user: { select: { id: true, name: true, email: true, image: true } },
        },
      },
      specializations: { select: { specialization: true } },
      services: { select: { service: { select: { id: true, name: true } } } },
      deliverables: {
        select: {
          id: true,
          type: true,
          name: true,
          fileUrl: true,
          fileSize: true,
          mimeType: true,
          version: true,
          createdAt: true,
          uploadedBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" as const },
      },
      comments: {
        select: {
          id: true,
          body: true,
          createdAt: true,
          author: { select: { id: true, name: true, image: true, role: true } },
        },
        orderBy: { createdAt: "asc" as const },
      },
      ratings: {
        select: {
          id: true,
          score: true,
          feedback: true,
          clientId: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" as const },
      },
      revisions: {
        select: {
          id: true,
          cause: true,
          description: true,
          createdAt: true,
          requestedBy: { select: { id: true, name: true, image: true } },
        },
        orderBy: { createdAt: "desc" as const },
      },
    },
  });

  if (!task) return null;

  return {
    task: {
      ...task,
      project: {
        ...task.project,
        client: task.project.client?.name
          ? {
              id: task.project.client.id,
              name: cleanClientName(task.project.client.name),
              image: task.project.client.image,
            }
          : null,
        program: task.project.creativeBriefs?.[0]?.tags?.[0] || "No program",
      },
      assignees: task.assignees.map((assignment) => ({
        ...assignment,
        managerNote:
          user.role !== UserRole.WORKER || assignment.userId === user.id
            ? assignment.managerNote
            : null,
        isCurrentUser: assignment.userId === user.id,
      })),
      myStatus:
        task.assignees.find((assignment) => assignment.userId === user.id)?.status ?? null,
      services: task.services.map((item) => item.service),
      deliverablesCount:
        task.deliverables?.filter((d) => d.type === "OUTPUT").length ?? 0,
      attachmentsCount:
        task.deliverables?.filter((d) => d.type === "INPUT").length ?? 0,
      commentsCount: task.comments?.length ?? 0,
    },
    currentUserRole: current.role,
    currentUserId: current.id,
  };
}

export type TaskDetailsData = NonNullable<Awaited<ReturnType<typeof getTaskDetails>>>;
