import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getStudioIdForUser } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getBrandAssets } from "@/lib/brand-assets";
import { BrandAssetWorkspace } from "@/components/brand-assets/brand-asset-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerBrandAssetsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const user = await requireRole(UserRole.WORKER);
    const studioId = await getStudioIdForUser(user.id, user.role);

    const search = typeof params.search === "string" ? params.search : "";
    const assetType = typeof params.type === "string" ? params.type : undefined;
    const scope = typeof params.scope === "string" ? params.scope : undefined;
    const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

    const studioScope = studioId ?? "__missing_studio__";
    const [assetsResult, clients, projects] = await Promise.all([
      getBrandAssets({
        search,
        assetType,
        scope,
        page: isNaN(page) ? 1 : page,
        pageSize: 24,
        studioId: studioScope,
      }),
      prisma.user.findMany({
        where: {
          role: UserRole.CLIENT,
          status: UserStatus.ACTIVE,
          acceptedInvitation: { is: { studioId: studioScope } },
        },
        select: { id: true, name: true, email: true },
        orderBy: { name: "asc" },
      }),
      prisma.project.findMany({
        where: { studioId: studioScope },
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
    };
  });

export const Route = createFileRoute("/_workspace/worker/brand-assets")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWorkerBrandAssetsData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Brand Asset Library | WoPhoto" },
      {
        name: "description",
        content:
          "Explore studio guidelines, client vectors, typography packages, and color palettes for production tasks.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading brand assets" />,
  component: WorkerBrandAssetsRouteComponent,
});

function WorkerBrandAssetsRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <BrandAssetWorkspace
      initialAssets={data.serializedAssets}
      pagination={data.pagination}
      stats={data.stats}
      clients={data.clients}
      projects={data.projects}
      canManage={false}
    />
  );
}
