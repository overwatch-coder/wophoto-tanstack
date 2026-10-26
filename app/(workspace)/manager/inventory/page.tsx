import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { StudioArea } from "@/generated/prisma/client"
import { requireStudioArea } from "@/lib/studio-access"
import { getInventoryCatalog, getMaintenanceQueue } from "@/lib/inventory"
import {
  InventoryCatalogView,
  type CatalogItem,
} from "@/components/inventory/inventory-catalog-view"
import type { MaintenanceLogEntry } from "@/components/inventory/maintenance-dialog"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export const metadata = {
  title: "Inventory Management | WoPhoto",
  description:
    "Track, allocate, and maintain studio equipment and creative assets.",
}

export default function ManagerInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading equipment inventory"
        />
      }
    >
      <ManagerInventoryContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerInventoryContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await requireStudioArea(StudioArea.INVENTORY)
  const params = await searchParams

  const search = typeof params.search === "string" ? params.search : undefined
  const category =
    typeof params.category === "string" ? params.category : undefined
  const status = typeof params.status === "string" ? params.status : undefined
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1

  const [catalog, maintenanceQueue] = await Promise.all([
    getInventoryCatalog({
      search,
      category,
      status,
      page: isNaN(page) ? 1 : page,
    }),
    getMaintenanceQueue(),
  ])

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
  )
}
