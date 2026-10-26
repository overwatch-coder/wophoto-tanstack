import "server-only";

import {
  Prisma,
  BriefStatus,
  SignOffStatus,
  UserRole,
} from "@/generated/prisma/client";
import { requireUser } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  getProjectBriefsQuerySchema,
  type ShotItem,
} from "@/lib/validation/briefs";

export interface BriefReadiness {
  totalEnrolled: number;
  signedCount: number;
  waivedCount: number;
  pendingCount: number;
  percentage: number;
  isReady: boolean;
}

export interface BriefShotStats {
  total: number;
  completed: number;
  inProgress: number;
  skipped: number;
  planned: number;
  percentage: number;
}

export function computeShotStats(shotList: unknown): BriefShotStats {
  if (!Array.isArray(shotList) || shotList.length === 0) {
    return {
      total: 0,
      completed: 0,
      inProgress: 0,
      skipped: 0,
      planned: 0,
      percentage: 0,
    };
  }

  const shots = shotList as ShotItem[];
  const total = shots.length;
  let completed = 0;
  let inProgress = 0;
  let skipped = 0;
  let planned = 0;

  for (const s of shots) {
    if (s.status === "COMPLETED") completed++;
    else if (s.status === "IN_PROGRESS") inProgress++;
    else if (s.status === "SKIPPED") skipped++;
    else planned++;
  }

  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { total, completed, inProgress, skipped, planned, percentage };
}

