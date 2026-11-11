import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react"
import { Link, useRouter } from "@tanstack/react-router"
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Sparkles,
  User,
} from "lucide-react"
import {
  addProjectClient,
  createProject,
  getAssignableProjects,
  type AssignableProjectOption,
  type ProjectActionState,
} from "@/src/server/actions/projects"
import { cleanClientName } from "@/lib/format"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxInputGroup,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxTrigger,
} from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Pagination } from "@/components/ui/pagination"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import type { SearchParamsRecord } from "@/lib/pagination"
import { useDebounce } from "@uidotdev/usehooks"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type ClientOption = {
  id: string
  name: string | null
  email?: string | null
}

export type ProjectTask = {
  id: string
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED"
  dueAt: Date | string | null
}

export type ProjectItem = {
  id: string
  name: string
  description: string | null
  createdAt: Date | string
  updatedAt: Date | string
  client: { id: string; name: string | null }
  taskSummary: {
    total: number
    completed: number
    review: boolean
    latestDueAt: Date | null
  }
  status: "PLANNING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED"
}

function getClientAvatarColor(name: string): string {
  const colors = [
    "bg-orange-600 text-white",
    "bg-blue-600 text-white",
    "bg-purple-600 text-white",
    "bg-emerald-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-white",
  ]
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length]
}

