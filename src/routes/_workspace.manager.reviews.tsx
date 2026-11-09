import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getManagerFeedbackData } from "@/lib/feedback";
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerReviewsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireStudioArea(StudioArea.REVIEWS);
    const data = await getManagerFeedbackData(params);
    const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined;
    return { data, feedbackId };
  });

export const Route = createFileRoute("/_workspace/manager/reviews")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerReviewsData({ data: deps }),
  head: () => ({
    meta: [{ title: "Client Reviews & Requests | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading reviews" />,
  component: ManagerReviewsRouteComponent,
});

function ManagerReviewsRouteComponent() {
  const { data, feedbackId } = Route.useLoaderData();
  return (
    <FeedbackWorkspace
      key={feedbackId ?? "feedback-list"}
      initialData={data}
      roleView="MANAGER"
    />
  );
}

