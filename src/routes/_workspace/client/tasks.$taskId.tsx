import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getTaskDetails } from "@/lib/tasks";
import { TaskDetailsView } from "@/components/tasks/task-details-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getClientTaskDetailsData = createServerFn({ method: "GET" })
  .validator((taskId: string) => taskId)
  .handler(async ({ data: taskId }) => {
    await requireRole(UserRole.CLIENT);
    const taskData = await getTaskDetails(taskId);

    if (!taskData) {
      throw redirect({ to: "/client/projects" });
    }

    return taskData;
  });

export const Route = createFileRoute("/_workspace/client/tasks/$taskId")({
  loader: ({ params }) => getClientTaskDetailsData({ data: params.taskId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.task.title || "Task Details"} | WoPhoto` }],
  }),
  pendingComponent: () => (
    <PageLoadingSkeleton variant="tasks" label="Loading task details" />
  ),
  component: ClientProjectTaskDetailsRouteComponent,
});

function ClientProjectTaskDetailsRouteComponent() {
  const data = Route.useLoaderData();

  return (
    <TaskDetailsView
      data={data}
      backUrl={`/client/projects/${data.task.projectId}`}
      backLabel="Back to Project"
    />
  );
}
