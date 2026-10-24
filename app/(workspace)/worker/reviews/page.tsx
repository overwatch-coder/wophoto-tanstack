import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getWorkerFeedbackData } from "@/lib/feedback";
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace";

export const metadata = {
  title: "Assigned Reviews & Revisions | WoPhoto",
};

export default function WorkerReviewsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<div className="min-h-96 animate-pulse" />}>
      <WorkerReviewsContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkerReviewsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await connection();
  await requireRole(UserRole.WORKER);
  const params = await searchParams;
  const data = await getWorkerFeedbackData(params);
  const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined;

  return <FeedbackWorkspace key={feedbackId ?? "feedback-list"} initialData={data} roleView="WORKER" />;
}
