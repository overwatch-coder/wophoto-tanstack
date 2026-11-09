import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getTaskDetails } from "@/lib/tasks";
import { TaskDetailsView } from "@/components/tasks/task-details-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerTaskDetailsData = createServerFn({ method: "GET" })
  .validator((taskId: string) => taskId)
  .handler(async ({ data: taskId }) => {
    await requireRole(UserRole.WORKER);
    const data = await getTaskDetails(taskId);
    if (!data) {
      throw redirect({ to: "/worker/tasks" });
    }
    return data;
  });

export const Route = createFileRoute("/_workspace/worker/tasks/$taskId")({
  loader: ({ params }) => getWorkerTaskDetailsData({ data: params.taskId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.task.title || "Task Details"} | WoPhoto` }],
  }),
  pendingComponent: () => (
    <PageLoadingSkeleton variant="tasks" label="Loading task details" />
  ),
  component: WorkerTaskDetailsRouteComponent,
});

function WorkerTaskDetailsRouteComponent() {
  const data = Route.useLoaderData();
  return <TaskDetailsView data={data} backUrl="/worker/tasks" />;
}
