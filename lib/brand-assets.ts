
import {
  Prisma,
  BrandAssetType,
  UserRole,
} from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { requireStudioArea } from "@/lib/studio-access";
import { StudioArea } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getBrandAssetsQuerySchema,
} from "@/lib/validation/brand-assets";

export type BrandAssetWithRelations = Prisma.BrandAssetGetPayload<{
  include: {
    client: { select: { id: true; name: true; email: true } };
    project: { select: { id: true; name: true } };
    createdBy: { select: { id: true; name: true; email: true; image: true } };
  };
}>;

export interface BrandAssetsResult {
  assets: BrandAssetWithRelations[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  stats: {
    total: number;
    logos: number;
    colorPalettes: number;
    typography: number;
    guidelines: number;
    mediaReference: number;
    templates: number;
  };
}

export async function getBrandAssets(
  rawQuery?: Record<string, unknown>
): Promise<BrandAssetsResult> {
  // Enforce access: Managers and Workers only
  const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = user.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.BRAND_ASSETS);

  const parsed = getBrandAssetsQuerySchema.safeParse(rawQuery ?? {});
  const query = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 24,
        scope: "ALL" as const,
        search: "",
        clientId: null,
        projectId: null,
        assetType: null,
      };

  const filters: Prisma.BrandAssetWhereInput[] = user.role === UserRole.WORKER ? [] : [{ studioId: studio!.context.studioId }];
  if (query.projectId) filters.push({ projectId: query.projectId });
  if (query.clientId) filters.push({ clientId: query.clientId });
  if (query.scope === "STUDIO") filters.push({ clientId: null, projectId: null });
  else if (query.scope === "CLIENT") filters.push({ clientId: { not: null } });
  else if (query.scope === "PROJECT") filters.push({ projectId: { not: null } });

  const baseWhere: Prisma.BrandAssetWhereInput = { AND: filters };
  const where: Prisma.BrandAssetWhereInput = { ...baseWhere };
  if (query.assetType && Object.values(BrandAssetType).includes(query.assetType as BrandAssetType)) {
    where.assetType = query.assetType as BrandAssetType;
  }

  // Search filter across title, description, and tags array
  if (query.search && query.search.trim() !== "") {
    const searchLower = query.search.trim().replace(/^#/, "").toLowerCase();
    const searchRaw = query.search.trim();

    where.AND = [
      ...filters,
      {
        OR: [
          { title: { contains: searchRaw, mode: Prisma.QueryMode.insensitive } },
          { description: { contains: searchRaw, mode: Prisma.QueryMode.insensitive } },
          { tags: { has: searchLower } },
        ],
      },
    ];
  }

  const total = await prisma.brandAsset.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const skip = (page - 1) * query.pageSize;
  const take = query.pageSize;

  const [assets, typeCounts] = await Promise.all([
    prisma.brandAsset.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        client: { select: { id: true, name: true, email: true } },
        project: { select: { id: true, name: true } },
        createdBy: {
          select: { id: true, name: true, email: true, image: true },
        },
      },
    }),
    prisma.brandAsset.groupBy({
      by: ["assetType"],
      where: baseWhere,
      _count: {
        _all: true,
      },
    }),
  ]);

  const statsMap: Record<string, number> = {};
  let totalAcrossTypes = 0;
  for (const group of typeCounts) {
    statsMap[group.assetType] = group._count._all;
    totalAcrossTypes += group._count._all;
  }

  const stats = {
    total: totalAcrossTypes,
    logos: statsMap[BrandAssetType.LOGO] || 0,
    colorPalettes: statsMap[BrandAssetType.COLOR_PALETTE] || 0,
    typography: statsMap[BrandAssetType.TYPOGRAPHY] || 0,
    guidelines: statsMap[BrandAssetType.GUIDELINE] || 0,
    mediaReference: statsMap[BrandAssetType.MEDIA_REFERENCE] || 0,
    templates: statsMap[BrandAssetType.TEMPLATE] || 0,
  };

  return {
    assets,
    pagination: {
      total,
      page,
      pageSize: query.pageSize,
      totalPages,
    },
    stats,
  };
}

export async function getBrandAssetById(id: string) {
  const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR, UserRole.WORKER);
  const studio = user.role === UserRole.WORKER ? null : await requireStudioArea(StudioArea.BRAND_ASSETS);

  return prisma.brandAsset.findFirst({
    where: { id, ...(user.role === UserRole.WORKER ? {} : { studioId: studio!.context.studioId }) },
    include: {
      client: { select: { id: true, name: true, email: true } },
      project: { select: { id: true, name: true } },
      createdBy: {
        select: { id: true, name: true, email: true, image: true },
      },
    },
  });
}
