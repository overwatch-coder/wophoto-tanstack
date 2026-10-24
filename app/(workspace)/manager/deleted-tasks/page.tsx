import { Suspense } from "react";
import { getDeletedTasks } from "@/lib/tasks";
import { parsePage } from "@/lib/pagination";
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
  const data = await getDeletedTasks({
    page: parsePage(first(params.page)),
    search: first(params.q),
    projectId: first(params.project),
    priority: first(params.priority),
  });
  return (
    <DeletedTasksView
      key={JSON.stringify(params)}
      initialData={data}
      searchParams={params}
    />
  );
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;
