import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { StudioArea } from "@/generated/prisma/client"
import { requireStudioArea } from "@/lib/studio-access"
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
  await requireStudioArea(StudioArea.REVIEWS)
  const params = await searchParams
  const data = await getManagerFeedbackData(params)
  const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined

  return <FeedbackWorkspace key={feedbackId ?? "feedback-list"} initialData={data} roleView="MANAGER" />
}
