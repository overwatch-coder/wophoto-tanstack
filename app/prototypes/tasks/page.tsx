"use client"

import * as React from "react"
import {
  AlignLeft,
  CalendarDays,
  Check,
  ChevronDown,
  ClipboardList,
  Columns3,
  Image as ImageIcon,
  LayoutDashboard,
  ListFilter,
  LogOut,
  Moon,
  Plus,
  Search,
  Sun,
  Trash2,
  Users,
  X,
} from "lucide-react"

import { DaybookView } from "./daybook-view"
import { initialTasks, statusLabels } from "./data"
import { FlowView } from "./flow-view"
import { TriageView } from "./triage-view"
import type {
  PrototypeRole,
  PrototypeTask,
  PrototypeTaskStatus,
  TaskViewProps,
} from "./types"

type ViewMode = "table" | "board" | "daybook"

const initialsToName: Record<string, string> = {
  AM: "Amina M.",
  JL: "Jonah L.",
  SK: "Sana K.",
}

export default function TaskPrototypePage() {
  const [viewMode, setViewMode] = React.useState<ViewMode>(() => {
    if (typeof window !== "undefined") {
      const view = new URLSearchParams(window.location.search).get("view")
      if (view === "table" || view === "board" || view === "daybook") {
        return view
      }
    }
    return "table"
  })
  const [role, setRole] = React.useState<PrototypeRole>("MANAGER")
  const [tasks, setTasks] = React.useState(initialTasks)
  const [query, setQuery] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState("all")
  const [priorityFilter, setPriorityFilter] = React.useState("all")
  const [dialog, setDialog] = React.useState<
    "create" | "delete" | "return" | null
  >(null)
  const [activeTask, setActiveTask] = React.useState<PrototypeTask | null>(null)
  const [returnNote, setReturnNote] = React.useState("")
  const [selectedAssignees, setSelectedAssignees] = React.useState<string[]>([])
  const [toast, setToast] = React.useState("")
  const [dark, setDark] = React.useState(false)

  React.useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(""), 2400)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const filteredTasks = tasks.filter((task) => {
    const matchesText =
      `${task.title} ${task.project} ${task.assignees.join(" ")}`
        .toLowerCase()
        .includes(query.toLowerCase())
    return (
      matchesText &&
      (statusFilter === "all" || task.status === statusFilter) &&
      (priorityFilter === "all" || task.priority === priorityFilter)
    )
  })

  const taskActions: TaskViewProps = {
    tasks: filteredTasks,
    role,
    onStatusChange: (id: string, status: PrototypeTaskStatus) => {
      setTasks((current) =>
        current.map((task) => (task.id === id ? { ...task, status } : task))
      )
      setToast(
        status === "COMPLETED"
          ? "Task approved"
          : status === "IN_REVIEW"
            ? "Submitted for review"
            : `Status changed to ${statusLabels[status]}`
      )
    },
    onDelete: (task) => {
      setActiveTask(task)
      setDialog("delete")
    },
    onReturn: (task) => {
      setActiveTask(task)
      setReturnNote("")
      setSelectedAssignees(task.assignees)
      setDialog("return")
    },
  }

  const renderView = () => {
    if (viewMode === "board") return <FlowView {...taskActions} />
    if (viewMode === "daybook") return <DaybookView {...taskActions} />
    return <TriageView {...taskActions} />
  }

  function changeView(view: ViewMode) {
    setViewMode(view)
    const url = new URL(window.location.href)
    url.searchParams.set("view", view)
    window.history.replaceState(null, "", url)
  }

  function createTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const title = String(form.get("title") ?? "").trim()
    if (!title) return
    const daily = role === "WORKER"
    const assignees = daily
      ? ["AM"]
      : ["AM", "JL", "SK"].filter((key) =>
          form.getAll("assignees").includes(key)
        )
    const selectedProject = String(
      form.get("project") ?? "North Coast Campaign"
    )
    const newTask: PrototypeTask = {
      id: `t${Date.now()}`,
      title,
      project: selectedProject,
      status: "TODO",
      priority: String(
        form.get("priority") ?? "Medium"
      ) as PrototypeTask["priority"],
      due: String(form.get("due") ?? "") || "No due date",
      kind: daily ? "DAILY_ENTRY" : "ASSIGNED",
      workDate: daily ? "Today" : undefined,
      assignees: assignees.length ? assignees : ["AM"],
    }
    setTasks((current) => [newTask, ...current])
    setDialog(null)
    setToast(daily ? "Daily entry added" : "Task created")
  }

  function confirmDelete() {
    if (!activeTask) return
    setTasks((current) => current.filter((task) => task.id !== activeTask.id))
    setDialog(null)
    setToast("Task moved to Deleted Tasks")
  }

  function returnTask(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!activeTask || !returnNote.trim() || selectedAssignees.length === 0)
      return
    setTasks((current) =>
      current.map((task) =>
        task.id === activeTask.id ? { ...task, status: "IN_PROGRESS" } : task
      )
    )
    setDialog(null)
    setToast(
      `Returned to ${selectedAssignees.map((id) => initialsToName[id] ?? id).join(", ")}`
    )
  }

  return (
    <main
      className={
        dark
          ? "dark min-h-screen bg-background text-foreground"
          : "min-h-screen bg-background text-foreground"
      }
    >
      <div className="flex min-h-screen">
        <aside className="hidden w-60 shrink-0 flex-col border-r bg-sidebar text-sidebar-foreground lg:flex">
          <a
            href="#"
            className="flex h-16 items-center gap-3 border-b px-5 font-semibold tracking-tight"
          >
            <span className="flex size-8 items-center justify-center rounded-sm bg-primary text-primary-foreground">
              <LayersIcon />
            </span>
            WoPhoto
          </a>
          <nav
            aria-label="Workspace navigation"
            className="flex-1 space-y-1 px-3 py-4"
          >
            <SidebarItem icon={<LayoutDashboard />} label="Dashboard" />
            <SidebarItem active icon={<ClipboardList />} label="Tasks" />
            <SidebarItem icon={<Check />} label="Brief Review" />
            <SidebarItem icon={<Trash2 />} label="Deleted Tasks" />
            <SidebarItem icon={<ImageIcon />} label="Brand Assets" />
            <div className="my-4 border-t" />
            <SidebarItem icon={<Users />} label="Team Invitations" />
          </nav>
          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-sm px-2 py-2">
              <span className="flex size-8 items-center justify-center rounded-sm bg-muted text-xs font-medium">
                {role === "MANAGER" ? "OC" : "AM"}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate text-sm">
                  {role === "MANAGER" ? "Overwatch Coder" : "Amina M."}
                </strong>
                <span className="text-xs text-muted-foreground">
                  {role === "MANAGER" ? "Manager" : "Worker"}
                </span>
              </span>
              <LogOut className="size-4 text-muted-foreground" />
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1">
          <header className="flex min-h-16 items-center gap-3 border-b bg-background px-4 sm:px-6">
            <button
              aria-label="Open navigation"
              className="rounded-sm border p-2 lg:hidden"
            >
              <AlignLeft className="size-4" />
            </button>
            <h1 className="flex-1 text-lg font-semibold tracking-tight">
              Tasks
            </h1>
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
              className="rounded-sm border p-2 text-muted-foreground hover:bg-muted"
            >
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setRole((value) =>
                    value === "MANAGER" ? "WORKER" : "MANAGER"
                  )
                }
                className="flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-left hover:bg-muted sm:px-3"
              >
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Preview as
                </span>
                <strong className="text-xs">
                  {role === "MANAGER" ? "Manager" : "Worker"}
                </strong>
                <ChevronDown className="size-3.5 text-muted-foreground" />
              </button>
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-4 pt-6 pb-8 sm:px-6 lg:px-8">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">
                  {role === "MANAGER" ? "Team tasks" : "My tasks"}
                </h2>
                <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">
                  {role === "MANAGER"
                    ? "Assign work across projects and review what your team submits."
                    : "Keep assigned work moving and log what you plan to do today."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDialog("create")}
                className="inline-flex h-9 items-center gap-2 rounded-sm bg-primary px-3.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="size-4" />
                {role === "MANAGER" ? "Create task" : "Log daily work"}
              </button>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
              <Metric
                title="Open tasks"
                value={
                  tasks.filter((task) => task.status !== "COMPLETED").length
                }
                note="Across active projects"
              />
              <Metric
                title="In progress"
                value={
                  tasks.filter((task) => task.status === "IN_PROGRESS").length
                }
                note="Work underway"
              />
              <Metric
                title="Needs review"
                value={
                  tasks.filter((task) => task.status === "IN_REVIEW").length
                }
                note="Ready for manager review"
              />
              <Metric
                title="Completed this week"
                value={
                  tasks.filter((task) => task.status === "COMPLETED").length
                }
                note="Approved tasks"
              />
            </div>

            <div className="mb-4 flex flex-wrap items-center gap-2">
              <label className="relative min-w-[190px] flex-1 sm:max-w-xs">
                <Search
                  aria-hidden="true"
                  className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search tasks or projects"
                  className="h-9 w-full rounded-sm border bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>
              <label className="relative">
                <ListFilter
                  aria-hidden="true"
                  className="absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground"
                />
                <select
                  aria-label="Filter by status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-9 appearance-none rounded-sm border bg-background pr-8 pl-8 text-sm"
                >
                  <option value="all">All statuses</option>
                  {Object.entries(statusLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <label className="relative">
                <select
                  aria-label="Filter by priority"
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className="h-9 appearance-none rounded-sm border bg-background pr-8 pl-3 text-sm"
                >
                  <option value="all">All priorities</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>
                <ChevronDown className="pointer-events-none absolute top-1/2 right-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              </label>
              <div
                className="ml-auto flex items-center rounded-sm border p-0.5"
                aria-label="Task view"
                role="group"
              >
                <ViewButton
                  active={viewMode === "table"}
                  onClick={() => changeView("table")}
                  label="Table"
                >
                  <AlignLeft className="size-3.5" />
                </ViewButton>
                <ViewButton
                  active={viewMode === "board"}
                  onClick={() => changeView("board")}
                  label="Board"
                >
                  <Columns3 className="size-3.5" />
                </ViewButton>
                <ViewButton
                  active={viewMode === "daybook"}
                  onClick={() => changeView("daybook")}
                  label="Daybook"
                >
                  <CalendarDays className="size-3.5" />
                </ViewButton>
              </div>
            </div>
            {renderView()}
          </div>
        </section>
      </div>

      {dialog === "create" && (
        <Modal
          title={role === "MANAGER" ? "Create a task" : "Log daily work"}
          onClose={() => setDialog(null)}
        >
          <form onSubmit={createTask} className="space-y-4">
            <Field label="Task name">
              <input
                autoFocus
                name="title"
                required
                placeholder={
                  role === "MANAGER"
                    ? "e.g. Edit campaign selects"
                    : "What do you plan to work on?"
                }
                className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
              />
            </Field>
            <Field label="Project">
              <select
                name="project"
                className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
              >
                <option>North Coast Campaign</option>
                <option>Solace Product Launch</option>
                <option>Field Notes Series</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Priority">
                <select
                  name="priority"
                  className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                >
                  <option>Medium</option>
                  <option>High</option>
                  <option>Low</option>
                </select>
              </Field>
              <Field label="Due date">
                <input
                  name="due"
                  type="date"
                  className="h-10 w-full rounded-sm border bg-background px-3 text-sm"
                />
              </Field>
            </div>
            {role === "MANAGER" && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium">
                  Assign workers
                </legend>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(initialsToName).map(([initials, name]) => (
                    <label
                      key={initials}
                      className="flex items-center gap-2 rounded-sm border p-2 text-xs"
                    >
                      <input
                        type="checkbox"
                        name="assignees"
                        value={initials}
                      />
                      {name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {role === "WORKER" && (
              <p className="rounded-sm bg-accent/50 p-3 text-xs text-accent-foreground">
                This entry will be dated today in UTC and assigned to you.
              </p>
            )}
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="h-9 rounded-sm border px-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="h-9 rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground"
              >
                {role === "MANAGER" ? "Create task" : "Add daily entry"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {dialog === "delete" && activeTask && (
        <Modal title="Delete this task?" onClose={() => setDialog(null)} alert>
          <p className="text-sm text-muted-foreground">
            “{activeTask.title}” will be moved to Deleted Tasks. You can browse
            and restore it when that area is available.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDialog(null)}
              className="h-9 rounded-sm border px-3 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="h-9 rounded-sm bg-destructive px-3 text-sm font-medium text-white"
            >
              Delete task
            </button>
          </div>
        </Modal>
      )}

      {dialog === "return" && activeTask && (
        <Modal title="Return work for updates" onClose={() => setDialog(null)}>
          <p className="mb-4 text-sm text-muted-foreground">
            Choose who needs to resubmit and add a note for them.
          </p>
          <form onSubmit={returnTask} className="space-y-4">
            <fieldset>
              <legend className="mb-2 text-sm font-medium">
                Assignees to resubmit
              </legend>
              <div className="space-y-2">
                {activeTask.assignees.map((person) => (
                  <label
                    key={person}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAssignees.includes(person)}
                      onChange={(event) =>
                        setSelectedAssignees((current) =>
                          event.target.checked
                            ? [...current, person]
                            : current.filter((id) => id !== person)
                        )
                      }
                    />
                    {initialsToName[person] ?? person}
                  </label>
                ))}
              </div>
            </fieldset>
            <Field label="Note for selected workers">
              <textarea
                value={returnNote}
                onChange={(event) => setReturnNote(event.target.value)}
                required
                rows={3}
                placeholder="Describe what needs another pass"
                className="w-full resize-y rounded-sm border bg-background px-3 py-2 text-sm"
              />
            </Field>
            <div className="flex justify-end gap-2 border-t pt-4">
              <button
                type="button"
                onClick={() => setDialog(null)}
                className="h-9 rounded-sm border px-3 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!returnNote.trim() || selectedAssignees.length === 0}
                className="h-9 rounded-sm bg-primary px-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Return task
              </button>
            </div>
          </form>
        </Modal>
      )}

      {toast && (
        <div
          role="status"
          className="fixed top-5 right-5 z-50 flex items-center gap-2 rounded-sm border bg-card px-4 py-3 text-sm shadow-lg"
        >
          <Check className="size-4 text-primary" />
          {toast}
          <button
            type="button"
            aria-label="Dismiss message"
            onClick={() => setToast("")}
            className="ml-2 text-muted-foreground"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </main>
  )
}

function SidebarItem({
  icon,
  label,
  active = false,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
}) {
  return (
    <a
      href="#"
      aria-current={active ? "page" : undefined}
      className={`flex h-9 items-center gap-3 rounded-sm px-2.5 text-sm ${active ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"}`}
    >
      <span className="[&_svg]:size-4">{icon}</span>
      {label}
      {label !== "Tasks" && (
        <span className="ml-auto text-xs text-muted-foreground">
          Coming soon
        </span>
      )}
    </a>
  )
}

function Metric({
  title,
  value,
  note,
}: {
  title: string
  value: number
  note: string
}) {
  return (
    <section className="rounded-md border bg-card px-4 py-3.5">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-1 flex items-end justify-between gap-3">
        <strong className="text-2xl font-semibold tracking-tight">
          {value}
        </strong>
        <span className="hidden text-right text-[11px] text-muted-foreground sm:block">
          {note}
        </span>
      </div>
    </section>
  )
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean
  onClick: () => void
  label: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={`${label} view`}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded-sm px-2 text-xs ${active ? "bg-muted font-medium text-foreground" : "text-muted-foreground hover:text-foreground"}`}
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  )
}

function Modal({
  title,
  onClose,
  children,
  alert = false,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
  alert?: boolean
}) {
  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role={alert ? "alertdialog" : "dialog"}
        aria-modal="true"
        aria-labelledby="prototype-modal-title"
        className="w-full max-w-lg rounded-md border bg-card p-5 shadow-xl"
      >
        <header className="mb-4 flex items-center justify-between gap-3">
          <h2 id="prototype-modal-title" className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
    </label>
  )
}

function LayersIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="size-4"
      aria-hidden="true"
    >
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5M3 16l9 5 9-5" />
    </svg>
  )
}