function formatDate(dateValue: Date | string | null | undefined): string {
  if (!dateValue) return "No date set"
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue
  if (Number.isNaN(date.getTime())) return "No date set"
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function ViewProjectDialog({
  project,
  status,
  completedTasks,
  totalTasks,
  percentComplete,
  trigger = true,
}: {
  project: ProjectItem
  status: "PLANNING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED"
  completedTasks: number
  totalTasks: number
  percentComplete: number
  trigger?: boolean
}) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (trigger) return
    const openProject = (event: Event) => {
      if ((event as CustomEvent<string>).detail === project.id) setOpen(true)
    }
    window.addEventListener("project-view", openProject)
    return () => window.removeEventListener("project-view", openProject)
  }, [project.id, trigger])
  const clientDisplayName =
    cleanClientName(project.client.name) || "Unnamed client"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs text-foreground hover:bg-muted"
          >
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
        }
      />
      ) : null}
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Project Details
            </span>
            <span className="text-muted-foreground/30">•</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold tracking-wider uppercase ${
                status === "COMPLETED"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : status === "IN_REVIEW"
                    ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                    : status === "IN_PROGRESS"
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                      : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
              }`}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          <DialogTitle className="mt-1 text-xl leading-snug font-semibold text-foreground">
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Client & Date Card */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="size-3" />
                <span>Client</span>
              </span>
              <p className="mt-0.5 font-semibold text-foreground">
                {clientDisplayName}
              </p>
            </div>

            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                <span>Last Updated</span>
              </span>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(project.updatedAt)}
              </p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-2.5 rounded-lg border border-border bg-card/60 p-3.5 text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Layers className="size-3.5 text-orange-500" />
                <span>Task Progress</span>
              </span>
              <span className="font-semibold text-foreground">
                {completedTasks} / {totalTasks} tasks ({percentComplete}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full border border-border/60 bg-muted">
              <div
                className="h-full rounded-full bg-orange-600 transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Description
            </h4>
            {project.description ? (
              <div className="rounded-md border border-border bg-background p-3 text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                {project.description}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No description provided for this project.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="-mx-4 mt-4 -mb-4 border-t border-border bg-muted/40 px-4 py-3">
          <DialogClose
            render={
              <Button variant="outline" className="h-8 text-xs">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateProjectDialog({ clients }: { clients: ClientOption[] }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"create" | "assign">("create")
  const formRef = useRef<HTMLFormElement>(null)
  const [state, setState] = useState<ProjectActionState>({})
  const [pending, startTransition] = useTransition()
  const [projectSearch, setProjectSearch] = useState("")
  const [assignableProjects, setAssignableProjects] = useState<AssignableProjectOption[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState("")
  const [selectedClientId, setSelectedClientId] = useState("")
  const [projectsLoading, setProjectsLoading] = useState(false)
  const [projectsError, setProjectsError] = useState<string | null>(null)
  const router = useRouter()

  const clientItems = useMemo(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: cleanClientName(client.name) || "Unnamed client",
      })),
    [clients]
  )

  const projectItems = useMemo(
    () =>
      assignableProjects.map((project) => ({
        value: project.id,
        label: `${project.name} · ${project.clientNames.map((name) => cleanClientName(name)).join(", ") || "Unnamed client"}`,
      })),
    [assignableProjects],
  )
  const selectedProject = assignableProjects.find((project) => project.id === selectedProjectId)
  const availableClientItems = clientItems.filter((client) => !selectedProject?.clientIds.includes(client.value))

  useEffect(() => {
    if (!open || mode !== "assign") return

    let cancelled = false
    const timeout = window.setTimeout(() => {
      setProjectsLoading(true)
      setProjectsError(null)
      void getAssignableProjects(projectSearch).then((projects) => {
        if (!cancelled) setAssignableProjects(projects)
      }).catch(() => {
        if (!cancelled) setProjectsError("Projects could not be loaded. Try again.")
      }).finally(() => {
        if (!cancelled) setProjectsLoading(false)
      })
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
    }
  }, [mode, open, projectSearch])

  const handleSubmit = (formData: FormData) => {
    setState({})
    startTransition(async () => {
      const res = await createProject({}, formData)
      setState(res)
      if (res.success) {
        formRef.current?.reset()
        setOpen(false)
        await router.invalidate()
      }
    })
  }

  const handleAddClient = () => {
    if (!selectedProjectId || !selectedClientId) {
      setState({ error: "Choose both a project and a client." })
      return
    }

    setState({})
    startTransition(async () => {
      const res = await addProjectClient(selectedProjectId, selectedClientId)
      setState(res)
      if (res.success) {
        setSelectedProjectId("")
        setSelectedClientId("")
        setProjectSearch("")
        setOpen(false)
        await router.invalidate()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="h-9 w-full gap-2 rounded-full bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-orange-700 sm:w-auto">
            <Plus className="size-4" />
            <span>Create or Add Project</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-600/15 text-orange-600 dark:text-orange-400">
              <FolderPlus className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Create or Add Client to Project
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Create a project for a client or add another client to an existing project.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {clients.length === 0 ? (
          <div className="my-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            No eligible clients found. Go to <strong>Team Invitations</strong>{" "}
            to invite a client and ensure they have accepted before creating a
            project.
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div role="group" aria-label="Project action" className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                aria-pressed={mode === "create"}
                variant={mode === "create" ? "default" : "outline"}
                className={mode === "create" ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
                onClick={() => { setMode("create"); setState({}) }}
              >
                Create New Project
              </Button>
              <Button
                type="button"
                aria-pressed={mode === "assign"}
                variant={mode === "assign" ? "default" : "outline"}
                className={mode === "assign" ? "bg-orange-600 text-white hover:bg-orange-700" : ""}
                onClick={() => { setMode("assign"); setState({}) }}
              >
                Add Client to Project
              </Button>
            </div>

            {mode === "create" ? (
          <form ref={formRef} action={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="create-project-name"
                className="text-xs font-medium text-foreground"
              >
                Project Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="create-project-name"
                name="name"
                required
                maxLength={120}
                placeholder="e.g. North Coast Campaign"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="create-project-client"
                className="text-xs font-medium text-foreground"
              >
                Client <span className="text-rose-500">*</span>
              </Label>
              <Select name="clientId" required items={clientItems}>
                <SelectTrigger
                  id="create-project-client"
                  className="h-9 w-full text-xs"
                >
                  <SelectValue placeholder="Choose an active client" />
                </SelectTrigger>
                <SelectContent>
                  {clientItems.map((client) => (
                    <SelectItem
                      key={client.value}
                      value={client.value}
                      className="text-xs"
                    >
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="create-project-desc"
                className="text-xs font-medium text-foreground"
              >
                Description{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Textarea
                id="create-project-desc"
                name="description"
                maxLength={5000}
                rows={4}
                placeholder="Add deliverables, shoot notes, and scope details..."
                className="text-xs leading-relaxed"
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {state.error}
              </p>
            ) : null}

            <DialogFooter className="-mx-4 mt-5 -mb-4 border-t border-border bg-muted/30 px-4 py-3">
              <DialogClose
                render={
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                  >
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                disabled={pending}
                className="h-8 gap-1.5 bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
              >
                <Sparkles className="size-3.5" />
                <span>{pending ? "Creating project…" : "Create Project"}</span>
              </Button>
            </DialogFooter>
          </form>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="assign-project-select" className="text-xs font-medium text-foreground">
                    Project <span className="text-rose-500">*</span>
                  </Label>
                  <Combobox
                    items={projectItems.map((project) => project.value)}
                    value={selectedProjectId || null}
                    onValueChange={(value) => {
                      setSelectedProjectId(value ?? "")
                      setSelectedClientId("")
                    }}
                    onInputValueChange={(value, details) => {
                      if (details.reason === "input-change" || details.reason === "input-clear") {
                        setSelectedProjectId("")
                        setProjectSearch(value)
                      }
                    }}
                    itemToStringLabel={(value) => projectItems.find((project) => project.value === value)?.label ?? ""}
                    autoHighlight
                  >
                    <ComboboxInputGroup>
                      <ComboboxInput
                        id="assign-project-select"
                        placeholder={projectsLoading ? "Loading projects…" : "Search or choose a project"}
                        className="h-9"
                      />
                      <ComboboxTrigger aria-label="Show projects" />
                    </ComboboxInputGroup>
                    <ComboboxPopup>
                      <ComboboxList>
                        <ComboboxEmpty>
                          {projectsLoading
                            ? "Searching projects…"
                            : projectsError
                              ? projectsError
                              : "No matching projects found."}
                        </ComboboxEmpty>
                        {projectItems.map((project) => (
                          <ComboboxItem key={project.value} value={project.value}>
                            {project.label}
                          </ComboboxItem>
                        ))}
                      </ComboboxList>
                    </ComboboxPopup>
                  </Combobox>
                  {projectsError ? <p role="alert" className="text-xs text-destructive">{projectsError}</p> : null}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="assign-project-client" className="text-xs font-medium text-foreground">
                    Client to Add <span className="text-rose-500">*</span>
                  </Label>
                  <Select value={selectedClientId || null} onValueChange={(value) => setSelectedClientId(value ?? "")} items={availableClientItems}>
                    <SelectTrigger id="assign-project-client" className="h-9 w-full text-xs">
                      <SelectValue placeholder="Choose a client to add" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableClientItems.map((client) => (
                        <SelectItem key={client.value} value={client.value} className="text-xs">
                          {client.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProject && availableClientItems.length === 0 ? (
                    <p className="text-xs text-muted-foreground">All active clients already have access to this project.</p>
                  ) : null}
                </div>

                <p className="rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                  The new client will get access to this project. Existing clients will keep their access.
                </p>

                {state.error ? <p role="alert" className="text-xs font-medium text-destructive">{state.error}</p> : null}
                <DialogFooter className="-mx-4 mt-5 -mb-4 border-t border-border bg-muted/30 px-4 py-3">
                  <DialogClose render={<Button type="button" variant="outline" className="h-8 px-3 text-xs">Cancel</Button>} />
                  <Button type="button" disabled={pending || projectsLoading || !selectedProjectId || !selectedClientId} onClick={handleAddClient} className="h-8 bg-orange-600 px-4 text-xs font-semibold text-white hover:bg-orange-700">
                    {pending ? "Adding client…" : "Add Client"}
                  </Button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function ProjectManagement({
  projects,
  clients,
  summary,
  page,
  totalPages,
  totalProjects,
  searchParams,
}: {
  projects: ProjectItem[]
  clients: ClientOption[]
  summary: {
    active: number
    inReview: number
    completed: number
    totalTasks: number
    completedTasks: number
  }
  page: number
  totalPages: number
  totalProjects: number
  searchParams: SearchParamsRecord
}) {
  const router = useRouter()
  const projectsWithMeta = useMemo(() => {
    return projects.map((p) => {
      const totalTasks = p.taskSummary.total
      const completedTasks = p.taskSummary.completed
      const percentComplete =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0
      const targetDateStr = p.taskSummary.latestDueAt
        ? formatDate(p.taskSummary.latestDueAt)
        : formatDate(p.updatedAt)

      return {
        ...p,
        status: p.status,
        totalTasks,
        completedTasks,
        percentComplete,
        targetDateStr,
      }
    })
  }, [projects])

  const filteredProjects = projectsWithMeta
  const search = typeof searchParams.q === "string" ? searchParams.q : ""
  const clientFilter =
    typeof searchParams.client === "string" ? searchParams.client : "ALL"
  const [searchQuery, setSearchQuery] = useState(search)
  const debouncedSearchQuery = useDebounce(searchQuery, 350)
  const [prevSearch, setPrevSearch] = useState(search)
  if (prevSearch !== search) {
    setPrevSearch(search)
    setSearchQuery(search)
  }
  const [clientDraft, setClientDraft] = useState({
    source: clientFilter,
    value: clientFilter,
  })
  const selectedClient =
    clientDraft.source === clientFilter ? clientDraft.value : clientFilter
  const clientFilterOptions = useMemo(
    () =>
      Array.from(
        new Set(
          clients.map(
            (client) => cleanClientName(client.name) || "Unnamed client"
          )
        )
      ),
    [clients]
  )

  const updateProjectFilters = useCallback(
    (nextSearch: string, nextClient: string) => {
      const params = new URLSearchParams()
      const trimmedSearch = nextSearch.trim()
      if (trimmedSearch) params.set("q", trimmedSearch)
      if (nextClient !== "ALL") params.set("client", nextClient)
      const query = params.toString()
      router.navigate({
        href: query ? `/manager/projects?${query}` : "/manager/projects",
        replace: true,
      })
    },
    [router]
  )

  useEffect(() => {
    if (
      debouncedSearchQuery.trim() !== searchQuery.trim() ||
      debouncedSearchQuery.trim() === search.trim()
    )
      return
    updateProjectFilters(debouncedSearchQuery, selectedClient)
  }, [
    debouncedSearchQuery,
    search,
    searchQuery,
    selectedClient,
    updateProjectFilters,
  ])

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Projects
          </h1>
          <p className="text-xs text-muted-foreground">
            Manage productions, track task progress, and collaborate with
            assigned clients.
          </p>
        </div>

        <div className="w-full sm:w-auto">
          <CreateProjectDialog clients={clients} />
        </div>
      </div>

      {/* KPI Cards Row (Version B) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: In Production */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">In Production</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <Briefcase className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.active}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Active projects
            </span>
          </div>
        </div>

        {/* Metric 2: Awaiting Review */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Awaiting Review</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.inReview}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              With clients
            </span>
          </div>
        </div>

        {/* Metric 3: Task Velocity */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Task Velocity</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.completedTasks}/{summary.totalTasks}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Tasks logged
            </span>
          </div>
        </div>

        {/* Metric 4: Completed */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Completed</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {summary.completed}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Delivered
            </span>
          </div>
        </div>
      </div>

      <section
        aria-label="Project filters"
        className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center"
      >
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search projects or clients"
            aria-label="Search projects or clients"
            className="h-10 bg-background pl-10"
          />
        </div>
        <div className="w-full shrink-0 sm:w-56">
          <Label htmlFor="project-client-filter" className="sr-only">
            Filter by client
          </Label>
          <Select
            value={selectedClient}
            onValueChange={(value) => {
              const nextClient = value ?? "ALL"
              setClientDraft({ source: clientFilter, value: nextClient })
              updateProjectFilters(searchQuery, nextClient)
            }}
            items={[
              { value: "ALL", label: "All clients" },
              ...clientFilterOptions.map((name) => ({
                value: name,
                label: name,
              })),
            ]}
          >
            <SelectTrigger
              id="project-client-filter"
              className="h-10 w-full bg-background"
            >
              <SelectValue placeholder="All clients" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All clients</SelectItem>
              {clientFilterOptions.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FolderKanban className="mb-3 size-10 text-muted-foreground/40" />
            <p className="text-sm font-semibold text-foreground">
              {projects.length === 0
                ? "No projects created yet"
                : "No projects found"}
            </p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {projects.length === 0
                ? "Click the button below to set up your first production project."
                : "No projects match your current search. Try another search."}
            </p>
            {projects.length === 0 ? (
              <div className="mt-4">
                <CreateProjectDialog clients={clients} />
              </div>
            ) : (
              <Button
                nativeButton={false}
                render={<Link to="/manager/projects" />}
                variant="outline"
                size="sm"
                className="mt-4 text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="space-y-3 p-3 lg:hidden">
              {filteredProjects.map((p) => {
                const clientDisplayName =
                  cleanClientName(p.client.name) || "Unnamed client"
                const avatarColor = getClientAvatarColor(clientDisplayName)

                return (
                  <article
                    key={p.id}
                    className="min-w-0 rounded-lg border border-border bg-background p-3.5 shadow-xs cursor-pointer transition-colors hover:border-foreground/20"
                    onClick={() => {
                      router.navigate({
                        to: "/manager/projects/$projectId",
                        params: { projectId: p.id },
                      })
                    }}
                  >
                    <div className="flex min-w-0 items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm leading-snug font-semibold break-words text-foreground">
                          <Link
                            to="/manager/projects/$projectId"
                            params={{ projectId: p.id }}
                            className="hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                          >
                            {p.name}
                          </Link>
                        </h2>
                        {p.description ? (
                          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                            {p.description}
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${
                          p.status === "COMPLETED"
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                            : p.status === "IN_REVIEW"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : p.status === "IN_PROGRESS"
                                ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-500"
                              : p.status === "IN_REVIEW"
                                ? "bg-amber-500"
                                : p.status === "IN_PROGRESS"
                                  ? "bg-sky-500"
                                  : "bg-muted-foreground/60"
                          }`}
                        />
                        {p.status === "IN_PROGRESS"
                          ? "In progress"
                          : p.status === "IN_REVIEW"
                            ? "In review"
                            : p.status === "COMPLETED"
                              ? "Completed"
                              : "Planning"}
                      </span>
                    </div>

                    <div className="mt-3 flex min-w-0 items-center gap-2 border-t border-border pt-3">
                      <span
                        className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}
                      >
                        {clientDisplayName.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 truncate text-xs font-medium text-foreground">
                        {clientDisplayName}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground">
                        {p.targetDateStr}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5">
                      <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
                        <span>
                          {p.completedTasks} of {p.totalTasks} tasks
                        </span>
                        <span className="font-semibold text-foreground tabular-nums">
                          {p.percentComplete}%
                        </span>
                      </div>
                      <div
                        role="progressbar"
                        aria-label={`${p.name} progress`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={p.percentComplete}
                        className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
                      >
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${p.percentComplete}%` }}
                        />
                      </div>
                    </div>

                    <div
                      className="mt-3 flex items-center justify-end gap-2 border-t border-border pt-2.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        nativeButton={false}
                        render={
                          <Link
                            to="/manager/projects/$projectId"
                            params={{ projectId: p.id }}
                          />
                        }
                        size="sm"
                        className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-7"
                      >
                        Open workspace
                      </Button>
                      <ViewProjectDialog
                        project={p}
                        status={p.status}
                        completedTasks={p.completedTasks}
                        totalTasks={p.totalTasks}
                        percentComplete={p.percentComplete}
                      />
                    </div>
                  </article>
                )
              })}
            </div>
            <div className="hidden min-w-0 lg:block">
              <Table className="table-fixed text-left text-sm">
                <colgroup>
                  <col className="w-[28%]" />
                  <col className="w-[18%]" />
                  <col className="w-[12%]" />
                  <col className="w-[14%]" />
                  <col className="w-[16%]" />
                  <col className="w-[12%]" />
                </colgroup>
                <TableHeader className="border-b border-border bg-muted/40 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                  <TableRow>
                    <TableHead className="px-5 py-3">Project Title</TableHead>
                    <TableHead className="px-4 py-3">Client</TableHead>
                    <TableHead className="px-4 py-3">Status</TableHead>
                    <TableHead className="px-4 py-3">Progress</TableHead>
                    <TableHead className="px-4 py-3">
                      Target Date / Updated
                    </TableHead>
                    <TableHead className="px-5 py-3 text-right">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filteredProjects.map((p) => {
                    const clientDisplayName =
                      cleanClientName(p.client.name) || "Unnamed client"
                    const avatarColor = getClientAvatarColor(clientDisplayName)

                    return (
                      <TableRow
                        key={p.id}
                        className="cursor-pointer transition-colors hover:bg-muted/40"
                        onClick={() => {
                          router.navigate({
                            to: "/manager/projects/$projectId",
                            params: { projectId: p.id },
                          })
                        }}
                      >
                        {/* Project Title */}
                        <TableCell className="px-5 py-3.5">
                          <div className="space-y-0.5">
                            <Link
                              to="/manager/projects/$projectId"
                              params={{ projectId: p.id }}
                              className="text-sm font-semibold text-foreground hover:text-orange-600 dark:hover:text-orange-400 transition-colors"
                            >
                              {p.name}
                            </Link>
                            {p.description ? (
                              <p className="line-clamp-1 max-w-sm text-xs text-muted-foreground">
                                {p.description}
                              </p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground/70 italic">
                                No description
                              </p>
                            )}
                          </div>
                        </TableCell>

                        {/* Client with Avatar */}
                        <TableCell className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <span
                              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}
                            >
                              {clientDisplayName.charAt(0).toUpperCase()}
                            </span>
                            <div>
                              <p className="text-xs font-semibold text-foreground">
                                {clientDisplayName}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        {/* Status */}
                        <TableCell className="px-4 py-3.5">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                              p.status === "COMPLETED"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                                : p.status === "IN_REVIEW"
                                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                                  : p.status === "IN_PROGRESS"
                                    ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                                    : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                p.status === "COMPLETED"
                                  ? "bg-emerald-500"
                                  : p.status === "IN_REVIEW"
                                    ? "bg-amber-500"
                                    : p.status === "IN_PROGRESS"
                                      ? "bg-sky-500"
                                      : "bg-slate-400"
                              }`}
                            />
                            {p.status === "IN_PROGRESS"
                              ? "In Progress"
                              : p.status === "IN_REVIEW"
                                ? "In Review"
                                : p.status === "COMPLETED"
                                  ? "Completed"
                                  : "Planning"}
                          </span>
                        </TableCell>

                        {/* Progress Bar */}
                        <TableCell className="px-4 py-3.5">
                          <div className="w-28 space-y-1">
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                              <span>
                                {p.completedTasks}/{p.totalTasks} tasks
                              </span>
                              <span className="font-semibold text-foreground">
                                {p.percentComplete}%
                              </span>
                            </div>
                            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-orange-600 transition-all duration-300"
                                style={{ width: `${p.percentComplete}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>

                        {/* Target Date / Updated */}
                        <TableCell className="px-4 py-3.5 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="size-3.5 text-muted-foreground/70" />
                            <span>{p.targetDateStr}</span>
                          </div>
                        </TableCell>

                        {/* Actions */}
                        <TableCell
                          className="px-5 py-3.5 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <TableRowActions label={`Actions for ${p.name}`}>
                            <DropdownMenuItem
                              render={
                                <Link
                                  to="/manager/projects/$projectId"
                                  params={{ projectId: p.id }}
                                />
                              }
                            >
                              <FolderKanban aria-hidden="true" />
                              Open workspace
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                window.dispatchEvent(
                                  new CustomEvent("project-view", {
                                    detail: p.id,
                                  })
                                )
                              }
                            >
                              <Eye aria-hidden="true" />
                              View quick details
                            </DropdownMenuItem>
                          </TableRowActions>
                          <ViewProjectDialog
                            project={p}
                            status={p.status}
                            completedTasks={p.completedTasks}
                            totalTasks={p.totalTasks}
                            percentComplete={p.percentComplete}
                            trigger={false}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </>
        )}

        {/* Table Footer */}
        <div className="flex flex-col gap-1.5 border-t border-border bg-muted/20 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <span className="min-w-0">
            Showing{" "}
            <strong className="text-foreground">
              {filteredProjects.length}
            </strong>{" "}
            of {totalProjects} projects
          </span>
          <span className="text-[11px] sm:text-right">
            Sorted by most recently updated
          </span>
        </div>
      </div>
      <Pagination
        pathname="/manager/projects"
        searchParams={searchParams}
        page={page}
        totalPages={totalPages}
        totalItems={totalProjects}
      />
    </div>
  )
}
