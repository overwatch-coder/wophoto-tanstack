import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { parseTaskQuery } from "@/lib/validation/queries";
import { getTaskFormOptions, getTasks } from "@/lib/tasks";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerTasksData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireStudioArea(StudioArea.TASKS);
    const filters = parseTaskQuery(params);

    if (filters.taskId) {
      throw redirect({
        to: "/manager/tasks/$taskId",
        params: { taskId: filters.taskId },
      });
    }

    const [initialData, options] = await Promise.all([
      getTasks({
        page: filters.page,
        status: filters.status,
        priority: filters.priority,
        taskId: filters.taskId,
        q: filters.query,
        serviceId: filters.serviceId,
      }),
      getTaskFormOptions(),
    ]);

    return {
      initialData,
      options,
      searchParams: {
        status: filters.status ?? "ALL",
        priority: filters.priority ?? "ALL",
        serviceId: filters.serviceId ?? "ALL",
        q: filters.query ?? "",
        ...(filters.taskId ? { taskId: filters.taskId, taskAction: filters.taskAction } : {}),
      },
    };
  });

export const Route = createFileRoute("/_workspace/manager/tasks/")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => {
    return getManagerTasksData({ data: deps });
  },
  head: () => ({
    meta: [{ title: "Tasks Workspace | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="tasks" label="Loading tasks" />,
  component: ManagerTasksRouteComponent,
});

function ManagerTasksRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <TasksWorkspace
      role="MANAGER"
      initialData={data.initialData}
      options={data.options}
      searchParams={data.searchParams}
    />
  );
}

