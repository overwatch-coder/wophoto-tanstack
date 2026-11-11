import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { UserRole, BriefTemplateCategory, BriefStatus, Prisma } from "@/generated/prisma/client";
import {
  getBriefTemplatesQuerySchema,
  getStudioBriefArchiveQuerySchema,
  type GetBriefTemplatesQuery,
  type GetStudioBriefArchiveQuery,
} from "@/lib/validation/brief-templates";
import { computeShotStats, type BriefShotStats } from "@/lib/briefs";

export interface SerializedBriefTemplate {
  id: string;
  title: string;
  summary: string | null;
  category: BriefTemplateCategory;
  tags: string[];
  deliverables: string | null;
  guidelines: string | null;
  externalLinks: Array<{ label: string; url: string }> | null;
  shotList: Prisma.JsonValue;
  coverImageUrl: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  usageCount: number;
  isArchived: boolean;
  createdById: string;
  createdBy: {
    id: string;
    name: string | null;
    image: string | null;
  };
  sourceBriefId: string | null;
  sourceBrief?: {
    id: string;
    title: string;
    project: {
      id: string;
      name: string;
    };
  } | null;
  shotStats: BriefShotStats;
  createdAt: string;
  updatedAt: string;
}

export async function getBriefTemplates(rawQuery?: Record<string, unknown>) {
  const user = await requireUser();
  if (!user || user.role === UserRole.CLIENT) {
    throw new Error("Unauthorized: Studio template access is restricted to managers and workers.");
  }

  const isWorker = user.role === UserRole.WORKER;
  const parsed = getBriefTemplatesQuerySchema.safeParse(rawQuery ?? {});
  const query: GetBriefTemplatesQuery = parsed.success
    ? parsed.data
    : { includeArchived: false, page: 1, pageSize: 12 };

  const where: Prisma.BriefTemplateWhereInput = {};
  const andConditions: Prisma.BriefTemplateWhereInput[] = [];

  if (isWorker) {
    andConditions.push({ isArchived: false });
  } else if (!query.includeArchived) {
    andConditions.push({ isArchived: false });
  }

  if (query.category) {
    andConditions.push({ category: query.category });
  }

  if (query.tag) {
    andConditions.push({ tags: { has: query.tag.toLowerCase().trim() } });
  }

  if (query.search && query.search.trim() !== "") {
    const s = query.search.trim();
    andConditions.push({
      OR: [
        { title: { contains: s, mode: "insensitive" } },
        { summary: { contains: s, mode: "insensitive" } },
        { guidelines: { contains: s, mode: "insensitive" } },
        { deliverables: { contains: s, mode: "insensitive" } },
        { tags: { has: s.toLowerCase() } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  const skip = (page - 1) * pageSize;

  const [total, templates, tagRecords] = await Promise.all([
    prisma.briefTemplate.count({ where }),
    prisma.briefTemplate.findMany({
      where,
      include: {
        createdBy: {
          select: { id: true, name: true, image: true },
        },
        sourceBrief: {
          select: {
            id: true,
            title: true,
            project: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: [
        { isArchived: "asc" },
        { usageCount: "desc" },
        { createdAt: "desc" },
      ],
      skip,
      take: pageSize,
    }),
    prisma.$queryRaw<Array<{ tag: string }>>(Prisma.sql`
      SELECT DISTINCT lower(trim(tag)) AS tag
      FROM "BriefTemplate"
      CROSS JOIN LATERAL unnest("tags") AS tag_value(tag)
      WHERE ${isWorker ? Prisma.sql`"isArchived" = false` : Prisma.sql`TRUE`}
        AND trim(tag_value.tag) <> ''
      ORDER BY tag
      LIMIT 100
    `),
  ]);

  const availableTags = tagRecords.map(({ tag }) => tag);

  const serializedTemplates: SerializedBriefTemplate[] = templates.map((t) => ({
    id: t.id,
    title: t.title,
    summary: t.summary,
    category: t.category,
    tags: t.tags,
    deliverables: t.deliverables,
    guidelines: t.guidelines,
    externalLinks: Array.isArray(t.externalLinks)
      ? (t.externalLinks as Array<{ label: string; url: string }>)
      : null,
    shotList: t.shotList,
    coverImageUrl: t.coverImageUrl,
    attachmentUrl: t.attachmentUrl,
    attachmentName: t.attachmentName,
    usageCount: t.usageCount,
    isArchived: t.isArchived,
    createdById: t.createdById,
    createdBy: t.createdBy,
    sourceBriefId: t.sourceBriefId,
    sourceBrief: t.sourceBrief,
    shotStats: computeShotStats(t.shotList),
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }));

  return {
    templates: serializedTemplates,
    total,
    page,
    pageSize,
    availableTags,
  };
}

export interface SerializedStudioBriefArchiveItem {
  id: string;
  title: string;
  summary: string | null;
  status: BriefStatus;
  isPrimary: boolean;
  version: number;
  deliverables: string | null;
  guidelines: string | null;
  shotList: Prisma.JsonValue;
  externalUrl: string | null;
  fileUrl: string | null;
  fileName: string | null;
  tags: string[];
  projectId: string;
  project: {
    id: string;
    name: string;
    client: {
      id: string;
      name: string | null;
      image: string | null;
      email?: string | null;
    } | null;
  };
  createdBy: {
    id: string;
    name: string | null;
    image: string | null;
  };
  templateId: string | null;
  shotStats: BriefShotStats;
  createdAt: string;
  updatedAt: string;
}

export async function getStudioBriefArchive(rawQuery?: Record<string, unknown>) {
  const user = await requireUser();
  if (!user || user.role === UserRole.CLIENT) {
    throw new Error("Unauthorized: Studio brief archive is restricted to managers and workers.");
  }

  const isWorker = user.role === UserRole.WORKER;
  const parsed = getStudioBriefArchiveQuerySchema.safeParse(rawQuery ?? {});
  const query: GetStudioBriefArchiveQuery = parsed.success
    ? parsed.data
    : { page: 1, pageSize: 12 };

  const where: Prisma.CreativeBriefWhereInput = {
    status: { not: BriefStatus.DRAFT },
  };

  const andConditions: Prisma.CreativeBriefWhereInput[] = [];

  if (query.status && query.status !== BriefStatus.DRAFT) {
    andConditions.push({ status: query.status });
  }

  if (query.project) {
    andConditions.push({
      project: { name: { equals: query.project, mode: "insensitive" } },
    });
  }

  // Client filtering available for managers only
  if (!isWorker && query.client) {
    andConditions.push({
      project: {
        client: { name: { equals: query.client, mode: "insensitive" } },
      },
    });
  }

  if (query.search && query.search.trim() !== "") {
    const s = query.search.trim();
    andConditions.push({
      OR: [
        { title: { contains: s, mode: "insensitive" } },
        { summary: { contains: s, mode: "insensitive" } },
        { guidelines: { contains: s, mode: "insensitive" } },
        { deliverables: { contains: s, mode: "insensitive" } },
        { project: { name: { contains: s, mode: "insensitive" } } },
      ],
    });
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  const page = query.page ?? 1;
  const pageSize = query.pageSize ?? 12;
  const skip = (page - 1) * pageSize;

  const [total, briefs] = await Promise.all([
    prisma.creativeBrief.count({ where }),
    prisma.creativeBrief.findMany({
      where,
      include: {
        project: {
          select: {
            id: true,
            name: true,
            client: {
              select: {
                id: true,
                name: true,
                image: true,
                email: true,
              },
            },
          },
        },
        createdBy: {
          select: { id: true, name: true, image: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    }),
  ]);

  const serializedBriefs: SerializedStudioBriefArchiveItem[] = briefs.map((b) => ({
    id: b.id,
    title: b.title,
    summary: b.summary,
    status: b.status,
    isPrimary: b.isPrimary,
    version: b.version,
    deliverables: b.deliverables,
    guidelines: b.guidelines,
    shotList: b.shotList,
    externalUrl: b.externalUrl,
    fileUrl: b.fileUrl,
    fileName: b.fileName,
    tags: b.tags,
    projectId: b.projectId,
    project: {
      id: b.project.id,
      name: b.project.name,
      client: b.project.client
        ? {
            id: b.project.client.id,
            name: b.project.client.name,
            image: b.project.client.image,
            email: isWorker ? null : b.project.client.email,
          }
        : null,
    },
    createdBy: b.createdBy,
    templateId: b.templateId,
    shotStats: computeShotStats(b.shotList),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }));

  return {
    briefs: serializedBriefs,
    total,
    page,
    pageSize,
  };
}

export async function getBriefTemplateDetail(templateId: string) {
  const user = await requireUser();
  if (!user || user.role === UserRole.CLIENT) {
    throw new Error("Unauthorized: Template details restricted.");
  }

  const isWorker = user.role === UserRole.WORKER;

  const template = await prisma.briefTemplate.findUnique({
    where: { id: templateId },
    include: {
      createdBy: {
        select: { id: true, name: true, image: true },
      },
      sourceBrief: {
        select: {
          id: true,
          title: true,
          project: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!template) return null;
  if (isWorker && template.isArchived) return null;

  return {
    ...template,
    shotStats: computeShotStats(template.shotList),
    createdAt: template.createdAt.toISOString(),
    updatedAt: template.updatedAt.toISOString(),
  };
}