export async function getProjectBriefs(rawQuery?: Record<string, unknown>) {
  const user = await requireUser();
  const parsed = getProjectBriefsQuerySchema.safeParse(rawQuery ?? {});
  const query = parsed.success
    ? parsed.data
    : { projectName: null, status: null, search: "", page: 1 };

  const where: Prisma.CreativeBriefWhereInput = {};
  const appendAnd = (condition: Prisma.CreativeBriefWhereInput) => {
    const existing = Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : [];
    where.AND = [...existing, condition];
  };

  // Role based filtering
  if (user.role === UserRole.CLIENT) {
    where.project = { clientId: user.id };
    where.AND = [{ status: { not: BriefStatus.DRAFT } }];
  } else if (user.role === UserRole.WORKER) {
    where.AND = [
      { status: { not: BriefStatus.DRAFT } },
      { OR: [
      {
        project: {
          tasks: {
            some: {
              assignees: {
                some: { userId: user.id },
              },
            },
          },
        },
      },
      {
        signOffs: {
          some: { userId: user.id },
        },
      },
      ] },
    ];
  } else if (user.role === UserRole.MANAGER) {
    where.project = { managerId: user.id };
  }

  if (query.projectName) {
    appendAnd({ project: { is: { name: query.projectName } } });
  }

  if (
    query.status &&
    Object.values(BriefStatus).includes(query.status as BriefStatus)
  ) {
    appendAnd({ status: query.status as BriefStatus });
  }

  if (query.search && query.search.trim() !== "") {
    const searchRaw = query.search.trim();
    const searchLower = searchRaw.toLowerCase();

    appendAnd({
      OR: [
        { title: { contains: searchRaw, mode: Prisma.QueryMode.insensitive } },
        { summary: { contains: searchRaw, mode: Prisma.QueryMode.insensitive } },
        { tags: { has: searchLower } },
      ],
    });
  }

  const pageSize = 12;
  const total = await prisma.creativeBrief.count({ where });
  const page = Math.min(query.page, Math.max(1, Math.ceil(total / pageSize)));
  const briefs = await prisma.creativeBrief.findMany({
    where,
    skip: (page - 1) * pageSize,
    take: pageSize,
    orderBy: [
      { isPrimary: "desc" },
      { createdAt: "desc" },
    ],
    include: {
      project: { select: { id: true, name: true, clientId: true } },
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
      signOffs: {
        orderBy: [{ version: "desc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          waivedBy: { select: { id: true, name: true, email: true } },
        },
      },
      questions: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true, role: true },
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: { id: true, name: true, email: true, image: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  const items = briefs.map((b) => {
    // Current version sign-offs
    const currentSignOffs = b.signOffs.filter((s) => s.version === b.version);
    const totalEnrolled = currentSignOffs.length;
    const signedCount = currentSignOffs.filter(
      (s) => s.status === SignOffStatus.SIGNED
    ).length;
    const waivedCount = currentSignOffs.filter(
      (s) => s.status === SignOffStatus.WAIVED
    ).length;
    const pendingCount = totalEnrolled - (signedCount + waivedCount);
    const percentage =
      totalEnrolled > 0
        ? Math.round(((signedCount + waivedCount) / totalEnrolled) * 100)
        : 100;

    const shotStats = computeShotStats(b.shotList);
    const userSignOff = currentSignOffs.find((s) => s.userId === user.id) || null;

    if (user.role === UserRole.CLIENT) {
      return {
        ...b,
        signOffs: [],
        questions: [],
        readiness: {
          totalEnrolled,
          signedCount,
          waivedCount,
          pendingCount,
          percentage,
          isReady: percentage === 100,
        },
        shotStats,
        userSignOff: null,
      };
    }

    return {
      ...b,
      readiness: {
        totalEnrolled,
        signedCount,
        waivedCount,
        pendingCount,
        percentage,
        isReady: percentage === 100,
      },
      shotStats,
      userSignOff,
    };
  });
  return { briefs: items, total, page, pageSize };
}

export async function workerCanAccessBrief(briefId: string, workerId: string) {
  const brief = await prisma.creativeBrief.findFirst({
    where: {
      id: briefId,
      status: { not: BriefStatus.DRAFT },
      OR: [
        { signOffs: { some: { userId: workerId } } },
        { project: { tasks: { some: { assignees: { some: { userId: workerId } } } } } },
      ],
    },
    select: { id: true },
  });
  return Boolean(brief);
}

export async function managerCanAccessBrief(briefId: string, managerId: string) {
  const brief = await prisma.creativeBrief.findFirst({
    where: { id: briefId, project: { managerId } },
    select: { id: true },
  });
  return Boolean(brief);
}

export async function getBriefDetail(briefId: string) {
  const user = await requireUser();

  const brief = await prisma.creativeBrief.findUnique({
    where: { id: briefId },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          clientId: true,
          managerId: true,
          client: { select: { id: true, name: true, email: true } },
        },
      },
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
      signOffs: {
        orderBy: [{ version: "desc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, name: true, email: true, image: true } },
          waivedBy: { select: { id: true, name: true, email: true } },
        },
      },
      questions: {
        where: { parentId: null },
        orderBy: { createdAt: "desc" },
        include: {
          author: {
            select: { id: true, name: true, email: true, image: true, role: true },
          },
          replies: {
            orderBy: { createdAt: "asc" },
            include: {
              author: {
                select: { id: true, name: true, email: true, image: true, role: true },
              },
            },
          },
        },
      },
    },
  });

  if (!brief) {
    return null;
  }

  // Access check
  if (user.role === UserRole.CLIENT) {
    if (brief.project.clientId !== user.id || brief.status === BriefStatus.DRAFT) {
      return null;
    }
  } else if (user.role === UserRole.WORKER) {
    if (!(await workerCanAccessBrief(brief.id, user.id))) {
      return null;
    }
  } else if (user.role === UserRole.MANAGER) {
    if (!(await managerCanAccessBrief(brief.id, user.id))) return null;
  }

  // Compute readiness for active version
  const activeSignOffs = brief.signOffs.filter((s) => s.version === brief.version);
  const totalEnrolled = activeSignOffs.length;
  const signedCount = activeSignOffs.filter(
    (s) => s.status === SignOffStatus.SIGNED
  ).length;
  const waivedCount = activeSignOffs.filter(
    (s) => s.status === SignOffStatus.WAIVED
  ).length;
  const pendingCount = totalEnrolled - (signedCount + waivedCount);
  const percentage =
    totalEnrolled > 0
      ? Math.round(((signedCount + waivedCount) / totalEnrolled) * 100)
      : 100;

  const readiness: BriefReadiness = {
    totalEnrolled,
    signedCount,
    waivedCount,
    pendingCount,
    percentage,
    isReady: percentage === 100,
  };

  const shotStats = computeShotStats(brief.shotList);

  const userSignOff = activeSignOffs.find((s) => s.userId === user.id) || null;

  // Client safety filter: hide internal questions & sign-off notes
  if (user.role === UserRole.CLIENT) {
    return {
      ...brief,
      signOffs: [],
      questions: [],
      readiness,
      shotStats,
      userSignOff: null,
    };
  }

  return {
    ...brief,
    readiness,
    shotStats,
    userSignOff,
  };
}
