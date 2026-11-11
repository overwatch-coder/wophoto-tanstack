import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getInventoryCatalog, getMaintenanceQueue } from "@/lib/inventory";
import {
  InventoryCatalogView,
  type CatalogItem,
} from "@/components/inventory/inventory-catalog-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import type { MaintenanceLogEntry } from "@/components/inventory/maintenance-dialog";

const getManagerInventoryData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireStudioArea(StudioArea.INVENTORY);

    const search = typeof params.search === "string" ? params.search : undefined;
    const category = typeof params.category === "string" ? params.category : undefined;
    const status = typeof params.status === "string" ? params.status : undefined;
    const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1;

    const [catalog, maintenanceQueue] = await Promise.all([
      getInventoryCatalog({
        search,
        category,
        status,
        page: isNaN(page) ? 1 : page,
      }),
      getMaintenanceQueue(),
    ]);

    return {
      catalog,
      maintenanceQueue: maintenanceQueue.map((log) => ({
        ...log,
        cost: log.cost === null ? null : Number(log.cost),
      })),
    };
  });

export const Route = createFileRoute("/_workspace/manager/inventory")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerInventoryData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Inventory Management | WoPhoto" },
      {
        name: "description",
        content: "Track, allocate, and maintain studio equipment and creative assets.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading inventory" />,
  component: ManagerInventoryRouteComponent,
});

function ManagerInventoryRouteComponent() {
  const { catalog, maintenanceQueue } = Route.useLoaderData();
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
        isManager={true}
        maintenanceQueue={maintenanceQueue as unknown as MaintenanceLogEntry[]}
      />
    </div>
  );
}
