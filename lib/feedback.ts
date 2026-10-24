import "server-only";

import {
  FeedbackStatus,
  FeedbackType,
  Prisma,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { DEFAULT_PAGE_SIZE, OPTION_PAGE_SIZE, getPageCount, parsePage, type SearchParamsRecord } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

export type FeedbackFilterState = {
  page: number;
  query: string;
  status: "ALL" | "OPEN" | "DELEGATED" | "RESOLVED";
  type: "ALL" | FeedbackType;
  projectId: string;
};

type FeedbackLoaderParams = SearchParamsRecord;

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function parseFeedbackFilters(params: FeedbackLoaderParams = {}): FeedbackFilterState {
  const status = firstParam(params.status);
  const type = firstParam(params.type);
  const rawType = Object.values(FeedbackType).includes(type as FeedbackType)
    ? (type as FeedbackType)
    : "ALL";

  return {
    page: parsePage(params.page),
    query: (firstParam(params.q) ?? "").trim().slice(0, 120),
    status: status === "OPEN" || status === "DELEGATED" || status === "RESOLVED"
      ? status
      : "ALL",
    type: rawType,
    projectId: (firstParam(params.project) ?? "").slice(0, 100),
  };
}

function buildFeedbackWhere(
  scope: Prisma.ClientFeedbackWhereInput,
  filters: FeedbackFilterState,
): Prisma.ClientFeedbackWhereInput {
  const clauses: Prisma.ClientFeedbackWhereInput[] = [scope];

  if (filters.status === "OPEN") {
    clauses.push({ status: { not: FeedbackStatus.RESOLVED } });
  } else if (filters.status === "DELEGATED") {
    clauses.push({ status: FeedbackStatus.ASSIGNED_TO_WORKER });
  } else if (filters.status === "RESOLVED") {
    clauses.push({ status: FeedbackStatus.RESOLVED });
  }

  if (filters.type !== "ALL") clauses.push({ type: filters.type });
  if (filters.projectId && filters.projectId !== "ALL") {
    clauses.push({ projectId: filters.projectId });
  }

  if (filters.query) {
    clauses.push({
      OR: [
        { title: { contains: filters.query, mode: "insensitive" } },
        { details: { contains: filters.query, mode: "insensitive" } },
        { project: { name: { contains: filters.query, mode: "insensitive" } } },
        { task: { title: { contains: filters.query, mode: "insensitive" } } },
        { client: { name: { contains: filters.query, mode: "insensitive" } } },
        { client: { email: { contains: filters.query, mode: "insensitive" } } },
        { assignedWorker: { name: { contains: filters.query, mode: "insensitive" } } },
        { respondedBy: { name: { contains: filters.query, mode: "insensitive" } } },
      ],
    });
  }

  return { AND: clauses };
}

async function getFeedbackStats(where: Prisma.ClientFeedbackWhereInput) {
  const [byStatus, actionableByStatus, aggregate, ratings] = await Promise.all([
    prisma.clientFeedback.groupBy({
      by: ["status"],
      where,
      _count: { _all: true },
    }),
    prisma.clientFeedback.groupBy({
      by: ["status"],
      where: { AND: [where, { type: { not: FeedbackType.REVIEW } }] },
      _count: { _all: true },
    }),
    prisma.clientFeedback.aggregate({
      where,
      _count: { _all: true },
    }),
    prisma.clientFeedback.aggregate({
      where: { AND: [where, { type: FeedbackType.REVIEW }] },
      _avg: { score: true },
    }),
  ]);
  const counts = new Map(byStatus.map((row) => [row.status, row._count._all]));
  const actionableCounts = new Map(actionableByStatus.map((row) => [row.status, row._count._all]));
  const total = aggregate._count._all;
  const resolved = counts.get(FeedbackStatus.RESOLVED) ?? 0;

  return {
    total,
    open: total - resolved,
    delegated: actionableCounts.get(FeedbackStatus.ASSIGNED_TO_WORKER) ?? 0,
    inReview: actionableCounts.get(FeedbackStatus.IN_REVIEW) ?? 0,
    resolved,
    avgScore: ratings._avg.score,
  };
}

export type ClientFeedbackViewItem = {
  id: string;
  projectId: string;
  projectName: string;
  taskId?: string;
  taskTitle?: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  clientImage?: string | null;
  type: FeedbackType;
  status: FeedbackStatus;
  score: number | null;
  title: string;
  details: string;
  createdAt: string;
  responseNote?: string | null;
  respondedAt?: string | null;
  respondedByName?: string | null;
  respondedByImage?: string | null;
  assignedWorkerId?: string | null;
  assignedWorkerName?: string | null;
  assignedWorkerEmail?: string | null;
  assignedWorkerImage?: string | null;
  delegationNote?: string | null;
  delegatedAt?: string | null;
  workerNote?: string | null;
  workerSubmittedAt?: string | null;
  taskAssignees?: {
    id: string;
    name: string | null;
    email: string;
    image?: string | null;
  }[];
};

export type FeedbackProjectOption = {
  id: string;
  name: string;
  leadPhotographer: string;
  deliverables: {
    id: string;
    title: string;
    status: string;
    assignees?: {
      id: string;
      name: string | null;
      email: string;
    }[];
  }[];
};

export type WorkerOption = {
  id: string;
  name: string | null;
  email: string;
  image?: string | null;
};

export type FeedbackWorkspaceData = {
  feedbacks: ClientFeedbackViewItem[];
  projects: FeedbackProjectOption[];
  workers?: WorkerOption[];
  role: UserRole;
  filters: FeedbackFilterState;
  page: number;
  totalPages: number;
  totalItems: number;
  searchParams: SearchParamsRecord;
  stats: {
    total: number;
    open: number;
    delegated: number;
    inReview: number;
    resolved: number;
    avgScore: number | null;
  };
};

export async function getClientFeedbackData(
  searchParams: FeedbackLoaderParams = {},
): Promise<FeedbackWorkspaceData> {
  const client = await requireRole(UserRole.CLIENT);
  const filters = parseFeedbackFilters(searchParams);
  const baseWhere: Prisma.ClientFeedbackWhereInput = { clientId: client.id };
  const where = buildFeedbackWhere(baseWhere, filters);

  // Keep request form options bounded. Feedback records are paginated below.
  const projects = await prisma.project.findMany({
    where: { clientId: client.id },
    select: {
      id: true,
      name: true,
      manager: {
        select: {
          name: true,
        },
      },
      tasks: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
        },
        orderBy: { createdAt: "asc" },
        take: OPTION_PAGE_SIZE,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: OPTION_PAGE_SIZE,
  });

  const [totalItems, stats] = await Promise.all([
    prisma.clientFeedback.count({ where }),
    getFeedbackStats(baseWhere),
  ]);
  const totalPages = getPageCount(totalItems);
  const page = Math.min(filters.page, totalPages);

  const feedbacks = await prisma.clientFeedback.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
        },
      },
      assignedWorker: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      respondedBy: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DEFAULT_PAGE_SIZE,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
  });

  const formattedFeedbacks: ClientFeedbackViewItem[] = feedbacks.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    projectName: f.project.name,
    taskId: f.taskId ?? undefined,
    taskTitle: f.task?.title ?? undefined,
    clientId: f.client.id,
    clientName: f.client.name || "Client",
    clientEmail: f.client.email,
    clientImage: f.client.image,
    type: f.type,
    status: f.status,
    score: f.score,
    title: f.title,
    details: f.details,
    createdAt: f.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    responseNote: f.responseNote,
    respondedAt: f.respondedAt
      ? f.respondedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    respondedByName: f.respondedBy?.name || "Studio Lead",
    respondedByImage: f.respondedBy?.image,
    assignedWorkerId: f.assignedWorkerId,
    assignedWorkerName: f.assignedWorker?.name || null,
    assignedWorkerEmail: f.assignedWorker?.email || null,
    assignedWorkerImage: f.assignedWorker?.image || null,
    delegationNote: f.delegationNote,
    delegatedAt: f.delegatedAt
      ? f.delegatedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    workerNote: f.workerNote,
    workerSubmittedAt: f.workerSubmittedAt
      ? f.workerSubmittedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
  }));

  return {
    feedbacks: formattedFeedbacks,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      leadPhotographer: p.manager?.name || "Studio Manager",
      deliverables: p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
      })),
    })),
    role: UserRole.CLIENT,
    filters: { ...filters, page },
    page,
    totalPages,
    totalItems,
    searchParams,
    stats,
  };
}

