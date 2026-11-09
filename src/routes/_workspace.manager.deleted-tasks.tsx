import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getDeletedTasks } from "@/lib/tasks";
import { parseDeletedTaskQuery } from "@/lib/validation/queries";
import { DeletedTasksView } from "@/components/tasks/deleted-tasks-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerDeletedTasksData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireStudioArea(StudioArea.DELETED_TASKS);
    const filters = parseDeletedTaskQuery(params);
    const data = await getDeletedTasks({
      page: filters.page,
      search: filters.query,
      projectId: filters.project,
      priority: filters.priority,
    });
    return { data, params };
  });

export const Route = createFileRoute("/_workspace/manager/deleted-tasks")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerDeletedTasksData({ data: deps }),
  head: () => ({
    meta: [{ title: "Deleted Tasks | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="tasks" label="Loading deleted tasks" />,
  component: ManagerDeletedTasksRouteComponent,
});

function ManagerDeletedTasksRouteComponent() {
  const { data, params } = Route.useLoaderData();
  return (
    <DeletedTasksView
      key={JSON.stringify(params)}
      initialData={data}
      searchParams={params}
    />
  );
}

