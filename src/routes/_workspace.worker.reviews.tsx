import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getWorkerFeedbackData } from "@/lib/feedback";
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerReviewsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireRole(UserRole.WORKER);
    const data = await getWorkerFeedbackData(params);
    const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined;
    return { data, feedbackId };
  });

export const Route = createFileRoute("/_workspace/worker/reviews")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWorkerReviewsData({ data: deps }),
  head: () => ({
    meta: [{ title: "Assigned Reviews & Revisions | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading reviews" />,
  component: WorkerReviewsRouteComponent,
});

function WorkerReviewsRouteComponent() {
  const { data, feedbackId } = Route.useLoaderData();
  return (
    <FeedbackWorkspace
      key={feedbackId ?? "feedback-list"}
      initialData={data}
      roleView="WORKER"
    />
  );
}

