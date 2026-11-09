import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { parseTaskQuery } from "@/lib/validation/queries";
import { getTaskFormOptions, getTasks } from "@/lib/tasks";
import { TasksWorkspace } from "@/components/tasks/tasks-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerTasksData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireRole(UserRole.WORKER);
    const filters = parseTaskQuery(params);

    if (filters.taskId) {
      throw redirect({
        to: "/worker/tasks/$taskId",
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

export const Route = createFileRoute("/_workspace/worker/tasks/")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWorkerTasksData({ data: deps }),
  head: () => ({
    meta: [{ title: "My Tasks | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="tasks" label="Loading tasks" />,
  component: WorkerTasksRouteComponent,
});

function WorkerTasksRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <TasksWorkspace
      role="WORKER"
      initialData={data.initialData}
      options={data.options}
      searchParams={data.searchParams}
    />
  );
}

