import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getClientFeedbackData } from "@/lib/feedback";
import { FeedbackWorkspace } from "@/components/feedback/feedback-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getClientFeedbackRouteData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireRole(UserRole.CLIENT);
    const data = await getClientFeedbackData(params);
    const feedbackId = typeof params.feedbackId === "string" ? params.feedbackId : undefined;
    return { data, feedbackId };
  });

export const Route = createFileRoute("/_workspace/client/project-feedback")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getClientFeedbackRouteData({ data: deps }),
  head: () => ({
    meta: [{ title: "Project Feedback | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="feedback" label="Loading project feedback" />,
  component: ClientProjectFeedbackRouteComponent,
});

function ClientProjectFeedbackRouteComponent() {
  const { data, feedbackId } = Route.useLoaderData();
  return (
    <FeedbackWorkspace
      key={feedbackId ?? "feedback-list"}
      initialData={data}
      roleView="CLIENT"
    />
  );
}
