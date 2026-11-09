import { useCallback, useEffect, useRef, useState, useTransition } from "react"
import { useRouter } from "@tanstack/react-router"
import {
  CalendarDays,
  Check,
  Eye,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  X,
} from "lucide-react"
import {
  TaskPriority,
  TaskStatus,
  TaskType,
} from "@/generated/prisma/browser"
import {
  createAssignedTask,
  createDailyEntry,
  reviewTask,
  softDeleteTask,
  updateAssignedTask,
  updateDailyEntry,
  updateAssignmentStatus,
  updateTaskStatus,
  type TaskActionState,
} from "@/app/actions/tasks"
import { Button } from "@/components/ui/button"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { getProfileImageSrc } from "@/lib/profile-image"
import { useDebounce } from "@uidotdev/usehooks"
import { Pagination } from "@/components/ui/pagination"
import type { TasksPageData } from "@/lib/tasks"
import type { SearchParamsRecord } from "@/lib/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { KanbanDemoModern } from "@/components/shadcn-studio/kanban/kanban-04"

type TasksResult = TasksPageData
export type TaskItem = TasksResult["tasks"][number]
export type Options = {
  services: { id: string; name: string }[]
  projects: {
    id: string
    name: string
    clientId?: string
    clientName?: string | null
  }[]
  clients: { id: string; name: string }[]
  workers: {
    id: string
    name: string | null
    email: string
    image?: string | null
    availability: "AVAILABLE" | "IN_SHOOT" | "FOCUS_MODE" | "OFF_SHIFT"
  }[]
}
const initial: TaskActionState = {}
const labels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
}

function availabilityLabel(value: Options["workers"][number]["availability"]) {
  switch (value) {
    case "IN_SHOOT":
      return "In a studio shoot"
    case "FOCUS_MODE":
      return "Focus time"
    case "OFF_SHIFT":
      return "Off shift"
    default:
      return "Available"
  }
}
const dateText = (date: Date | string | null) =>
  date
    ? new Date(date).toLocaleDateString("en-US", {
        timeZone: "UTC",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "No date"
const requestTaskReview = (taskId: string) =>
  window.dispatchEvent(new CustomEvent("task-review", { detail: taskId }))

const statusFilterItems = [
  { value: "ALL", label: "All statuses" },
  ...Object.values(TaskStatus).map((state) => ({
    value: state,
    label: labels[state],
  })),
]

const priorityFilterItems = [
  { value: "ALL", label: "All priorities" },
  ...Object.values(TaskPriority).map((value) => ({
    value,
    label: value.charAt(0) + value.slice(1).toLowerCase(),
  })),
]

const prioritySelectItems = Object.values(TaskPriority).map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
}))

