import { Suspense } from "react"
import { connection } from "next/server"
import { UserRole } from "@/generated/prisma/client"
import { requireRole } from "@/lib/authz"
import { getClientFeedbackData } from "@/lib/feedback"
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export const metadata = {
  title: "Project Feedback | WoPhoto",
}

export default function ClientProjectFeedbackPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="feedback"
          label="Loading project feedback"
        />
      }
    >
      <ClientFeedbackContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ClientFeedbackContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection()
  await requireRole(UserRole.CLIENT)
  const params = await searchParams
  const data = await getClientFeedbackData(params)
  const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined

  return <FeedbackWorkspace key={feedbackId ?? "feedback-list"} initialData={data} roleView="CLIENT" />
}
