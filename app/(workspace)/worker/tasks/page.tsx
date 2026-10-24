import { Suspense } from "react"
import { UserRole } from "@/generated/prisma/client"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { getTaskFormOptions, getTasks } from "@/lib/tasks"
import { requireRole } from "@/lib/authz"
import { parsePage } from "@/lib/pagination"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export default function WorkerTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="tasks" label="Loading your tasks" />
      }
    >
      <WorkerTasksContent searchParams={searchParams} />
    </Suspense>
  )
}

async function WorkerTasksContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireRole(UserRole.WORKER)
  const params = await searchParams
  const [initialData, options] = await Promise.all([
    getTasks({
      page: parsePage(params.page),
      status: first(params.status),
      priority: first(params.priority),
    }),
    getTaskFormOptions(),
  ])
  return (
    <TasksWorkspace
      role="WORKER"
      initialData={initialData}
      options={options}
      searchParams={params}
    />
  )
}

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value
