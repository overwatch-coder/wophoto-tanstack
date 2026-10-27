import { Suspense } from "react"
import { UserRole } from "@/generated/prisma/client"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { getTaskFormOptions, getTasks } from "@/lib/tasks"
import { requireRole } from "@/lib/authz"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"
import { parseTaskQuery } from "@/lib/validation/queries"

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
  const filters = parseTaskQuery(params)
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
  ])
  return (
    <TasksWorkspace
      role="WORKER"
      initialData={initialData}
      options={options}
      searchParams={{
        status: filters.status ?? "ALL",
        priority: filters.priority ?? "ALL",
        serviceId: filters.serviceId ?? "ALL",
        q: filters.query ?? "",
        ...(filters.taskId ? { taskId: filters.taskId, taskAction: filters.taskAction } : {}),
      }}
    />
  )
}
