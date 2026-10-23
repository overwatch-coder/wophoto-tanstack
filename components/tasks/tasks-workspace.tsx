"use client"

import { useEffect, useState, useTransition } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  CalendarDays,
  Check,
  Eye,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react"
import {
  Specialization,
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
  type TaskActionState,
} from "@/app/actions/tasks"
import { Button } from "@/components/ui/button"
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
  }[]
}
const initial: TaskActionState = {}
const labels: Record<TaskStatus, string> = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
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
  const [view, setView] = useState("table")
  const visible = data.tasks
  function applyFilters(nextStatus: string, nextPriority: string) {
    const params = new URLSearchParams()
    if (nextStatus !== "ALL") params.set("status", nextStatus)
    if (nextPriority !== "ALL") params.set("priority", nextPriority)
    router.push(
      params.size ? `?${params.toString()}` : window.location.pathname
    )
  }
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
              applyFilters(status === state ? "ALL" : state, priority)
            }
            className={`rounded-md border bg-card px-4 py-3 text-left ${status === state ? "border-primary" : ""}`}
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
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid w-full grid-cols-1 gap-2 sm:flex sm:w-auto">
          <Select
            value={status}
            onValueChange={(value) => applyFilters(value ?? "ALL", priority)}
            items={statusFilterItems}
          >
            <SelectTrigger
              id="task-status-filter"
              aria-label="Filter by status"
              className="h-10 w-full sm:w-56"
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
            onValueChange={(value) => applyFilters(status, value ?? "ALL")}
            items={priorityFilterItems}
          >
            <SelectTrigger
              id="task-priority-filter"
              aria-label="Filter by priority"
              className="h-10 w-full sm:w-52"
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
          className="w-full max-w-full min-w-0 overflow-hidden"
          value="table"
        >
          <TaskTable tasks={visible} role={role} options={options} />
        </TabsContent>
        <TabsContent
          className="w-full max-w-full min-w-0 overflow-hidden"
          value="board"
        >
          <TaskBoard tasks={visible} role={role} options={options} />
        </TabsContent>
        <TabsContent
          className="w-full max-w-full min-w-0 overflow-hidden"
          value="daybook"
        >
          <Daybook tasks={visible} role={role} options={options} />
        </TabsContent>
      </Tabs>
      <Pagination
        pathname={role === "MANAGER" ? "/manager/tasks" : "/worker/tasks"}
        searchParams={searchParams}
        page={data.page}
        totalPages={data.totalPages}
        totalItems={data.total}
      />
      <ReviewDialog tasks={visible} />
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
                                <Image
                                  src={avatarSrc}
                                  alt=""
                                  width={24}
                                  height={24}
                                  sizes="24px"
                                  unoptimized
                                  className="size-full rounded-full object-cover"
                                />
                              ) : (
                                initial
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate">
                              {worker.name || worker.email}
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
                    Specializations{" "}
                    <span className="font-normal text-muted-foreground">
                      (optional)
                    </span>
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.values(Specialization).map((specialization) => (
                      <label
                        key={specialization}
                        className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                      >
                        <input
                          type="checkbox"
                          name="specialization"
                          value={specialization}
                          className="size-4 accent-primary"
                        />
                        <span>
                          {specialization.replaceAll("_", " ").toLowerCase()}
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
}: {
  task: TaskItem
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {task.type === TaskType.DAILY_ENTRY
                ? "Daily entry"
                : "Assigned task"}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {labels[task.status]}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground capitalize">
              {task.priority.toLowerCase()} priority
            </span>
          </div>
          <DialogTitle className="mt-2 text-xl leading-snug font-semibold">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
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
                            <Image
                              src={avatarSrc}
                              alt={displayName}
                              width={28}
                              height={28}
                              sizes="28px"
                              unoptimized
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

          {task.specializations && task.specializations.length > 0 ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                Specializations
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {task.specializations.map((item) => (
                  <span
                    key={item.specialization}
                    className="inline-flex items-center rounded-full border bg-muted/40 px-2.5 py-1 text-xs capitalize"
                  >
                    {item.specialization.replaceAll("_", " ").toLowerCase()}
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
  "bg-orange-600 text-white",
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-emerald-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
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
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${colorClass}`}
          >
            {avatarSrc ? (
              <Image
                src={avatarSrc}
                alt={displayName}
                width={24}
                height={24}
                sizes="24px"
                unoptimized
                className="size-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
          <span className="text-sm font-medium text-foreground">
            {displayName}
          </span>
        </div>
        {a.managerNote ? (
          <p className="max-w-48 text-xs text-destructive">
            Manager note: {a.managerNote}
          </p>
        ) : null}
      </div>
    )
  }

  // Multiple assignees: shadcn stacked avatar grouping
  const visible = assignees.slice(0, 3)
  const remaining = assignees.length - 3
  const allNames = assignees.map((a) => a.user.name || a.user.email).join(", ")

  return (
    <div className="flex flex-col gap-1">
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
                className={`relative inline-flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ring-2 ring-card ${colorClass}`}
              >
                {avatarSrc ? (
                  <Image
                    src={avatarSrc}
                    alt={displayName}
                    width={24}
                    height={24}
                    sizes="24px"
                    unoptimized
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
              className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card"
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

      {assignees.some((a) => a.managerNote) && (
        <div className="space-y-0.5">
          {assignees
            .filter((a) => a.managerNote)
            .map((a) => (
              <p key={a.userId} className="max-w-48 text-xs text-destructive">
                {a.user.name || a.user.email}: {a.managerNote}
              </p>
            ))}
        </div>
      )}
    </div>
  )
}

function TaskTable({
  tasks,
  role,
  options,
}: {
  tasks: TaskItem[]
  role: "MANAGER" | "WORKER"
  options: Options
}) {
  return (
    <Table
      containerClassName="max-h-[min(70svh,48rem)] overflow-auto overscroll-contain rounded-md border bg-card"
      className="min-w-[900px] table-fixed text-left text-sm xl:min-w-full"
    >
      <colgroup>
        <col className="w-[16%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
        <col className="w-[8%]" />
        <col className="w-[11%]" />
        <col className="w-[12%]" />
        <col className="w-[180px]" />
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
              className={`sticky top-0 z-10 border-b border-border bg-muted ${h === "Status" ? "px-2" : "px-4"} py-3 align-middle font-medium`}
            >
              {h}
            </TableHead>
          ))}
        </TableRow>
      </TableHeader>
      <TableBody className="divide-y">
        {tasks.map((task) => (
          <TableRow key={task.id} className="align-middle">
            <TableCell className="max-w-xs px-4 py-4 break-words">
              <div className="space-y-1">
                <p className="font-medium text-foreground">{task.title}</p>
                <p className="text-xs text-muted-foreground">
                  {task.type === TaskType.DAILY_ENTRY
                    ? `Daily entry · ${dateText(task.workDate)}`
                    : "Assigned task"}
                </p>
              </div>
            </TableCell>
            <TableCell className="px-4 py-4 break-words">
              <p className="font-medium">{task.project.name}</p>
              {task.project.client?.name ? (
                <p className="text-xs text-muted-foreground">
                  {task.project.client.name}
                </p>
              ) : null}
            </TableCell>
            <TableCell className="px-4 py-4">
              <AssigneeAvatars assignees={task.assignees} />
            </TableCell>
            <TableCell className="px-4 py-4">
              <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground capitalize">
                {task.priority.toLowerCase()}
              </span>
            </TableCell>
            <TableCell className="px-4 py-4 text-sm text-muted-foreground">
              {dateText(
                task.type === TaskType.DAILY_ENTRY ? task.workDate : task.dueAt
              )}
            </TableCell>
            <TableCell className="px-2 py-4 whitespace-nowrap sm:px-4">
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
            <TableCell className="px-4 py-4">
              <TaskControls task={task} role={role} options={options} compact />
            </TableCell>
          </TableRow>
        ))}
        {tasks.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={7}
              className="px-4 py-14 text-center text-muted-foreground"
            >
              No tasks match these filters.
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
}: {
  task: TaskItem
  role: "MANAGER" | "WORKER"
  options: Options
  compact?: boolean
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  const own = task.myStatus
  const update = (next: TaskStatus) =>
    start(async () => {
      const result = await updateAssignmentStatus(task.id, next)
      setError(result.error ?? "")
    })

  if (role === "WORKER") {
    return (
      <div className="flex flex-wrap items-center gap-1">
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
    <div className="flex flex-wrap items-center gap-1.5">
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
}: {
  task: TaskItem
  role: "MANAGER" | "WORKER"
  options: Options
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            Title
            <input
              name="title"
              required
              maxLength={160}
              defaultValue={task.title}
              className="h-10 w-full rounded-md border bg-background px-3 font-normal"
            />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Description
            <textarea
              name="description"
              maxLength={5000}
              rows={3}
              defaultValue={task.description ?? ""}
              className="w-full rounded-md border bg-background p-3 font-normal"
            />
          </label>
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
                <label className="space-y-1.5 text-sm font-medium">
                  Start date
                  <input
                    name="startAt"
                    type="date"
                    defaultValue={defaultDate(task.startAt)}
                    className="h-10 w-full rounded-md border bg-background px-3 font-normal"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Due date
                  <input
                    name="dueAt"
                    type="date"
                    defaultValue={defaultDate(task.dueAt)}
                    className="h-10 w-full rounded-md border bg-background px-3 font-normal"
                  />
                </label>
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
                          className={`flex size-6 shrink-0 items-center justify-center overflow-hidden rounded-full text-[10px] font-bold ${colorClass}`}
                        >
                          {avatarSrc ? (
                            <Image
                              src={avatarSrc}
                              alt=""
                              width={24}
                              height={24}
                              sizes="24px"
                              unoptimized
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </span>
                        <span>{worker.name || worker.email}</span>
                      </label>
                    )
                  })}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Specializations</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.values(Specialization).map((specialization) => (
                    <label
                      key={specialization}
                      className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5"
                    >
                      <input
                        type="checkbox"
                        name="specialization"
                        value={specialization}
                        defaultChecked={task.specializations.some(
                          (item) => item.specialization === specialization
                        )}
                        className="size-4 accent-primary"
                      />
                      <span>
                        {specialization.replaceAll("_", " ").toLowerCase()}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <label className="block space-y-1.5 text-sm font-medium">
              Work date
              <input
                name="workDate"
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                required
                defaultValue={defaultDate(task.workDate)}
                className="h-10 w-full rounded-md border bg-background px-3 font-normal"
              />
            </label>
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

function DeleteTask({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [error, setError] = useState("")
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
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
                      <p className="mt-1 text-xs text-destructive">
                        Manager note:{" "}
                        {
                          task.assignees.find((a) => a.isCurrentUser)
                            ?.managerNote
                        }
                      </p>
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
      }
      return
    }

    setMessage("")
    startTransition(async () => {
      const result = await updateAssignmentStatus(taskId, next)
      if (result.error) {
        setMessage(result.error)
        return
      }
      setMessage(`Moved to ${labels[next].toLowerCase()}.`)
      router.refresh()
    })
  }

  return (
    <div className="w-full max-w-full min-w-0 space-y-3 overflow-hidden">
      <p className="text-xs text-muted-foreground">
        {role === "MANAGER"
          ? "Only tasks awaiting review can be dragged. Drop one into In progress or Completed to open the review actions."
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
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<string>).detail
      setTask(tasks.find((item) => item.id === id) ?? null)
      setError("")
    }
    window.addEventListener("task-review", listener)
    return () => window.removeEventListener("task-review", listener)
  }, [tasks])

  const handleReview = (formData: FormData) => {
    if (!task) return
    setError("")
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {task?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Approve for everyone, or select workers who need to resubmit.
          </p>
          <form action={handleReview} className="space-y-3">
            <input type="hidden" name="decision" value="approve" />
            <Button type="submit" disabled={pending}>
              <Check className="size-4" />
              Approve task
            </Button>
          </form>
          <form action={handleReview} className="space-y-3">
            <input type="hidden" name="decision" value="return" />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Ask to resubmit</legend>
              {task?.assignees.map((a) => (
                <label
                  key={a.userId}
                  className="flex items-center gap-2 text-sm"
                >
                  <input type="checkbox" name="returnUserId" value={a.userId} />
                  {a.user.name || a.user.email}
                </label>
              ))}
            </fieldset>
            <textarea
              name="managerNote"
              required
              maxLength={3000}
              placeholder="Explain what needs to change"
              className="w-full rounded-md border bg-background p-3 text-sm"
            />
            {error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : null}
            <Button type="submit" variant="outline" disabled={pending}>
              Return selected
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  )
}
