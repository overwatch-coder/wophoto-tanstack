import { Suspense } from "react"
import { notFound } from "next/navigation"

import { ConstructionPage } from "@/components/workspace/construction-page"
import { requireRole } from "@/lib/authz"
import { UserRole } from "@/generated/prisma/client"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

const sectionTitles: Record<string, string> = {
  "brief-review": "Brief Review",
  "explore-briefs": "Explore Briefs",
}

export default function ManagerSectionPage({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="basic" label="Loading workspace page" />
      }
    >
      <ManagerSectionContent params={params} />
    </Suspense>
  )
}

async function ManagerSectionContent({
  params,
}: {
  params: Promise<{ section: string }>
}) {
  const { section } = await params
  const title = sectionTitles[section]
  if (!title) notFound()

  await requireRole(UserRole.MANAGER)
  return <ConstructionPage title={title} />
}
