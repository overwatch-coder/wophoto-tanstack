import { Suspense } from "react"
import { UserRole } from "@/generated/prisma/client"
import { TasksWorkspace } from "@/components/tasks/tasks-workspace"
import { getTaskFormOptions, getTasks } from "@/lib/tasks"
import { StudioArea } from "@/generated/prisma/client"
import { requireStudioArea } from "@/lib/studio-access"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"
import { parseTaskQuery } from "@/lib/validation/queries"

export default function ManagerTasksPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="tasks" label="Loading tasks" />}
    >
      <ManagerTasksContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerTasksContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  await requireStudioArea(StudioArea.TASKS)
  const params = await searchParams
  const filters = parseTaskQuery(params)
  const [initialData, options] = await Promise.all([
    getTasks({
      page: filters.page,
      status: filters.status,
      priority: filters.priority,
      taskId: filters.taskId,
      q: filters.query,
      specialization: filters.specialization,
    }),
    getTaskFormOptions(),
  ])
  return (
    <TasksWorkspace
      role="MANAGER"
      initialData={initialData}
      options={options}
      searchParams={{
        status: filters.status ?? "ALL",
        priority: filters.priority ?? "ALL",
        specialization: filters.specialization ?? "ALL",
        q: filters.query ?? "",
        ...(filters.taskId ? { taskId: filters.taskId, taskAction: filters.taskAction } : {}),
      }}
    />
  )
}
