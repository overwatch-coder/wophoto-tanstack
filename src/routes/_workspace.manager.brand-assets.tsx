import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getBrandAssets } from "@/lib/brand-assets";
import {
  BrandAssetWorkspace,
  type SerializedBrandAsset,
} from "@/components/brand-assets/brand-asset-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerBrandAssetsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const { context } = await requireStudioArea(StudioArea.BRAND_ASSETS);

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
        where: { studioId: context.studioId },
        select: { id: true, name: true, clientId: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const serializedAssets = assetsResult.assets.map(
      (asset) => ({
        ...asset,
        createdAt: asset.createdAt.toISOString(),
        updatedAt: asset.updatedAt.toISOString(),
      })
    );

    return {
      serializedAssets,
      pagination: assetsResult.pagination,
      stats: assetsResult.stats,
      clients,
      projects,
    } as any;
  });

export const Route = createFileRoute("/_workspace/manager/brand-assets")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerBrandAssetsData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Brand Asset Library | WoPhoto" },
      {
        name: "description",
        content:
          "Centralized digital asset management for logos, color palettes, guidelines, and production kits.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading brand assets" />,
  component: ManagerBrandAssetsRouteComponent,
});

function ManagerBrandAssetsRouteComponent() {
  const data = Route.useLoaderData() as any;
  return (
    <BrandAssetWorkspace
      initialAssets={data.serializedAssets}
      pagination={data.pagination}
      stats={data.stats}
      clients={data.clients}
      projects={data.projects}
      canManage={true}
    />
  );
}
