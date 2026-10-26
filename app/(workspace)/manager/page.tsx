import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { StudioArea } from "@/generated/prisma/client"
import { requireStudioArea } from "@/lib/studio-access"
import { getManagerAnalytics } from "@/lib/analytics"
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard"
import { parsePage } from "@/lib/pagination"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export default function ManagerDashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="dashboard"
          label="Loading manager dashboard"
        />
      }
    >
      <ManagerDashboardContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerDashboardContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await requireStudioArea(StudioArea.DASHBOARD)
  const params = await searchParams
  const rawPage = Array.isArray(params.page) ? params.page[0] : params.page
  const data = await getManagerAnalytics(parsePage(rawPage))

  return <ManagerDashboard data={data} />
}