export function TasksWorkspace({
  role,
  initialData,
  options,
  searchParams,
}: {
  role: "MANAGER" | "WORKER"
  initialData: TasksResult
  options: Options
  searchParams: SearchParamsRecord
}) {
  const router = useRouter()
  const data = initialData
  const status =
    typeof searchParams.status === "string" ? searchParams.status : "ALL"
  const priority =
    typeof searchParams.priority === "string" ? searchParams.priority : "ALL"
  const serviceId =
    typeof searchParams.serviceId === "string"
      ? searchParams.serviceId
      : "ALL"
  const currentQuery = typeof searchParams.q === "string" ? searchParams.q : ""
  const [searchQuery, setSearchQuery] = useState(currentQuery)
  const debouncedSearchQuery = useDebounce(searchQuery, 350)
  const [prevQuery, setPrevQuery] = useState(currentQuery)
  if (prevQuery !== currentQuery) {
    setPrevQuery(currentQuery)
    setSearchQuery(currentQuery)
  }
  const targetTaskId =
    typeof searchParams.taskId === "string" ? searchParams.taskId : undefined
  const taskAction = searchParams.taskAction === "review" ? "review" : "view"
  const openedTaskTarget = useRef<string | null>(null)
  const [view, setView] = useState("table")
  const visible = data.tasks
  const boardTasks =
    (data as { boardTasks?: TaskItem[] }).boardTasks ?? data.tasks

  useEffect(() => {
    if (!targetTaskId) {
      openedTaskTarget.current = null
      return
    }
    if (
      openedTaskTarget.current === targetTaskId ||
      !boardTasks.some((task) => task.id === targetTaskId)
    )
      return

    openedTaskTarget.current = targetTaskId
    const eventName =
      role === "MANAGER" && taskAction === "review"
        ? "task-review"
        : "task-view"
    window.dispatchEvent(new CustomEvent(eventName, { detail: targetTaskId }))

    const params = new URLSearchParams()
    if (status !== "ALL") params.set("status", status)
    if (priority !== "ALL") params.set("priority", priority)
    if (serviceId !== "ALL") params.set("serviceId", serviceId)
    if (currentQuery.trim()) params.set("q", currentQuery.trim())
    const query = params.toString()
    router.navigate({
      href: query ? `${window.location.pathname}?${query}` : window.location.pathname,
      replace: true,
    })
  }, [
    boardTasks,
    currentQuery,
    priority,
    role,
    router,
    serviceId,
    status,
    targetTaskId,
    taskAction,
  ])

  const applyFilters = useCallback(
    (
      nextStatus: string,
      nextPriority: string,
      nextSpec: string,
      nextQuery: string,
      replace = false
    ) => {
      const params = new URLSearchParams()
      if (nextStatus !== "ALL") params.set("status", nextStatus)
      if (nextPriority !== "ALL") params.set("priority", nextPriority)
      if (nextSpec !== "ALL") params.set("serviceId", nextSpec)
      if (nextQuery.trim()) params.set("q", nextQuery.trim())
      const url = params.size
        ? `?${params.toString()}`
        : window.location.pathname
      router.navigate({ href: url, replace })
    },
    [router]
  )

  useEffect(() => {
    if (
      debouncedSearchQuery.trim() !== searchQuery.trim() ||
      debouncedSearchQuery.trim() === currentQuery.trim()
    )
      return
    applyFilters(status, priority, serviceId, debouncedSearchQuery, true)
  }, [
    debouncedSearchQuery,
    searchQuery,
    currentQuery,
    status,
    priority,
    serviceId,
    applyFilters,
  ])

  function resetAllFilters() {
    setSearchQuery("")
    router.navigate({ href: window.location.pathname })
  }

  const isFiltered =
    status !== "ALL" ||
    priority !== "ALL" ||
    serviceId !== "ALL" ||
    Boolean(currentQuery)

  return (
    <div className="mx-auto w-full max-w-7xl min-w-0 space-y-6 overflow-hidden p-4 sm:p-6 lg:p-8">
      <header className="flex min-w-0 flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">
            {role === "MANAGER" ? "Team Workboard" : "Workboard"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Assigned work and daily entries in one view.
          </p>
        </div>
        <CreateTaskDialog role={role} options={options} />
      </header>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(
          [
            TaskStatus.TODO,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_REVIEW,
            TaskStatus.COMPLETED,
          ] as const
        ).map((state) => (
          <button
            key={state}
            type="button"
            onClick={() =>
              applyFilters(
                status === state ? "ALL" : state,
                priority,
                serviceId,
                searchQuery
              )
            }
            className={`rounded-md border bg-card px-4 py-3 text-left transition-colors hover:border-primary/40 ${status === state ? "border-primary ring-1 ring-primary/20" : ""}`}
          >
            <span className="block text-xs text-muted-foreground">
              {labels[state]}
            </span>
            <span className="mt-1 block text-xl font-semibold">
              {data.counts[state] ?? 0}
            </span>
          </button>
        ))}
      </div>
      <div className="flex w-full flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex w-full flex-1 flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search tasks, clients, projects…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pr-3 pl-9 text-xs sm:text-sm"
            />
          </div>
          <Select
            value={status}
            onValueChange={(value) =>
              applyFilters(
                value ?? "ALL",
                priority,
                serviceId,
                searchQuery
              )
            }
            items={statusFilterItems}
          >
            <SelectTrigger
              id="task-status-filter"
              aria-label="Filter by status"
              className="h-10 w-full sm:w-40"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={priority}
            onValueChange={(value) =>
              applyFilters(status, value ?? "ALL", serviceId, searchQuery)
            }
            items={priorityFilterItems}
          >
            <SelectTrigger
              id="task-priority-filter"
              aria-label="Filter by priority"
              className="h-10 w-full sm:w-36"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {priorityFilterItems.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={serviceId}
            onValueChange={(value) =>
              applyFilters(status, priority, value ?? "ALL", searchQuery)
            }
            items={[{ value: "ALL", label: "All services" }, ...options.services.map((service) => ({ value: service.id, label: service.name }))]}
          >
            <SelectTrigger
              id="task-service-filter"
              aria-label="Filter by service"
              className="h-10 w-full sm:w-44"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[{ value: "ALL", label: "All services" }, ...options.services.map((service) => ({ value: service.id, label: service.name }))].map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {isFiltered ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetAllFilters}
              className="h-10 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              <X className="mr-1 size-3.5" />
              Reset
            </Button>
          ) : null}
        </div>
        <Tabs
          className="w-full min-w-0 sm:w-auto"
          value={view}
          onValueChange={(value) => setView(value ?? "table")}
        >
          <TabsList className="grid w-full grid-cols-3 sm:w-fit">
            <TabsTrigger value="table">Table</TabsTrigger>
            <TabsTrigger value="board">Board</TabsTrigger>
            <TabsTrigger value="daybook">Daybook</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      <Tabs
        className="w-full max-w-full min-w-0"
        value={view}
        onValueChange={(v) => setView(v ?? "table")}
      >
        <TabsContent
          className="w-full max-w-full min-w-0 space-y-4 overflow-hidden"
          value="table"
        >
          <TaskTable
            tasks={visible}
            role={role}
            options={options}
            isFiltered={isFiltered}
            onResetFilters={resetAllFilters}
          />
          <Pagination
            pathname={role === "MANAGER" ? "/manager/tasks" : "/worker/tasks"}
            searchParams={searchParams}
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
          />
        </TabsContent>
        <TabsContent
          className="w-full max-w-full min-w-0 overflow-hidden"
          value="board"
        >
          <TaskBoard tasks={boardTasks} role={role} options={options} />
          <Pagination
            pathname={role === "MANAGER" ? "/manager/tasks" : "/worker/tasks"}
            searchParams={searchParams}
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
          />
        </TabsContent>
        <TabsContent
          className="w-full max-w-full min-w-0 overflow-hidden"
          value="daybook"
        >
          <Daybook tasks={boardTasks} role={role} options={options} />
          <Pagination
            pathname={role === "MANAGER" ? "/manager/tasks" : "/worker/tasks"}
            searchParams={searchParams}
            page={data.page}
            totalPages={data.totalPages}
            totalItems={data.total}
          />
        </TabsContent>
      </Tabs>
      <ReviewDialog tasks={boardTasks} />
    </div>
  )
}

