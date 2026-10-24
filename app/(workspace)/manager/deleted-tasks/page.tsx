import { Suspense } from "react";
import { getDeletedTasks } from "@/lib/tasks";
import { parseDeletedTaskQuery } from "@/lib/validation/queries";
import { DeletedTasksView } from "@/components/tasks/deleted-tasks-view";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

type SearchParams = Record<string, string | string[] | undefined>;

export default function ManagerDeletedTasksPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="tasks" label="Loading deleted tasks" />}
    >
      <ManagerDeletedTasksContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ManagerDeletedTasksContent({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const filters = parseDeletedTaskQuery(params);
  const data = await getDeletedTasks({
    page: filters.page,
    search: filters.query,
    projectId: filters.project,
    priority: filters.priority,
  });
  return (
    <DeletedTasksView
      key={JSON.stringify(params)}
      initialData={data}
      searchParams={params}
    />
  );
}
