import { useMemo, useState, useTransition } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  Kanban as KanbanIcon,
  LayoutGrid,
  Search,
  Star,
} from "lucide-react"
import {
  DeliverableType,
  Specialization,
  TaskPriority,
  TaskStatus,
  TaskType,
  UserRole,
} from "@/generated/prisma/browser"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { KanbanDemoModern } from "@/components/shadcn-studio/kanban/kanban-04"
import { TASK_STATUS_LABELS } from "./task-details-sheet"
import type { ProjectWorkspaceTask } from "@/lib/projects"
import type { TaskItem } from "@/components/tasks/tasks-workspace"
import { updateTaskStatus } from "@/src/server/actions/tasks";

interface ProjectTasksViewProps {
  tasks: ProjectWorkspaceTask[]
  projectName: string
  onSelectTask: (task: ProjectWorkspaceTask) => void
  currentUserRole: UserRole
  currentUserId?: string
}

export function ProjectTasksView({
  tasks,
  projectName,
  onSelectTask,
  currentUserRole,
  currentUserId,
}: ProjectTasksViewProps) {
  const router = useRouter()
  const [viewMode, setViewMode] = useState<"BOARD" | "GRID">("BOARD")
  const [query, setQuery] = useState("")
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL")
  const [specialisationFilter, setSpecialisationFilter] = useState<string>("ALL")
  const [isPending, startTransition] = useTransition()
  const [moveError, setMoveError] = useState<string | null>(null)

  // Extract distinct specializations/services
  const specialisations = useMemo(() => {
    const set = new Set<string>()
    tasks.forEach((t) => {
      t.services.forEach((s) => set.add(s.service.name))
      t.specializations.forEach((s) => set.add(s.specialization))
    })
    return Array.from(set)
  }, [tasks])

  // Filter tasks based on keyword search, priority, and specialization
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      const q = query.toLowerCase()
      const matchesQuery =
        !q ||
        task.title.toLowerCase().includes(q) ||
        (task.description && task.description.toLowerCase().includes(q))
      const matchesPriority =
        priorityFilter === "ALL" || task.priority === priorityFilter
      const matchesSpecialisation =
        specialisationFilter === "ALL" ||
        task.services.some((s) => s.service.name === specialisationFilter) ||
        task.specializations.some((s) => s.specialization === specialisationFilter)

      return matchesQuery && matchesPriority && matchesSpecialisation
    })
  }, [tasks, query, priorityFilter, specialisationFilter])

  // Convert ProjectWorkspaceTask[] to TaskItem[] for KanbanDemoModern
  const kanbanTasks: TaskItem[] = useMemo(() => {
    return filteredTasks.map((task) => ({
      id: task.id,
      title: task.title,
      description: task.description,
      type: TaskType.ASSIGNED,
      workDate: null,
      status: task.status,
      priority: task.priority,
      startAt: task.startAt ? new Date(task.startAt) : null,
      dueAt: task.dueAt ? new Date(task.dueAt) : null,
      completedAt:
        task.status === TaskStatus.COMPLETED
          ? new Date(task.updatedAt)
          : null,
      startedAt: null,
      deletedAt: null,
      createdById: "",
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt),
      projectId: "",
      project: {
        id: "",
        name: projectName,
        client: null,
        program: projectName,
        creativeBriefs: [],
      },
      assignees: task.assignees.map((a) => ({
        userId: a.userId,
        status: a.status,
        submittedAt: null,
        managerNote: null,
        isCurrentUser: a.userId === currentUserId,
        user: a.user,
      })),
      specializations:
        task.specializations as unknown as Array<{ specialization: Specialization }>,
      services: task.services.map((s) => s.service),
      deliverables: task.deliverables.map((d) => ({
        ...d,
        createdAt: new Date(d.createdAt),
      })),
      deliverablesCount: task.deliverables.filter(
        (d) => d.type === DeliverableType.OUTPUT
      ).length,
      attachmentsCount: task.deliverables.filter(
        (d) => d.type === DeliverableType.INPUT
      ).length,
      comments: task.comments.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
      })),
      commentsCount: task.comments.length,
      ratings: task.ratings,
      revisions: task.revisions.map((r) => ({
        ...r,
        createdAt: new Date(r.createdAt),
      })),
      myStatus: null,
    }))
  }, [filteredTasks, projectName, currentUserId])

  // Handle Drag-and-drop status update
  function handleTaskMove(taskId: string, nextStatus: TaskStatus) {
    if (isPending) return
    setMoveError(null)

    startTransition(async () => {
      try {
        const res = (await updateTaskStatus(taskId, nextStatus)) as { error?: string; success?: boolean } | undefined

        if (res?.error) {
          setMoveError(res.error)
        } else {
          await router.invalidate()
        }
      } catch (err) {
        console.error("Failed to move task:", err)
        setMoveError(
          err instanceof Error ? err.message : "Failed to move task."
        )
      }
    })
  }

  function getCategoryColor(category?: string) {
    if (!category) return "bg-muted text-muted-foreground"
    const lower = category.toLowerCase()
    if (lower.includes("media") || lower.includes("video")) {
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400 border border-orange-500/20"
    }
    if (lower.includes("graphic") || lower.includes("photo")) {
      return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/20"
    }
    if (lower.includes("digital") || lower.includes("web") || lower.includes("dev")) {
      return "bg-purple-500/15 text-purple-700 dark:text-purple-400 border border-purple-500/20"
    }
    return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border border-sky-500/20"
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          {/* Keyword Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Enter Keywords..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-8 text-xs h-9 bg-background"
            />
          </div>

          {/* Priority Filter */}
          <Select
            value={priorityFilter}
            onValueChange={(val) => setPriorityFilter(val || "ALL")}
          >
            <SelectTrigger className="h-9 w-32 text-xs bg-background">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Priority</SelectItem>
              <SelectItem value={TaskPriority.LOW}>Low</SelectItem>
              <SelectItem value={TaskPriority.MEDIUM}>Medium</SelectItem>
              <SelectItem value={TaskPriority.HIGH}>High</SelectItem>
            </SelectContent>
          </Select>

          {/* Specialisation Filter */}
          {specialisations.length > 0 && (
            <Select
              value={specialisationFilter}
              onValueChange={(val) => setSpecialisationFilter(val || "ALL")}
            >
              <SelectTrigger className="h-9 w-36 text-xs bg-background">
                <SelectValue placeholder="Specialisation" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Specialisations</SelectItem>
                {specialisations.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-1 self-end sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("BOARD")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "BOARD"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <KanbanIcon className="size-3.5" />
            Board
          </button>
          <button
            type="button"
            onClick={() => setViewMode("GRID")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              viewMode === "GRID"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            Grid
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Showing {filteredTasks.length} of {tasks.length} tasks
        </p>
        {moveError && (
          <p className="text-xs text-destructive">{moveError}</p>
        )}
      </div>

      {/* 6-Column Responsive Drag-and-Drop Kanban Board */}
      {viewMode === "BOARD" && (
        <div className="w-full max-w-full min-w-0">
          <KanbanDemoModern
            tasks={kanbanTasks}
            role={
              currentUserRole === UserRole.WORKER
                ? "WORKER"
                : currentUserRole === UserRole.CLIENT
                  ? "CLIENT"
                  : "MANAGER"
            }
            pending={isPending}
            onTaskMove={handleTaskMove}
            onTaskClick={(item) => {
              const original = tasks.find((t) => t.id === item.id)
              if (original) onSelectTask(original)
            }}
          />
        </div>
      )}

      {/* Grid / Table View */}
      {viewMode === "GRID" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-muted/40 border-b border-border text-[11px] uppercase font-semibold text-muted-foreground">
              <tr>
                <th className="p-3 pl-4">Task Title</th>
                <th className="p-3">Category</th>
                <th className="p-3">Status</th>
                <th className="p-3">Priority</th>
                <th className="p-3">Due Date</th>
                <th className="p-3">Specialist</th>
                <th className="p-3 pr-4 text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground italic">
                    No tasks found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const category =
                    task.services[0]?.service.name ||
                    task.specializations[0]?.specialization
                  const rating = task.ratings[0]
                  const primaryWorker = task.assignees[0]?.user

                  return (
                    <tr
                      key={task.id}
                      onClick={() => onSelectTask(task)}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                    >
                      <td className="p-3 pl-4 font-semibold text-foreground">
                        {task.title}
                      </td>
                      <td className="p-3">
                        {category ? (
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getCategoryColor(
                              category
                            )}`}
                          >
                            {category}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="p-3">
                        <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">
                          {TASK_STATUS_LABELS[task.status] ?? task.status}
                        </span>
                      </td>
                      <td className="p-3 capitalize">
                        {task.priority.toLowerCase()}
                      </td>
                      <td className="p-3">
                        {task.dueAt
                          ? new Date(task.dueAt).toLocaleDateString()
                          : "Flexible"}
                      </td>
                      <td className="p-3">
                        {primaryWorker?.name ||
                          primaryWorker?.email ||
                          "Unassigned"}
                      </td>
                      <td className="p-3 pr-4 text-right">
                        {rating ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-amber-500">
                            <Star className="size-3 fill-amber-400" />{" "}
                            {rating.score} ★
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