function CreateTaskDialog({
  role,
  options,
}: {
  role: "MANAGER" | "WORKER"
  options: Options
}) {
  const [open, setOpen] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const action = role === "MANAGER" ? createAssignedTask : createDailyEntry
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string>("")

  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (!nextOpen) {
      setSelectedClientId("")
      setSelectedProjectId("")
      setError("")
      setFormKey((k) => k + 1)
    }
  }

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId)
    const clientProjects = options.projects.filter(
      (p) => p.clientId === clientId
    )
    if (clientProjects.length === 1) {
      setSelectedProjectId(clientProjects[0].id)
    } else {
      setSelectedProjectId("")
    }
  }

  const clientItems = options.clients.map((client) => ({
    value: client.id,
    label: client.name,
  }))

  const filteredProjects =
    role === "MANAGER"
      ? options.projects.filter(
          (p) => !selectedClientId || p.clientId === selectedClientId
        )
      : options.projects

  const projectItems = filteredProjects.map((project) => ({
    value: project.id,
    label: project.name,
  }))

  const handleSubmit = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const res = await action(initial, formData)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
        setSelectedClientId("")
        setSelectedProjectId("")
        setError("")
        setFormKey((k) => k + 1)
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button>
            <Plus className="size-4" />
            {role === "MANAGER" ? "Assign task" : "Log daily work"}
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {role === "MANAGER" ? "Assign a task" : "Log daily work"}
          </DialogTitle>
        </DialogHeader>
        <form
          key={formKey}
          action={handleSubmit}
          className="flex min-h-0 flex-col gap-4"
        >
          <div className="min-h-0 space-y-5 overflow-y-auto px-0.5 pb-1">
            {role === "MANAGER" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-task-client">Client</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(val) => handleClientChange(val ?? "")}
                    items={clientItems}
                  >
                    <SelectTrigger id="new-task-client" className="h-10 w-full">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientItems.map((client) => (
                        <SelectItem key={client.value} value={client.value}>
                          {client.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-task-project">Project</Label>
                  <Select
                    name="projectId"
                    required
                    value={selectedProjectId}
                    onValueChange={(val) => setSelectedProjectId(val ?? "")}
                    disabled={!selectedClientId}
                    items={projectItems}
                  >
                    <SelectTrigger
                      id="new-task-project"
                      className="h-10 w-full"
                    >
                      <SelectValue
                        placeholder={
                          !selectedClientId
                            ? "Choose client first"
                            : projectItems.length === 0
                              ? "No projects found"
                              : "Choose a project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projectItems.map((project) => (
                        <SelectItem key={project.value} value={project.value}>
                          {project.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-task-project">Project</Label>
                <Select name="projectId" required items={projectItems}>
                  <SelectTrigger id="new-task-project" className="h-10 w-full">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectItems.map((project) => (
                      <SelectItem key={project.value} value={project.value}>
                        {project.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-task-title">Title</Label>
              <Input
                id="new-task-title"
                name="title"
                required
                maxLength={160}
                placeholder="What needs to get done?"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-description">
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="new-task-description"
                name="description"
                maxLength={5000}
                rows={3}
                placeholder="Add details or instructions"
                className="min-h-24 resize-y"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-priority">Priority</Label>
              <Select
                name="priority"
                defaultValue="MEDIUM"
                items={prioritySelectItems}
              >
                <SelectTrigger id="new-task-priority" className="h-10 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {prioritySelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "MANAGER" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new-task-start">
                      Start date{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="new-task-start"
                      name="startAt"
                      type="date"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new-task-due">
                      Due date{" "}
                      <span className="font-normal text-muted-foreground">
                        (optional)
                      </span>
                    </Label>
                    <Input
                      id="new-task-due"
                      name="dueAt"
                      type="date"
                      className="h-10"
                    />
                  </div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    Assign workers
                  </legend>
                  <div className="max-h-36 space-y-2 overflow-y-auto">
                    {options.workers.length ? (
                      options.workers.map((worker) => {
                        const avatarSrc =
                          getProfileImageSrc(worker.image, worker.id) ??
                          worker.image
                        const initial = (worker.name || worker.email || "?")
                          .charAt(0)
                          .toUpperCase()
                        const colorClass = getAssigneeColor(
                          worker.name || worker.email || ""
                        )

                        return (
                          <label
                            key={worker.id}
                            className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                          >
                            <input
                              type="checkbox"
                              name="workerId"
                              value={worker.id}
                              className="size-4 accent-primary"
                            />
                            <span
                              className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${colorClass}`}
                            >
                              {avatarSrc ? (
                                <img
                                  src={avatarSrc}
                                  alt=""
                                  width={24}
                                  height={24}
                                  className="size-full rounded-full object-cover"
                                />
                              ) : (
                                initial
                              )}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">
                                {worker.name || worker.email}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {availabilityLabel(worker.availability)}
                              </span>
                            </span>
                          </label>
                        )
                      })
                    ) : (
                      <p className="px-3 py-4 text-sm text-muted-foreground">
                        No active workers available.
                      </p>
                    )}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">
                    Services{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {options.services.map((service) => (
                      <label
                        key={service.id}
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <input
                          type="checkbox"
                          name="serviceId"
                          value={service.id}
                          className="size-4 accent-primary"
                        />
                        <span>
                          {service.name}
                        </span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-task-work-date">Work date</Label>
                <Input
                  id="new-task-work-date"
                  name="workDate"
                  type="date"
                  max={new Date().toISOString().slice(0, 10)}
                  className="h-10"
                />
              </div>
            )}
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <DialogFooter className="-mx-4 -mb-4 flex-row justify-end border-t bg-muted/40 px-4 py-3">
            <DialogClose
              render={
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
              }
            />
            <Button
              type="submit"
              disabled={pending}
              className="flex-1 sm:flex-none"
            >
              {pending
                ? "Saving…"
                : role === "MANAGER"
                  ? "Assign task"
                  : "Save entry"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ViewTaskDialog({
  task,
  compact = false,
  showTrigger = true,
}: {
  task: TaskItem
  compact?: boolean
  showTrigger?: boolean
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const openTask = (event: Event) => {
      if ((event as CustomEvent<string>).detail === task.id) setOpen(true)
    }
    window.addEventListener("task-view", openTask)
    return () => window.removeEventListener("task-view", openTask)
  }, [task.id])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
      <DialogTrigger
        render={
          <Button
            size={compact ? "icon-sm" : "sm"}
            variant="outline"
            aria-label="View task"
            title="View task"
            className={compact ? undefined : "h-8 gap-1.5 px-2.5"}
          >
            <Eye className="size-3.5" />
            {!compact ? <span>View</span> : null}
          </Button>
        }
      />
      ) : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl leading-snug font-semibold">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="flex flex-wrap items-center gap-2 border-b pb-3 text-xs">
            <span className="font-medium text-muted-foreground">
              {task.type === TaskType.DAILY_ENTRY
                ? "Daily entry"
                : "Assigned task"}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-primary">
              {labels[task.status]}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="font-medium text-muted-foreground capitalize">
              {task.priority.toLowerCase()} priority
            </span>
          </div>

          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Project</span>
                <p className="font-medium text-foreground">
                  {task.project.name}
                </p>
              </div>
              {task.project.client?.name ? (
                <div>
                  <span className="text-xs text-muted-foreground">Client</span>
                  <p className="font-medium text-foreground">
                    {task.project.client.name}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Description
            </h4>
            {task.description ? (
              <div className="rounded-md border bg-background p-3 text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                {task.description}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                No description provided.
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {task.type === TaskType.DAILY_ENTRY ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Work Date</span>
                <p className="font-medium">{dateText(task.workDate)}</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Start Date
                  </span>
                  <p className="font-medium">{dateText(task.startAt)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">
                    Due Date
                  </span>
                  <p className="font-medium">{dateText(task.dueAt)}</p>
                </div>
              </>
            )}
          </div>

          {task.assignees.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Assignees
              </h4>
              <div className="divide-y divide-border rounded-md border border-border bg-background">
                {task.assignees.map((a) => {
                  const displayName = a.user.name || a.user.email || "Unknown"
                  const initial = displayName.charAt(0).toUpperCase()
                  const colorClass = getAssigneeColor(displayName)
                  const avatarSrc =
                    getProfileImageSrc(a.user.image, a.userId) ?? a.user.image

                  return (
                    <div
                      key={a.userId}
                      className="flex items-center justify-between p-2.5 text-sm"
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-bold ${colorClass}`}
                        >
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt={displayName}
                              width={28}
                              height={28}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">
                            {displayName}
                          </p>
                          {a.managerNote ? (
                            <p className="text-xs text-destructive">
                              Manager note: {a.managerNote}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ) : null}

          {task.services && task.services.length > 0 ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Services
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {task.services.map((service) => (
                  <span
                    key={service.id}
                    className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs capitalize"
                  >
                    {service.name}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="-mx-4 mt-4 -mb-4 border-t bg-muted/40 px-4 py-3">
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const AVATAR_COLORS = [
  "bg-zinc-700 text-zinc-100 dark:bg-zinc-800 dark:text-zinc-200",
  "bg-slate-700 text-slate-100 dark:bg-slate-800 dark:text-slate-200",
  "bg-neutral-700 text-neutral-100 dark:bg-neutral-800 dark:text-neutral-200",
  "bg-stone-700 text-stone-100 dark:bg-stone-800 dark:text-stone-200",
]

function getAssigneeColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function AssigneeAvatars({
  assignees,
}: {
  assignees: Array<{
    userId: string
    user: { name: string | null; email: string | null; image?: string | null }
    managerNote?: string | null
  }>
}) {
  if (assignees.length === 0) {
    return (
      <span className="text-xs text-muted-foreground italic">Unassigned</span>
    )
  }

  // Single assignee
  if (assignees.length === 1) {
    const a = assignees[0]
    const displayName = a.user.name || a.user.email || "Unknown"
    const initial = displayName.charAt(0).toUpperCase()
    const colorClass = getAssigneeColor(displayName)
    const avatarSrc = getProfileImageSrc(a.user.image, a.userId) ?? a.user.image

    return (
      <div className="flex min-w-0 flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ${colorClass}`}
          >
            {avatarSrc ? (
              <img
                src={avatarSrc}
                alt={displayName}
                width={28}
                height={28}
                className="size-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
          <span
            className="min-w-0 truncate text-sm font-medium text-foreground"
            title={displayName}
          >
            {displayName}
          </span>
        </div>
      </div>
    )
  }

  // Multiple assignees: stacked avatar grouping
  const visible = assignees.slice(0, 3)
  const remaining = assignees.length - 3
  const allNames = assignees.map((a) => a.user.name || a.user.email).join(", ")

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div
          className="flex -space-x-2 overflow-hidden py-0.5"
          title={allNames}
        >
          {visible.map((a) => {
            const displayName = a.user.name || a.user.email || "Unknown"
            const initial = displayName.charAt(0).toUpperCase()
            const colorClass = getAssigneeColor(displayName)
            const avatarSrc =
              getProfileImageSrc(a.user.image, a.userId) ?? a.user.image

            return (
              <span
                key={a.userId}
                title={displayName}
                className={`relative inline-flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ring-2 ring-card ${colorClass}`}
              >
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={displayName}
                    width={28}
                    height={28}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </span>
            )
          })}
          {remaining > 0 ? (
            <span
              title={allNames}
              className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground ring-2 ring-card"
            >
              +{remaining}
            </span>
          ) : null}
        </div>
        <span
          className="max-w-[130px] truncate text-xs text-muted-foreground"
          title={allNames}
        >
          {allNames}
        </span>
      </div>
    </div>
  )
}

function TaskTable({
  tasks,
  role,
  options,
  isFiltered = false,
  onResetFilters,
}: {
  tasks: TaskItem[]
  role: "MANAGER" | "WORKER"
  options: Options
  isFiltered?: boolean
  onResetFilters?: () => void
}) {
  return (
    <Table
      containerClassName="max-h-[min(70svh,48rem)] overflow-auto overscroll-contain rounded-md border bg-card"
      className="min-w-[1180px] table-fixed text-left text-sm xl:min-w-full"
    >
      <colgroup>
        <col className="w-[20%]" />
        <col className="w-[16%]" />
        <col className="w-[18%]" />
        <col className="w-[9%]" />
        <col className="w-[10%]" />
        <col className="w-[9%]" />
        <col className="w-[18%]" />
      </colgroup>
      <TableHeader className="text-xs text-muted-foreground">
        <TableRow>
          {[
            "Task",
            "Project",
            "Assignees",
            "Priority",
            "Due date",
            "Status",
            "Actions",
          ].map((h) => (
            <TableHead
              key={h}
              scope="col"
              className="sticky top-0 z-10 border-b border-border bg-muted px-4 py-3 align-middle font-medium"
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y">
        {tasks.map((task) => (
          <TableRow key={task.id} className="h-[72px] align-middle">
            <TableCell className="h-[72px] max-w-0 overflow-hidden px-4 py-3">
              <p
                className="truncate font-medium text-foreground"
                title={task.title}
              >
                {task.title}
              </p>
            </TableCell>
            <TableCell className="h-[72px] max-w-0 overflow-hidden px-4 py-3">
              <p className="truncate font-medium" title={task.project.name}>
                {task.project.name}
              </p>
              {task.project.client?.name ? (
                <p
                  className="truncate text-xs text-muted-foreground"
                  title={task.project.client.name}
                >
                  {task.project.client.name}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="h-[72px] max-w-0 overflow-hidden px-4 py-3">
              <AssigneeAvatars assignees={task.assignees} />
            </TableCell>
            <TableCell className="h-[72px] px-4 py-3 whitespace-nowrap">
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                {task.priority.toLowerCase()}
              </span>
            </TableCell>
            <TableCell className="h-[72px] px-4 py-3 text-sm whitespace-nowrap">
              <span
                className={
                  task.dueAt &&
                  new Date(task.dueAt) < new Date() &&
                  task.status !== TaskStatus.COMPLETED
                    ? "font-semibold text-rose-600 dark:text-rose-400"
                    : "text-muted-foreground"
                }
              >
                {dateText(
                  task.type === TaskType.DAILY_ENTRY
                    ? task.workDate
                    : task.dueAt
                )}
              </span>
            </TableCell>
            <TableCell className="h-[72px] px-4 py-3 whitespace-nowrap">
              <span className="inline-flex w-max max-w-full rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium whitespace-nowrap text-primary">
                {
                  labels[
                    role === "WORKER"
                      ? (task.myStatus ?? task.status)
                      : task.status
                  ]
                }
              </span>
            </TableCell>
            <TableCell className="h-[72px] px-3 py-3 whitespace-nowrap">
              <TaskControls
                task={task}
                role={role}
                options={options}
                compact
                tableActions
              />
            </TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="px-4 py-14 text-center text-muted-foreground"
            >
              <div className="flex flex-col items-center justify-center gap-2">
                <p>No tasks match these filters.</p>
                {isFiltered && onResetFilters ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onResetFilters}
                    className="mt-1"
                  >
                    Reset filters
                  </Button>
                ) : null}
              </div>
            </TableCell>
          </TableRow>
        ) : null}
      </TableBody>
    </Table>
  )
}

function TaskControls({
  task,
  role,
  options,
  compact = false,
  tableActions = false,
}: {
  task: TaskItem
  role: "MANAGER" | "WORKER"
  options: Options
  compact?: boolean
  tableActions?: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const own = task.myStatus
  const update = (next: TaskStatus) =>
    start(async () => {
      const result = await updateAssignmentStatus(task.id, next)
      setError(result.error ?? "")
    })

  if (tableActions) {
    const canEditWorkerEntry =
      role === "WORKER" &&
      task.type === TaskType.DAILY_ENTRY &&
      (own === TaskStatus.TODO || own === TaskStatus.IN_PROGRESS)
    const canEditManagerTask =
      role === "MANAGER" &&
      task.type === TaskType.ASSIGNED &&
      task.status !== TaskStatus.COMPLETED

    return (
      <>
        <TableRowActions label={`Actions for ${task.title}`}>
          <DropdownMenuItem
            onClick={() =>
              window.dispatchEvent(
                new CustomEvent("task-view", { detail: task.id })
              )
            }
          >
            <Eye aria-hidden="true" />
            View details
          </DropdownMenuItem>
          {role === "WORKER" && own === TaskStatus.TODO ? (
            <DropdownMenuItem
              disabled={pending}
              onClick={() => update(TaskStatus.IN_PROGRESS)}
            >
              <Play aria-hidden="true" />
              Start task
            </DropdownMenuItem>
          ) : null}
          {role === "WORKER" && own === TaskStatus.IN_PROGRESS ? (
            <DropdownMenuItem
              disabled={pending}
              onClick={() => update(TaskStatus.TODO)}
            >
              <RotateCcw aria-hidden="true" />
              Move to to do
            </DropdownMenuItem>
          ) : null}
          {role === "WORKER" &&
          (own === TaskStatus.TODO || own === TaskStatus.IN_PROGRESS) ? (
            <DropdownMenuItem
              disabled={pending}
              onClick={() => update(TaskStatus.IN_REVIEW)}
            >
              Submit for review
            </DropdownMenuItem>
          ) : null}
          {canEditWorkerEntry || canEditManagerTask ? (
            <DropdownMenuItem
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("task-edit", { detail: task.id })
                )
              }
            >
              <Pencil aria-hidden="true" />
              Edit task
            </DropdownMenuItem>
          ) : null}
          {role === "MANAGER" && task.status === TaskStatus.IN_REVIEW ? (
            <DropdownMenuItem
              onClick={() =>
                window.dispatchEvent(
                  new CustomEvent("task-review", { detail: task.id })
                )
              }
            >
              Review task
            </DropdownMenuItem>
          ) : null}
          {role === "MANAGER" ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("task-delete", { detail: task.id })
                  )
                }
              >
                <Trash2 aria-hidden="true" />
                Delete task
              </DropdownMenuItem>
            </>
          ) : null}
        </TableRowActions>
        <ViewTaskDialog task={task} compact showTrigger={false} />
        {canEditWorkerEntry || canEditManagerTask ? (
          <EditTaskDialog
            task={task}
            role={role}
            options={options}
            compact
            showTrigger={false}
          />
        ) : null}
        {role === "MANAGER" ? (
          <DeleteTask taskId={task.id} showTrigger={false} />
        ) : null}
        {error ? (
          <span role="alert" className="sr-only text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </>
    )
  }

  if (role === "WORKER") {
    return (
      <div className="flex min-w-max flex-nowrap items-center gap-1">
        <ViewTaskDialog task={task} compact={compact} />
        {own === TaskStatus.TODO ? (
          <>
            <Button
              size={compact ? "icon-sm" : "sm"}
              variant="outline"
              aria-label="Start task"
              title="Start task"
              disabled={pending}
              onClick={() => update(TaskStatus.IN_PROGRESS)}
            >
              {compact ? (
                <Play aria-hidden="true" className="size-3.5" />
              ) : (
                "Start"
              )}
            </Button>
            <Button
              size="sm"
              aria-label="Submit task for review"
              disabled={pending}
              onClick={() => update(TaskStatus.IN_REVIEW)}
            >
              Submit
            </Button>
          </>
        ) : null}
        {own === TaskStatus.IN_PROGRESS ? (
          <>
            <Button
              size={compact ? "icon-sm" : "sm"}
              variant="outline"
              aria-label="Move task to to do"
              title="Move task to to do"
              disabled={pending}
              onClick={() => update(TaskStatus.TODO)}
            >
              {compact ? (
                <RotateCcw aria-hidden="true" className="size-3.5" />
              ) : (
                "To do"
              )}
            </Button>
            <Button
              size="sm"
              aria-label="Submit task for review"
              disabled={pending}
              onClick={() => update(TaskStatus.IN_REVIEW)}
            >
              Submit
            </Button>
          </>
        ) : null}
        {task.type === TaskType.DAILY_ENTRY &&
        (own === TaskStatus.TODO || own === TaskStatus.IN_PROGRESS) ? (
          <EditTaskDialog
            task={task}
            role={role}
            options={options}
            compact={compact}
          />
        ) : null}
        {error ? (
          <span role="alert" className="text-xs text-destructive">
            {error}
          </span>
        ) : null}
      </div>
    )
  }

  return (
    <div className="flex min-w-max flex-nowrap items-center gap-1.5">
      <ViewTaskDialog task={task} compact={compact} />
      {task.type === TaskType.ASSIGNED &&
      task.status !== TaskStatus.COMPLETED ? (
        <EditTaskDialog
          task={task}
          role={role}
          options={options}
          compact={compact}
        />
      ) : null}
      {task.status === TaskStatus.IN_REVIEW ? (
        <Button
          size="sm"
          aria-label="Review task"
          onClick={() => requestTaskReview(task.id)}
        >
          Review
        </Button>
      ) : null}
      <DeleteTask taskId={task.id} />
    </div>
  )
}

function EditTaskDialog({
  task,
  role,
  options,
  compact = false,
  showTrigger = true,
}: {
  task: TaskItem
  role: "MANAGER" | "WORKER"
  options: Options
  compact?: boolean
  showTrigger?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (showTrigger) return
    const openEditor = (event: Event) => {
      if ((event as CustomEvent<string>).detail === task.id) setOpen(true)
    }
    window.addEventListener("task-edit", openEditor)
    return () => window.removeEventListener("task-edit", openEditor)
  }, [showTrigger, task.id])
  const action =
    role === "MANAGER"
      ? updateAssignedTask.bind(null, task.id)
      : updateDailyEntry.bind(null, task.id)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const defaultDate = (value: Date | string | null) =>
    value ? new Date(value).toISOString().slice(0, 10) : ""

  const handleSubmit = (formData: FormData) => {
    setError("")
    startTransition(async () => {
      const res = await action(initial, formData)
      if (res.error) {
        setError(res.error)
      } else {
        setOpen(false)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setError("")
      }}
    >
      {showTrigger ? (
      <DialogTrigger
        render={
          <Button
            size={compact ? "icon-sm" : "sm"}
            variant="outline"
            aria-label="Edit task"
            title="Edit task"
          >
            {compact ? (
              <Pencil aria-hidden="true" className="size-3.5" />
            ) : (
              "Edit"
            )}
          </Button>
        }
      />
      ) : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`edit-task-title-${task.id}`}>Title</Label>
            <Input
              id={`edit-task-title-${task.id}`}
              name="title"
              required
              maxLength={160}
              defaultValue={task.title}
              className="h-10 w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-task-desc-${task.id}`}>Description</Label>
            <Textarea
              id={`edit-task-desc-${task.id}`}
              name="description"
              maxLength={5000}
              rows={3}
              defaultValue={task.description ?? ""}
              className="w-full"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`edit-task-priority-${task.id}`}>Priority</Label>
            <Select
              name="priority"
              defaultValue={task.priority}
              items={prioritySelectItems}
            >
              <SelectTrigger
                id={`edit-task-priority-${task.id}`}
                className="h-10 w-full"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioritySelectItems.map((value) => (
                  <SelectItem key={value.value} value={value.value}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === "MANAGER" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor={`edit-task-start-${task.id}`}>
                    Start date
                  </Label>
                  <Input
                    id={`edit-task-start-${task.id}`}
                    name="startAt"
                    type="date"
                    defaultValue={defaultDate(task.startAt)}
                    className="h-10 w-full"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`edit-task-due-${task.id}`}>Due date</Label>
                  <Input
                    id={`edit-task-due-${task.id}`}
                    name="dueAt"
                    type="date"
                    defaultValue={defaultDate(task.dueAt)}
                    className="h-10 w-full"
                  />
                </div>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Assign workers</legend>
                <div className="max-h-40 space-y-2 overflow-auto">
                  {options.workers.map((worker) => {
                    const avatarSrc =
                      getProfileImageSrc(worker.image, worker.id) ??
                      worker.image
                    const initial = (worker.name || worker.email || "?")
                      .charAt(0)
                      .toUpperCase()
                    const colorClass = getAssigneeColor(
                      worker.name || worker.email || ""
                    )

                    return (
                      <label
                        key={worker.id}
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <input
                          type="checkbox"
                          name="workerId"
                          value={worker.id}
                          defaultChecked={task.assignees.some(
                            (a) => a.userId === worker.id
                          )}
                          className="size-4 accent-primary"
                        />
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold ${colorClass}`}
                        >
                          {avatarSrc ? (
                            <img
                              src={avatarSrc}
                              alt=""
                              width={28}
                              height={28}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">
                            {worker.name || worker.email}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {availabilityLabel(worker.availability)}
                          </span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Services</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {options.services.map((service) => (
                    <label
                      key={service.id}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name="serviceId"
                        value={service.id}
                        defaultChecked={task.services.some((item) => item.id === service.id)}
                        className="size-4 accent-primary"
                      />
                      <span>{service.name}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor={`edit-task-workdate-${task.id}`}>Work date</Label>
              <Input
                id={`edit-task-workdate-${task.id}`}
                name="workDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
                defaultValue={defaultDate(task.workDate)}
                className="h-10 w-full"
              />
            </div>
          )}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function DeleteTask({
  taskId,
  showTrigger = true,
}: {
  taskId: string
  showTrigger?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  useEffect(() => {
    if (showTrigger) return
    const openDelete = (event: Event) => {
      if ((event as CustomEvent<string>).detail === taskId) setOpen(true)
    }
    window.addEventListener("task-delete", openDelete)
    return () => window.removeEventListener("task-delete", openDelete)
  }, [showTrigger, taskId])
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      {showTrigger ? (
      <AlertDialogTrigger
        render={
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label="Delete task"
            title="Delete task"
          >
            <Trash2 className="size-4" />
          </Button>
        }
      />
      ) : null}
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this task?</AlertDialogTitle>
          <AlertDialogDescription>
            The task will leave active task views and cannot be restored here.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(event) => {
              event.preventDefault()
              start(async () => {
                const result = await softDeleteTask(taskId)
                if (result.error) setError(result.error)
                else setOpen(false)
              })
            }}
            disabled={pending}
          >
            {pending ? "Deleting…" : "Delete task"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function Daybook({
  tasks,
  role,
  options,
}: {
  tasks: TaskItem[]
  role: "MANAGER" | "WORKER"
  options: Options
}) {
  const groups = new Map<string, TaskItem[]>()
  for (const task of tasks) {
    const date =
      task.type === TaskType.DAILY_ENTRY
        ? task.workDate
        : (task.dueAt ?? task.startAt)
    const key = date ? dateText(date) : "Unscheduled"
    groups.set(key, [...(groups.get(key) ?? []), task])
  }
  return (
    <div className="space-y-5">
      {[...groups.entries()]
        .sort(([a], [b]) =>
          a === "Unscheduled"
            ? 1
            : b === "Unscheduled"
              ? -1
              : new Date(b).getTime() - new Date(a).getTime()
        )
        .map(([date, items]) => (
          <section key={date} className="rounded-md border bg-card">
            <h2 className="flex items-center gap-2 border-b px-4 py-3 font-medium">
              <CalendarDays className="size-4 text-primary" />
              {date}
            </h2>
            <ul className="divide-y">
              {items.map((task) => (
                <li
                  key={task.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-4"
                >
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.project.name} ·{" "}
                      {
                        labels[
                          role === "WORKER"
                            ? (task.myStatus ?? task.status)
                            : task.status
                        ]
                      }
                    </p>
                    {task.assignees.find(
                      (a) => a.isCurrentUser && a.managerNote
                    )?.managerNote ? (
                      <div className="mt-1.5 inline-flex max-w-sm items-center gap-1 rounded border border-amber-500/25 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                        <span className="font-semibold">Manager note:</span>{" "}
                        {
                          task.assignees.find((a) => a.isCurrentUser)
                            ?.managerNote
                        }
                      </div>
                    ) : null}
                  </div>
                  <TaskControls task={task} role={role} options={options} />
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

function TaskBoard({
  tasks,
  role,
  options,
}: {
  tasks: TaskItem[]
  role: "MANAGER" | "WORKER"
  options: Options
}) {
  const [message, setMessage] = useState("")
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function move(taskId: string, next: TaskStatus) {
    const task = tasks.find((item) => item.id === taskId)
    if (!task) return
    const current = role === "WORKER" ? task.myStatus : task.status
    if (!current || current === next) return
    if (
      role === "WORKER" &&
      !(
        [
          TaskStatus.TODO,
          TaskStatus.IN_PROGRESS,
          TaskStatus.IN_REVIEW,
        ] as TaskStatus[]
      ).includes(next)
    )
      return

    if (role === "MANAGER") {
      if (
        task.status === TaskStatus.IN_REVIEW &&
        (next === TaskStatus.IN_PROGRESS || next === TaskStatus.COMPLETED)
      ) {
        requestTaskReview(task.id)
        return
      }
    }

    setMessage("")
    startTransition(async () => {
      const result = await updateTaskStatus(taskId, next)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(`Moved to ${labels[next].toLowerCase()}.`)
      router.invalidate()
    })
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 overflow-hidden">
      <p className="text-xs text-muted-foreground">
        {role === "MANAGER"
          ? "Drag tasks between columns to update workflow status. Drop review tasks into In progress or Completed to review."
          : "Drag your tasks between To do and In progress, or into In review when they are ready to submit."}
      </p>
      <KanbanDemoModern
        tasks={tasks}
        role={role}
        pending={pending}
        onTaskMove={move}
        renderTaskActions={(task) => (
          <TaskControls task={task} role={role} options={options} compact />
        )}
      />
      {message ? (
        <p
          role={message.startsWith("Moved") ? "status" : "alert"}
          className={`text-sm ${message.startsWith("Moved") ? "text-muted-foreground" : "text-destructive"}`}
        >
          {message}
        </p>
      ) : null}
    </div>
  )
}

function ReviewDialog({ tasks }: { tasks: TaskItem[] }) {
  const [task, setTask] = useState<TaskItem | null>(null)
  const [decision, setDecision] = useState<"approve" | "return">("approve")
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([])
  const [managerNote, setManagerNote] = useState("")
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      const found = tasks.find((item) => item.id === id) ?? null
      setTask(found)
      setDecision("approve")
      setSelectedUserIds(found?.assignees.map((a) => a.userId) ?? [])
      setManagerNote("")
      setError("")
    }
    window.addEventListener("task-review", listener)
    return () => window.removeEventListener("task-review", listener)
  }, [tasks])

  const handleReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!task) return
    setError("")
    const formData = new FormData()
    formData.set("decision", decision)
    if (decision === "return") {
      selectedUserIds.forEach((id) => formData.append("returnUserId", id))
      formData.set("managerNote", managerNote)
    }
    startTransition(async () => {
      const res = await reviewTask(task.id, initial, formData)
      if (res.error) {
        setError(res.error)
      } else {
        setTask(null)
      }
    })
  }

  return (
    <Dialog
      open={Boolean(task)}
      onOpenChange={(open) => {
        if (!open) setTask(null)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Review Task</DialogTitle>
          <p className="text-sm font-medium text-foreground">{task?.title}</p>
        </DialogHeader>
        <form onSubmit={handleReview} className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted p-1 text-sm font-medium">
            <button
              type="button"
              onClick={() => setDecision("approve")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${
                decision === "approve"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Check className="size-3.5" />
              Approve for all
            </button>
            <button
              type="button"
              onClick={() => setDecision("return")}
              className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs transition-colors ${
                decision === "return"
                  ? "bg-background font-semibold text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCcw className="size-3.5" />
              Request revision
            </button>
          </div>

          {decision === "approve" ? (
            <p className="text-xs text-muted-foreground">
              Mark this deliverable as completed for all assignees and update
              the project timeline.
            </p>
          ) : (
            <div className="space-y-3">
              <fieldset className="space-y-2">
                <legend className="text-xs font-medium text-foreground">
                  Select workers to resubmit
                </legend>
                <div className="space-y-1.5 rounded-md border p-2.5">
                  {task?.assignees.map((a) => (
                    <label
                      key={a.userId}
                      className="flex cursor-pointer items-center gap-2 text-xs font-medium"
                    >
                      <input
                        type="checkbox"
                        checked={selectedUserIds.includes(a.userId)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedUserIds([...selectedUserIds, a.userId])
                          } else {
                            setSelectedUserIds(
                              selectedUserIds.filter((id) => id !== a.userId)
                            )
                          }
                        }}
                        className="size-3.5 rounded accent-primary"
                      />
                      <span>{a.user.name || a.user.email}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="space-y-1.5">
                <Label htmlFor="review-note" className="text-xs">
                  Creative revision notes
                </Label>
                <Textarea
                  id="review-note"
                  value={managerNote}
                  onChange={(e) => setManagerNote(e.target.value)}
                  placeholder="Explain what adjustments are needed (e.g., color grade clip 3, re-crop hero image)..."
                  rows={3}
                  required
                  className="text-xs"
                />
              </div>
            </div>
          )}

          {error ? (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          ) : null}

          <DialogFooter className="gap-2 sm:gap-0">
            <DialogClose
              render={
                <Button type="button" variant="outline" size="sm">
                  Cancel
                </Button>
              }
            />
            <Button type="submit" size="sm" disabled={pending}>
              {pending
                ? "Submitting…"
                : decision === "approve"
                  ? "Confirm approval"
                  : "Send revision request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