export async function getManagerFeedbackData(
  searchParams: FeedbackLoaderParams = {},
): Promise<FeedbackWorkspaceData> {
  const manager = await requireRole(UserRole.MANAGER);
  const filters = parseFeedbackFilters(searchParams);
  const baseWhere: Prisma.ClientFeedbackWhereInput = {
    project: { managerId: manager.id },
  };
  const where = buildFeedbackWhere(baseWhere, filters);

  // Keep form and filter options bounded. Feedback records are paginated below.
  const projects = await prisma.project.findMany({
    where: { managerId: manager.id },
    select: {
      id: true,
      name: true,
      tasks: {
        where: { deletedAt: null },
        select: {
          id: true,
          title: true,
          status: true,
          assignees: {
            take: OPTION_PAGE_SIZE,
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
        take: OPTION_PAGE_SIZE,
      },
    },
    orderBy: { updatedAt: "desc" },
    take: OPTION_PAGE_SIZE,
  });

  // Only show workers invited by this manager, and cap the selector options.
  const workers = await prisma.user.findMany({
    where: {
      role: UserRole.WORKER,
      status: UserStatus.ACTIVE,
      acceptedInvitation: { is: { invitedById: manager.id } },
    },
    orderBy: [{ name: "asc" }, { email: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
    },
    take: OPTION_PAGE_SIZE,
  });

  const [totalItems, stats] = await Promise.all([
    prisma.clientFeedback.count({ where }),
    getFeedbackStats(baseWhere),
  ]);
  const totalPages = getPageCount(totalItems);
  const page = Math.min(filters.page, totalPages);

  const feedbacks = await prisma.clientFeedback.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
          assignees: {
            take: OPTION_PAGE_SIZE,
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
        },
      },
      assignedWorker: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      respondedBy: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DEFAULT_PAGE_SIZE,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
  });

  const formattedFeedbacks: ClientFeedbackViewItem[] = feedbacks.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    projectName: f.project.name,
    taskId: f.taskId ?? undefined,
    taskTitle: f.task?.title ?? undefined,
    clientId: f.client.id,
    clientName: f.client.name || "Client",
    clientEmail: f.client.email,
    clientImage: f.client.image,
    type: f.type,
    status: f.status,
    score: f.score,
    title: f.title,
    details: f.details,
    createdAt: f.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    responseNote: f.responseNote,
    respondedAt: f.respondedAt
      ? f.respondedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    respondedByName: f.respondedBy?.name || manager.name || "Studio Lead",
    respondedByImage: f.respondedBy?.image,
    assignedWorkerId: f.assignedWorkerId,
    assignedWorkerName: f.assignedWorker?.name || null,
    assignedWorkerEmail: f.assignedWorker?.email || null,
    assignedWorkerImage: f.assignedWorker?.image || null,
    delegationNote: f.delegationNote,
    delegatedAt: f.delegatedAt
      ? f.delegatedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    workerNote: f.workerNote,
    workerSubmittedAt: f.workerSubmittedAt
      ? f.workerSubmittedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    taskAssignees: f.task?.assignees.map((a) => ({
      id: a.user.id,
      name: a.user.name,
      email: a.user.email,
      image: a.user.image,
    })),
  }));

  return {
    feedbacks: formattedFeedbacks,
    projects: projects.map((p) => ({
      id: p.id,
      name: p.name,
      leadPhotographer: manager.name || "Studio Manager",
      deliverables: p.tasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        assignees: t.assignees.map((a) => ({
          id: a.user.id,
          name: a.user.name,
          email: a.user.email,
        })),
      })),
    })),
    workers,
    role: UserRole.MANAGER,
    filters: { ...filters, page },
    page,
    totalPages,
    totalItems,
    searchParams,
    stats,
  };
}

