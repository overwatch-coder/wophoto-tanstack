import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getInventoryCatalog } from "@/lib/inventory";
import {
  InventoryCatalogView,
  type CatalogItem,
} from "@/components/inventory/inventory-catalog-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerInventoryData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireRole(UserRole.WORKER);

    const search = typeof params.search === "string" ? params.search : undefined;
    const category = typeof params.category === "string" ? params.category : undefined;
    const status = typeof params.status === "string" ? params.status : undefined;
    const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

    const catalog = await getInventoryCatalog({
      search,
      category,
      status,
      page: isNaN(page) ? 1 : page,
    });

    return { catalog };
  });

export const Route = createFileRoute("/_workspace/worker/inventory")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWorkerInventoryData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Studio Gear & Inventory | WoPhoto" },
      {
        name: "description",
        content: "Check out studio equipment, workstations, and creative tools.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading inventory" />,
  component: WorkerInventoryRouteComponent,
});

function WorkerInventoryRouteComponent() {
  const { catalog } = Route.useLoaderData();
  return (
    <div className="container mx-auto max-w-7xl py-6">
      <InventoryCatalogView
        initialItems={catalog.items as unknown as CatalogItem[]}
        checkoutItems={catalog.checkoutItems as unknown as CatalogItem[]}
        pagination={catalog.pagination}
        checkoutPagination={catalog.checkoutPagination}
        activityLogs={catalog.activityLogs}
        activityPagination={catalog.activityPagination}
        stats={catalog.stats}
        currentUser={catalog.currentUser}
        isManager={false}
      />
    </div>
  );
}

