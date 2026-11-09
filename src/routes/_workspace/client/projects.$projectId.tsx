import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getProjectWorkspace } from "@/lib/projects";
import { ProjectWorkspace } from "@/components/projects/workspace/project-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getClientProjectWorkspaceData = createServerFn({ method: "GET" })
  .validator((projectId: string) => projectId)
  .handler(async ({ data: projectId }) => {
    return await getProjectWorkspace(projectId);
  });

export const Route = createFileRoute("/_workspace/client/projects/$projectId")({
  loader: ({ params }) => getClientProjectWorkspaceData({ data: params.projectId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.project.name || "Project"} | WoPhoto` }],
  }),
  pendingComponent: () => (
    <PageLoadingSkeleton variant="dashboard" label="Loading project workspace" />
  ),
  component: ClientProjectWorkspaceRouteComponent,
});

function ClientProjectWorkspaceRouteComponent() {
  const data = Route.useLoaderData();
  return <ProjectWorkspace data={data} backUrl="/client/projects" />;
}
