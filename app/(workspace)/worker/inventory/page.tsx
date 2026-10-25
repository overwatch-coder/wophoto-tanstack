import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { getInventoryCatalog } from "@/lib/inventory"
import {
  InventoryCatalogView,
  type CatalogItem,
} from "@/components/inventory/inventory-catalog-view"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export const metadata = {
  title: "Studio Gear & Inventory | WoPhoto",
  description: "Check out studio equipment, workstations, and creative tools.",
}

export default function WorkerInventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="basic" label="Loading studio gear" />
      }
    >
      <WorkerInventoryContent searchParams={searchParams} />
    </Suspense>
  )
}

async function WorkerInventoryContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await requireRole(UserRole.WORKER)
  const params = await searchParams

  const search = typeof params.search === "string" ? params.search : undefined
  const category =
    typeof params.category === "string" ? params.category : undefined
  const status = typeof params.status === "string" ? params.status : undefined
  const page = typeof params.page === "string" ? parseInt(params.page, 10) : 1

  const catalog = await getInventoryCatalog({
      search,
      category,
      status,
      page: isNaN(page) ? 1 : page,
    })

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
  )
}
