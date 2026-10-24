import { Suspense } from "react"
import { UserRole } from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { getClientAnalytics } from "@/lib/analytics"
import { ClientDashboard } from "@/components/dashboard/client-dashboard"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export default function ClientWorkspacePage() {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="dashboard"
          label="Loading client dashboard"
        />
      }
    >
      <ClientWorkspaceContent />
    </Suspense>
  )
}

async function ClientWorkspaceContent() {
  await requireRole(UserRole.CLIENT)
  const data = await getClientAnalytics()

  return <ClientDashboard data={data} />
}
