import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getTaskDetails } from "@/lib/tasks";
import { TaskDetailsView } from "@/components/tasks/task-details-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerTaskDetailsData = createServerFn({ method: "GET" })
  .validator((taskId: string) => taskId)
  .handler(async ({ data: taskId }) => {
    await requireStudioArea(StudioArea.TASKS);
    const data = await getTaskDetails(taskId);
    if (!data) {
      throw redirect({ to: "/manager/tasks" });
    }
    return data;
  });

export const Route = createFileRoute("/_workspace/manager/tasks/$taskId")({
  loader: ({ params }) => getManagerTaskDetailsData({ data: params.taskId }),
  head: ({ loaderData }) => ({
    meta: [{ title: `${loaderData?.task.title || "Task Details"} | WoPhoto` }],
  }),
  pendingComponent: () => (
    <PageLoadingSkeleton variant="tasks" label="Loading task details" />
  ),
  component: ManagerTaskDetailsRouteComponent,
});

function ManagerTaskDetailsRouteComponent() {
  const data = Route.useLoaderData();
  return <TaskDetailsView data={data} backUrl="/manager/tasks" />;
}