export async function getWorkerFeedbackData(
  searchParams: FeedbackLoaderParams = {},
): Promise<FeedbackWorkspaceData> {
  const worker = await requireRole(UserRole.WORKER);
  const filters = parseFeedbackFilters(searchParams);

  const baseWhere: Prisma.ClientFeedbackWhereInput = {
    OR: [
      { assignedWorkerId: worker.id },
      { task: { assignees: { some: { userId: worker.id } } } },
    ],
  };
  const where = buildFeedbackWhere(baseWhere, filters);
  const [totalItems, stats] = await Promise.all([
    prisma.clientFeedback.count({ where }),
    getFeedbackStats(baseWhere),
  ]);
  const totalPages = getPageCount(totalItems);
  const page = Math.min(filters.page, totalPages);

  const feedbacks = await prisma.clientFeedback.findMany({
    where,
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      project: {
        select: {
          id: true,
          name: true,
        },
      },
      task: {
        select: {
          id: true,
          title: true,
        },
      },
      assignedWorker: {
        select: {
          id: true,
          name: true,
          email: true,
          image: true,
        },
      },
      respondedBy: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: DEFAULT_PAGE_SIZE,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
  });

  const formattedFeedbacks: ClientFeedbackViewItem[] = feedbacks.map((f) => ({
    id: f.id,
    projectId: f.projectId,
    projectName: f.project.name,
    taskId: f.taskId ?? undefined,
    taskTitle: f.task?.title ?? undefined,
    clientId: f.client.id,
    clientName: f.client.name || "Client",
    clientEmail: f.client.email,
    clientImage: f.client.image,
    type: f.type,
    status: f.status,
    score: f.score,
    title: f.title,
    details: f.details,
    createdAt: f.createdAt.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    responseNote: f.responseNote,
    respondedAt: f.respondedAt
      ? f.respondedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    respondedByName: f.respondedBy?.name || "Studio Lead",
    respondedByImage: f.respondedBy?.image,
    assignedWorkerId: f.assignedWorkerId,
    assignedWorkerName: f.assignedWorker?.name || null,
    assignedWorkerEmail: f.assignedWorker?.email || null,
    assignedWorkerImage: f.assignedWorker?.image || null,
    delegationNote: f.delegationNote,
    delegatedAt: f.delegatedAt
      ? f.delegatedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
    workerNote: f.workerNote,
    workerSubmittedAt: f.workerSubmittedAt
      ? f.workerSubmittedAt.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : null,
  }));

  return {
    feedbacks: formattedFeedbacks,
    projects: [],
    role: UserRole.WORKER,
    filters: { ...filters, page },
    page,
    totalPages,
    totalItems,
    searchParams,
    stats,
  };
}
