import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getBrandAssets } from "@/lib/brand-assets";
import {
  BrandAssetWorkspace,
  type SerializedBrandAsset,
} from "@/components/brand-assets/brand-asset-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const metadata = {
  title: "Brand Asset Library | WoPhoto",
  description:
    "Centralized digital asset management for logos, color palettes, guidelines, and production kits.",
};

export default function ManagerBrandAssetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading brand asset library"
        />
      }
    >
      <ManagerBrandAssetsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ManagerBrandAssetsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireRole(UserRole.MANAGER);
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : "";
  const assetType = typeof params.type === "string" ? params.type : undefined;
  const scope = typeof params.scope === "string" ? params.scope : undefined;
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

  const [assetsResult, clients, projects] = await Promise.all([
    getBrandAssets({
      search,
      assetType,
      scope,
      page: isNaN(page) ? 1 : page,
      pageSize: 24,
    }),
    prisma.user.findMany({
      where: { role: UserRole.CLIENT, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      where: { managerId: user.id },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedAssets: SerializedBrandAsset[] = assetsResult.assets.map(
    (asset) => ({
      ...asset,
      createdAt: asset.createdAt.toISOString(),
      updatedAt: asset.updatedAt.toISOString(),
    })
  );

  return (
    <BrandAssetWorkspace
      initialAssets={serializedAssets}
      pagination={assetsResult.pagination}
      stats={assetsResult.stats}
      clients={clients}
      projects={projects}
      canManage={true}
    />
  );
}
