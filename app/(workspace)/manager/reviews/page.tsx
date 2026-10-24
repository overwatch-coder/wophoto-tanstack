import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { getManagerFeedbackData } from "@/lib/feedback"
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export const metadata = {
  title: "Client Reviews & Requests | WoPhoto",
}

export default function ManagerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="feedback" label="Loading reviews" />
      }
    >
      <ManagerReviewsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerReviewsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await requireRole(UserRole.MANAGER)
  const data = await getManagerFeedbackData(await searchParams)

  return <FeedbackWorkspace initialData={data} roleView="MANAGER" />
}
