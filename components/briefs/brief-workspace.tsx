import { useEffect, useMemo, useRef, useState, useTransition } from "react"
import { useDebounce } from "@uidotdev/usehooks"
import { useRouter, useLocation } from "@tanstack/react-router"
import {
  BriefStatus,
  SignOffStatus,
  UserRole,
} from "@/generated/prisma/browser"
import {
  formatBriefStatus,
  formatSignOffStatus,
  getBriefStatusBadgeClass,
  getSignOffStatusBadgeClass,
  BRIEF_STATUS_LABELS,
  formatBriefOption,
} from "@/components/briefs/labels"
import {
  BriefDialog,
  type CreativeBriefFormData,
} from "@/components/briefs/brief-dialog"
import { BriefSignOffDialog } from "@/components/briefs/brief-signoff-dialog"
import {
  BriefDiscussion,
  type BriefQuestionItem,
} from "@/components/briefs/brief-discussion"
import { Button, buttonVariants } from "@/components/ui/button"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  deleteCreativeBrief,
  publishCreativeBrief,
  setBriefStatus,
  waiveBriefSignOff,
  addBriefReviewer,
  removeBriefReviewer,
  updateShotItemStatus,
} from "@/src/server/actions/briefs"
import { getProfileImageSrc } from "@/lib/profile-image"
import { type ShotItem, type ShotStatus } from "@/lib/validation/briefs"
import { cn } from "cn"
import {
  Search,
  Plus,
  ExternalLink,
  Download,
  CheckCircle2,
  Camera,
  Star,
  Users,
  FileText,
  ChevronDown,
  ChevronUp,
  Edit2,
  Send,
  Loader2,
  X,
  LayoutGrid,
  List,
  Trash2,
} from "lucide-react"

export interface SerializedBriefSignOff {
  id: string
  briefId: string
  userId: string
  version: number
  status: SignOffStatus
  signedAt: string | null
  note: string | null
  waivedAt: string | null
  waiveReason: string | null
  user: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  waivedBy?: {
    id: string
    name: string | null
    email: string | null
  } | null
}

export interface SerializedCreativeBrief {
  id: string
  title: string
  summary: string | null
  status: BriefStatus
  isPrimary: boolean
  version: number
  revisionSummary: string | null
  deliverables: string | null
  guidelines: string | null
  shotList: ShotItem[] | null
  externalUrl: string | null
  fileUrl: string | null
  fileKey: string | null
  fileName: string | null
  fileSize: number | null
  fileMime: string | null
  tags: string[]
  projectId: string
  project: {
    id: string
    name: string
    clientId: string
  }
  createdBy: {
    id: string
    name: string | null
    email: string | null
    image: string | null
  }
  signOffs: SerializedBriefSignOff[]
  questions?: BriefQuestionItem[]
  readiness: {
    totalEnrolled: number
    signedCount: number
    waivedCount: number
    pendingCount: number
    percentage: number
    isReady: boolean
  }
  shotStats: {
    total: number
    completed: number
    inProgress: number
    skipped: number
    planned: number
    percentage: number
  }
  userSignOff?: SerializedBriefSignOff | null
  createdAt: string
  updatedAt: string
}

function canDeleteDraftBrief(brief: SerializedCreativeBrief) {
  return (
    brief.status === BriefStatus.DRAFT &&
    brief.signOffs.every((signOff) => signOff.status === SignOffStatus.PENDING) &&
    (brief.questions?.length ?? 0) === 0
  )
}

interface ProjectOption {
  id: string
  name: string
  clientId: string
}

interface WorkerOption {
  id: string
  name: string | null
  email: string | null
}

interface BriefWorkspaceProps {
  initialBriefs: SerializedCreativeBrief[]
  projects: ProjectOption[]
  workers: WorkerOption[]
  currentUserId: string
  role: UserRole
  totalBriefs: number
  page: number
  pageSize: number
}

export function BriefWorkspace({
  initialBriefs,
  projects,
  workers,
  currentUserId,
  role,
  totalBriefs,
  page,
  pageSize,
}: BriefWorkspaceProps) {
  const router = useRouter()
  const location = useLocation()
  const pathname = location.pathname
  const searchParams = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr])
  const [isFilterPending, startTransition] = useTransition()

  const isManager = role === UserRole.MANAGER
  const isWorker = role === UserRole.WORKER
  const isClient = role === UserRole.CLIENT

  const requestedStatus = searchParams.get("status") || "ALL"
  const currentStatus =
    requestedStatus in BRIEF_STATUS_LABELS ? requestedStatus : "ALL"
  const requestedProject = searchParams.get("project") || "ALL"
  const currentProject = projects.some(
    (project) => project.name === requestedProject
  )
    ? requestedProject
    : "ALL"
  const currentSearch = searchParams.get("search") || ""

  const [searchInput, setSearchInput] = useState(currentSearch)
  const debouncedSearch = useDebounce(searchInput, 500)
  const lastAppliedSearch = useRef(currentSearch)
  const [viewMode, setViewMode] = useState<"cards" | "table">("table")
  const [expandedBriefId, setExpandedBriefId] = useState<string | null>(
    initialBriefs[0]?.id || null
  )

  // Modals state
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedBrief, setSelectedBrief] =
    useState<CreativeBriefFormData | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    title: string
  } | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [isDeletingBrief, setIsDeletingBrief] = useState(false)

  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false)
  const [signOffTargetBrief, setSignOffTargetBrief] = useState<{
    id: string
    title: string
    version: number
    project?: { name: string } | null
  } | null>(null)

  // Active action loaders
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  // Reviewer add state
  const [addingReviewerBriefId, setAddingReviewerBriefId] = useState<
    string | null
  >(null)
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>("")

  const updateFilters = (updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString())
    if (Object.keys(updates).some((key) => key !== "page"))
      params.delete("page")
    for (const [key, val] of Object.entries(updates)) {
      if (val === null || val === "" || val === "ALL") {
        params.delete(key)
      } else {
        params.set(key, val)
      }
    }
    if (Object.hasOwn(updates, "search")) {
      lastAppliedSearch.current = updates.search?.trim() || ""
    }
    startTransition(() => {
      router.navigate({ href: `${pathname}?${params.toString()}` })
    })
  }

  useEffect(() => {
    if (debouncedSearch !== searchInput) return
    const search = debouncedSearch.trim()
    if (search === currentSearch.trim()) {
      lastAppliedSearch.current = currentSearch
      return
    }
    const params = new URLSearchParams(searchParams.toString())
    params.delete("page")
    if (search) params.set("search", search)
    else params.delete("search")
    lastAppliedSearch.current = search
    startTransition(() => {
      router.navigate({
        href: params.size ? `${pathname}?${params.toString()}` : pathname,
        replace: true,
      })
    })
  }, [
    currentSearch,
    debouncedSearch,
    pathname,
    router,
    searchInput,
    searchParams,
  ])

  useEffect(() => {
    if (currentSearch === lastAppliedSearch.current) return
    lastAppliedSearch.current = currentSearch
    setSearchInput(currentSearch)
  }, [currentSearch])

  const handlePublish = async (briefId: string) => {
    setActionLoadingId(`publish-${briefId}`)
    await publishCreativeBrief(briefId)
    setActionLoadingId(null)
    router.invalidate()
  }

  const handleStatusChange = async (briefId: string, status: BriefStatus) => {
    setActionLoadingId(`status-${briefId}`)
    await setBriefStatus({ id: briefId, status })
    setActionLoadingId(null)
    router.invalidate()
  }

  const handleWaive = async (briefId: string, userId: string) => {
    const reason = prompt(
      "Enter the reason for waiving this worker's sign-off:"
    )
    if (!reason || reason.trim() === "") return

    setActionLoadingId(`waive-${briefId}-${userId}`)
    await waiveBriefSignOff({ briefId, userId, reason: reason.trim() })
    setActionLoadingId(null)
    router.invalidate()
  }

  const handleAddReviewer = async (briefId: string) => {
    if (!selectedWorkerId) return

    setActionLoadingId(`add-rev-${briefId}`)
    await addBriefReviewer({ briefId, userId: selectedWorkerId })
    setActionLoadingId(null)
    setSelectedWorkerId("")
    setAddingReviewerBriefId(null)
    router.invalidate()
  }

  const handleRemoveReviewer = async (briefId: string, userId: string) => {
    if (!confirm("Are you sure you want to remove this reviewer?")) return

    setActionLoadingId(`remove-rev-${briefId}-${userId}`)
    await removeBriefReviewer({ briefId, userId })
    setActionLoadingId(null)
    router.invalidate()
  }

  const handleToggleShot = async (
    briefId: string,
    shotId: string,
    nextStatus: ShotStatus
  ) => {
    setActionLoadingId(`shot-${shotId}`)
    await updateShotItemStatus({ briefId, shotId, status: nextStatus })
    setActionLoadingId(null)
    router.invalidate()
  }

  const handleOpenEdit = (brief: SerializedCreativeBrief) => {
    setSelectedBrief({
      id: brief.id,
      projectId: brief.projectId,
      title: brief.title,
      summary: brief.summary,
      status: brief.status,
      isPrimary: brief.isPrimary,
      version: brief.version,
      deliverables: brief.deliverables,
      guidelines: brief.guidelines,
      shotList: brief.shotList,
      externalUrl: brief.externalUrl,
      fileUrl: brief.fileUrl,
      fileKey: brief.fileKey,
      fileName: brief.fileName,
      fileSize: brief.fileSize,
      fileMime: brief.fileMime,
      tags: brief.tags,
    })
    setDialogOpen(true)
  }

  const requestDeleteBrief = (brief: { id: string; title: string }) => {
    setDialogOpen(false)
    setDeleteError(null)
    setDeleteTarget(brief)
  }

  const handleDeleteBrief = async () => {
    if (!deleteTarget || isDeletingBrief) return

    setIsDeletingBrief(true)
    setDeleteError(null)
    const result = await deleteCreativeBrief({ id: deleteTarget.id })
    setIsDeletingBrief(false)

    if (result.error) {
      setDeleteError(result.error)
      return
    }

    setDeleteTarget(null)
    setSelectedBrief(null)
    setDialogOpen(false)
    router.invalidate()
  }

  const handleOpenSignOff = (brief: SerializedCreativeBrief) => {
    setSignOffTargetBrief({
      id: brief.id,
      title: brief.title,
      version: brief.version,
      project: brief.project,
    })
    setSignOffDialogOpen(true)
  }

  return (
    <div className="space-y-6">
      {/* Page Header: Clean, confident, NO eyebrow pill badges */}
      <div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Creative Brief Review
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Align production teams on shot lists, deliverables, and creative
            guidelines with verified sign-offs.
          </p>
        </div>

        {isManager && (
          <Button
            onClick={() => {
              setSelectedBrief(null)
              setDialogOpen(true)
            }}
            className="flex items-center gap-1.5 self-start sm:self-auto"
          >
            <Plus className="h-4 w-4" />
            New Creative Brief
          </Button>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col items-stretch gap-3 md:flex-row md:items-center">
        {/* Search */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setSearchInput(searchInput.trim())
          }}
          className="relative flex-1"
        >
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search briefs by title, concept, or #tag..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="pr-8 pl-9"
          />
          {isFilterPending ? (
            <Loader2
              aria-label="Updating brief results"
              className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          ) : searchInput ? (
            <button
              type="button"
              onClick={() => setSearchInput("")}
              className="absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </form>

        {/* Project Selector */}
        <Select
          value={currentProject}
          onValueChange={(val) => updateFilters({ project: val })}
        >
          <SelectTrigger className="w-full md:w-56">
            <SelectValue placeholder="All Projects">
              {currentProject === "ALL" ? "All Projects" : currentProject}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.name}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status Selector */}
        <Select
          value={currentStatus}
          onValueChange={(val) => updateFilters({ status: val })}
        >
          <SelectTrigger className="w-full md:w-48">
            <SelectValue placeholder="All Statuses">
              {currentStatus === "ALL"
                ? "All Statuses"
                : BRIEF_STATUS_LABELS[currentStatus as BriefStatus]}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {Object.entries(BRIEF_STATUS_LABELS).map(([status, label]) => (
              <SelectItem key={status} value={status}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {isFilterPending
            ? "Updating results…"
            : `${totalBriefs} ${totalBriefs === 1 ? "brief" : "briefs"}`}
        </p>
        <div
          className="inline-flex w-full rounded-lg border bg-muted/20 p-1 sm:w-auto"
          role="group"
          aria-label="Brief layout"
        >
          <Button
            type="button"
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={viewMode === "cards"}
            onClick={() => setViewMode("cards")}
            className="min-h-10 flex-1 gap-2 sm:flex-none"
          >
            <LayoutGrid className="size-4" />
            Cards
          </Button>
          <Button
            type="button"
            variant={viewMode === "table" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={viewMode === "table"}
            onClick={() => setViewMode("table")}
            className="min-h-10 flex-1 gap-2 sm:flex-none"
          >
            <List className="size-4" />
            Table
          </Button>
        </div>
      </div>

      {/* Briefs Content List */}
      {initialBriefs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed px-4 py-16 text-center">
          <div className="mb-3 rounded-full bg-muted p-4">
            <FileText className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium">No creative briefs found</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            {searchInput || currentProject !== "ALL" || currentStatus !== "ALL"
              ? "Try adjusting your search terms or filters."
              : isManager
                ? "Get started by creating a creative brief for an active project."
                : "No creative briefs have been published for your assigned projects yet."}
          </p>
        </div>
      ) : viewMode === "table" ? (
        <Table containerClassName="rounded-xl border bg-card">
          <TableHeader>
            <TableRow>
              <TableHead>Brief</TableHead>
              <TableHead>Project</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Version</TableHead>
              <TableHead>Crew readiness</TableHead>
              <TableHead>Shots</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {initialBriefs.map((brief) => {
              const userSignOff = brief.userSignOff
              const canSignOff =
                isWorker && userSignOff?.status === SignOffStatus.PENDING

              return (
                <TableRow key={brief.id}>
                  <TableCell className="min-w-56">
                    <div className="font-medium text-foreground">
                      {brief.title}
                    </div>
                    {brief.isPrimary && (
                      <span className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Star className="size-3 fill-current" /> Primary brief
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-36">
                    {brief.project.name}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${getBriefStatusBadgeClass(brief.status)}`}
                    >
                      {formatBriefStatus(brief.status)}
                    </span>
                  </TableCell>
                  <TableCell>v{brief.version}</TableCell>
                  <TableCell className="min-w-36">
                    {brief.readiness.signedCount + brief.readiness.waivedCount}/
                    {brief.readiness.totalEnrolled} ready (
                    {brief.readiness.percentage}%)
                  </TableCell>
                  <TableCell className="whitespace-nowrap">
                    {brief.shotStats.completed}/{brief.shotStats.total}
                  </TableCell>
                  <TableCell className="text-right">
                    <TableRowActions label={`Actions for ${brief.title}`}>
                      <DropdownMenuItem
                        onClick={() => {
                          setViewMode("cards")
                          setExpandedBriefId(brief.id)
                        }}
                      >
                        View full brief
                      </DropdownMenuItem>
                      {isManager && (
                        <DropdownMenuItem onClick={() => handleOpenEdit(brief)}>
                          Edit brief
                        </DropdownMenuItem>
                      )}
                      {isManager && brief.status === BriefStatus.DRAFT && (
                        <DropdownMenuItem
                          disabled={actionLoadingId === `publish-${brief.id}`}
                          onClick={() => handlePublish(brief.id)}
                        >
                          Publish to crew
                        </DropdownMenuItem>
                      )}
                      {isManager && canDeleteDraftBrief(brief) && (
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => requestDeleteBrief(brief)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete draft brief
                        </DropdownMenuItem>
                      )}
                      {canSignOff && (
                        <DropdownMenuItem
                          onClick={() => handleOpenSignOff(brief)}
                        >
                          Sign off
                        </DropdownMenuItem>
                      )}
                    </TableRowActions>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      ) : (
        <div className="space-y-4">
          {initialBriefs.map((brief) => {
            const isExpanded = expandedBriefId === brief.id
            const userSignOff = brief.userSignOff
            const hasPendingSignOff =
              isWorker &&
              userSignOff &&
              userSignOff.status === SignOffStatus.PENDING
            const hasSigned =
              isWorker &&
              userSignOff &&
              userSignOff.status === SignOffStatus.SIGNED

            return (
              <div
                key={brief.id}
                className="overflow-hidden rounded-xl border bg-card shadow-xs transition-shadow hover:shadow-sm"
              >
                {/* Header bar */}
                <div className="flex flex-col justify-between gap-4 border-b bg-card p-5 md:flex-row md:items-center">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold tracking-tight">
                        {brief.title}
                      </h2>
                      {brief.isPrimary && (
                        <span className="inline-flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <Star className="h-3 w-3 fill-amber-500" />
                          Primary Brief
                        </span>
                      )}
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${getBriefStatusBadgeClass(
                          brief.status
                        )}`}
                      >
                        {formatBriefStatus(brief.status)}
                      </span>
                      <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs text-muted-foreground">
                        v{brief.version}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Project: <strong>{brief.project.name}</strong>
                      </span>
                      <span>•</span>
                      <span>
                        Created by{" "}
                        {brief.createdBy.name || brief.createdBy.email} on{" "}
                        {new Date(brief.createdAt).toLocaleDateString(
                          undefined,
                          {
                            month: "short",
                            day: "numeric",
                          }
                        )}
                      </span>
                      {brief.tags.length > 0 && (
                        <>
                          <span>•</span>
                          <span className="flex gap-1">
                            {brief.tags.map((t) => (
                              <span key={t} className="text-muted-foreground">
                                #{t}
                              </span>
                            ))}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions summary / Expand button */}
                  <div className="flex items-center gap-2 self-start md:self-auto">
                    {/* Worker sign-off button */}
                    {hasPendingSignOff && (
                      <Button
                        size="sm"
                        onClick={() => handleOpenSignOff(brief)}
                        className="flex h-8 items-center gap-1.5 bg-primary text-xs text-primary-foreground"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Sign Off (v{brief.version})
                      </Button>
                    )}

                    {hasSigned && (
                      <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Signed v{brief.version}
                      </span>
                    )}

                    {/* Manager publish action if draft */}
                    {isManager && brief.status === BriefStatus.DRAFT && (
                      <Button
                        size="sm"
                        variant="default"
                        disabled={actionLoadingId === `publish-${brief.id}`}
                        onClick={() => handlePublish(brief.id)}
                        className="flex h-8 items-center gap-1.5 text-xs"
                      >
                        {actionLoadingId === `publish-${brief.id}` ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Send className="h-3.5 w-3.5" />
                        )}
                        Publish to Crew
                      </Button>
                    )}

                    {isManager && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEdit(brief)}
                        className="flex h-8 items-center gap-1 text-xs"
                      >
                        <Edit2 className="h-3 w-3" />
                        Edit
                      </Button>
                    )}

                    {isManager && canDeleteDraftBrief(brief) && (
                      <TableRowActions label={`Actions for ${brief.title}`}>
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={() => requestDeleteBrief(brief)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete draft brief
                        </DropdownMenuItem>
                      </TableRowActions>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setExpandedBriefId(isExpanded ? null : brief.id)
                      }
                      className="flex h-8 items-center gap-1 text-xs text-muted-foreground"
                    >
                      {isExpanded ? (
                        <>
                          Hide Details <ChevronUp className="h-3.5 w-3.5" />
                        </>
                      ) : (
                        <>
                          View Brief <ChevronDown className="h-3.5 w-3.5" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {/* Readiness & Progress strip */}
                <div className="flex flex-col justify-between gap-3 border-b bg-muted/15 px-5 py-3 text-xs md:flex-row md:items-center">
                  {/* Crew Readiness Bar */}
                  <div className="flex max-w-md flex-1 items-center gap-3">
                    <div className="flex shrink-0 items-center gap-1.5 font-medium">
                      <Users className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>Crew Readiness:</span>
                      <span className="font-semibold">
                        {brief.readiness.percentage}%
                      </span>
                    </div>
                    <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full bg-emerald-500 transition-all"
                        style={{
                          width: `${
                            brief.readiness.totalEnrolled > 0
                              ? (brief.readiness.signedCount /
                                  brief.readiness.totalEnrolled) *
                                100
                              : 100
                          }%`,
                        }}
                      />
                      <div
                        className="h-full bg-muted-foreground/40 transition-all"
                        style={{
                          width: `${
                            brief.readiness.totalEnrolled > 0
                              ? (brief.readiness.waivedCount /
                                  brief.readiness.totalEnrolled) *
                                100
                              : 0
                          }%`,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-muted-foreground">
                      {brief.readiness.signedCount +
                        brief.readiness.waivedCount}
                      /{brief.readiness.totalEnrolled} ready
                    </span>
                  </div>

                  {/* Shot List Counter */}
                  {brief.shotStats.total > 0 && (
                    <div className="flex items-center gap-2">
                      <Camera className="h-3.5 w-3.5 text-muted-foreground" />
                      <span>
                        Shots: <strong>{brief.shotStats.completed}</strong>/
                        {brief.shotStats.total} completed (
                        {brief.shotStats.percentage}%)
                      </span>
                    </div>
                  )}

                  {/* Resource links */}
                  <div className="flex shrink-0 items-center gap-2">
                    {brief.externalUrl && (
                      <a
                        href={brief.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "flex h-6 items-center gap-1 px-2 text-xs"
                        )}
                      >
                        <ExternalLink className="h-3 w-3" />
                        External Doc
                      </a>
                    )}
                    {brief.fileUrl && (
                      <a
                        href={`/api/briefs/${brief.id}/file`}
                        download={brief.fileName || "Creative-Brief"}
                        target="_blank"
                        rel="noreferrer"
                        className={cn(
                          buttonVariants({ variant: "ghost", size: "sm" }),
                          "flex h-6 items-center gap-1 px-2 text-xs"
                        )}
                      >
                        <Download className="h-3 w-3" />
                        PDF Spec
                      </a>
                    )}
                  </div>
                </div>

                {/* Expanded Details Body */}
                {isExpanded && (
                  <div className="space-y-6 p-6">
                    {/* Summary / Concept */}
                    {brief.summary && (
                      <div className="space-y-1.5">
                        <h4 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          Concept & Executive Summary
                        </h4>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-foreground">
                          {brief.summary}
                        </p>
                      </div>
                    )}

                    {/* Deliverables & Art Direction */}
                    <div className="grid grid-cols-1 gap-6 pt-2 md:grid-cols-2">
                      <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                          Deliverable Specifications
                        </h4>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                          {brief.deliverables ||
                            "Standard photo deliverables per project contract."}
                        </p>
                      </div>

                      <div className="space-y-2 rounded-lg border bg-muted/20 p-4">
                        <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                          <Camera className="h-3.5 w-3.5 text-primary" />
                          Visual Guidelines & Art Direction
                        </h4>
                        <p className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                          {brief.guidelines ||
                            "Adhere to client brand styling and reference lookbook."}
                        </p>
                      </div>
                    </div>

                    {/* Interactive Shot List Table */}
                    {Array.isArray(brief.shotList) &&
                      brief.shotList.length > 0 && (
                        <div className="space-y-3 pt-2">
                          <div className="flex items-center justify-between">
                            <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                              <Camera className="h-3.5 w-3.5 text-primary" />
                              Session Shot List ({brief.shotList.length} items)
                            </h4>
                            <span className="text-xs text-muted-foreground">
                              Click status badge on set to track production
                              progress
                            </span>
                          </div>

                          <div className="divide-y overflow-hidden rounded-lg border text-xs">
                            {brief.shotList.map((shot, sIdx) => {
                              const isDone = shot.status === "COMPLETED"
                              const isSkipped = shot.status === "SKIPPED"
                              const isCurrent = shot.status === "IN_PROGRESS"

                              return (
                                <div
                                  key={shot.id || sIdx}
                                  className={`flex flex-col justify-between gap-2 p-3 md:flex-row md:items-center ${
                                    isDone
                                      ? "bg-emerald-500/5 text-muted-foreground"
                                      : isSkipped
                                        ? "bg-muted/30 text-muted-foreground line-through opacity-60"
                                        : isCurrent
                                          ? "bg-blue-500/5"
                                          : ""
                                  }`}
                                >
                                  <div className="flex-1 space-y-1">
                                    <div className="flex items-center gap-2">
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] font-semibold">
                                        #{sIdx + 1}
                                      </span>
                                      <span
                                        className={`font-semibold ${isDone ? "line-through" : ""}`}
                                      >
                                        {shot.title}
                                      </span>
                                      <span className="rounded border bg-card px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                        {shot.framing?.replace(/_/g, " ") ||
                                          "MEDIUM"}
                                      </span>
                                    </div>
                                    {shot.description && (
                                      <p className="pl-7 text-[11px] text-muted-foreground">
                                        {shot.description}
                                      </p>
                                    )}
                                    {Array.isArray(shot.props) &&
                                      shot.props.length > 0 && (
                                        <div className="flex items-center gap-1 pl-7 text-[10px] text-muted-foreground">
                                          <span>Props:</span>
                                          {shot.props.map((p) => (
                                            <span
                                              key={p}
                                              className="py-0.2 rounded bg-muted px-1.5 font-mono"
                                            >
                                              {p}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                  </div>

                                  {/* Shot status toggler */}
                                  {!isClient && (
                                    <div className="flex items-center gap-1 self-start pl-7 md:self-auto md:pl-0">
                                      <Select
                                        value={shot.status || "PLANNED"}
                                        onValueChange={(val) =>
                                          val &&
                                          handleToggleShot(
                                            brief.id,
                                            shot.id,
                                            val as ShotStatus
                                          )
                                        }
                                        disabled={
                                          actionLoadingId === `shot-${shot.id}`
                                        }
                                      >
                                        <SelectTrigger className="h-7 w-28 text-[11px]">
                                          <SelectValue>
                                            {formatBriefOption(shot.status)}
                                          </SelectValue>
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="PLANNED">
                                            Planned
                                          </SelectItem>
                                          <SelectItem value="IN_PROGRESS">
                                            In Progress
                                          </SelectItem>
                                          <SelectItem value="COMPLETED">
                                            Completed
                                          </SelectItem>
                                          <SelectItem value="SKIPPED">
                                            Skipped
                                          </SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                    {/* Crew Sign-off Roster Table (Hidden for Clients) */}
                    {!isClient && (
                      <div className="space-y-3 border-t pt-4">
                        <div className="flex items-center justify-between">
                          <h4 className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                            <Users className="h-3.5 w-3.5 text-primary" />
                            Crew Review & Sign-off Roster (v{brief.version})
                          </h4>

                          {isManager && (
                            <div className="flex items-center gap-2">
                              {addingReviewerBriefId === brief.id ? (
                                <div className="flex items-center gap-1.5">
                                  <Select
                                    value={selectedWorkerId}
                                    onValueChange={(val) =>
                                      val && setSelectedWorkerId(val)
                                    }
                                  >
                                    <SelectTrigger className="h-7 w-44 text-xs">
                                      <SelectValue placeholder="Select worker">
                                        {workers.find(
                                          (worker) =>
                                            worker.id === selectedWorkerId
                                        )?.name ||
                                          workers.find(
                                            (worker) =>
                                              worker.id === selectedWorkerId
                                          )?.email ||
                                          "Select worker"}
                                      </SelectValue>
                                    </SelectTrigger>
                                    <SelectContent>
                                      {workers.map((w) => (
                                        <SelectItem key={w.id} value={w.id}>
                                          {w.name || w.email}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    size="sm"
                                    onClick={() => handleAddReviewer(brief.id)}
                                    disabled={!selectedWorkerId}
                                    className="h-7 min-w-14 px-3 text-xs"
                                  >
                                    Add
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setAddingReviewerBriefId(null)
                                      setSelectedWorkerId("")
                                    }}
                                    className="h-7 px-2 text-xs"
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() =>
                                    setAddingReviewerBriefId(brief.id)
                                  }
                                  className="flex h-7 items-center gap-1 text-xs"
                                >
                                  <Plus className="h-3 w-3" />
                                  Add Reviewer
                                </Button>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="divide-y overflow-hidden rounded-lg border text-xs">
                          {brief.signOffs
                            .filter((s) => s.version === brief.version)
                            .map((signOff) => {
                              const avatar = getProfileImageSrc(
                                signOff.user.image,
                                signOff.user.id
                              )

                              return (
                                <div
                                  key={signOff.id}
                                  className="flex items-center justify-between gap-3 bg-card p-3"
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="relative flex h-7 w-7 items-center justify-center overflow-hidden rounded-full border bg-muted text-xs font-semibold">
                                      {avatar ? (
                                        <img
                                          src={avatar}
                                          alt={signOff.user.name || "User"}
                                          className="size-full object-cover"
                                        />
                                      ) : (
                                        signOff.user.name?.charAt(0) || "W"
                                      )}
                                    </div>
                                    <div>
                                      <div className="font-medium">
                                        {signOff.user.name ||
                                          signOff.user.email}
                                      </div>
                                      {signOff.note && (
                                        <p className="text-[11px] text-muted-foreground italic">
                                          &quot;{signOff.note}&quot;
                                        </p>
                                      )}
                                      {signOff.waiveReason && (
                                        <p className="text-[11px] text-muted-foreground">
                                          Waived by{" "}
                                          {signOff.waivedBy?.name || "Manager"}:{" "}
                                          {signOff.waiveReason}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-3">
                                    <span
                                      className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${getSignOffStatusBadgeClass(
                                        signOff.status
                                      )}`}
                                    >
                                      {formatSignOffStatus(signOff.status)}
                                    </span>

                                    {signOff.signedAt && (
                                      <span className="text-[11px] text-muted-foreground">
                                        {new Date(
                                          signOff.signedAt
                                        ).toLocaleDateString(undefined, {
                                          month: "short",
                                          day: "numeric",
                                        })}
                                      </span>
                                    )}

                                    {isManager &&
                                      signOff.status ===
                                        SignOffStatus.PENDING && (
                                        <div className="flex items-center gap-1">
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleWaive(
                                                brief.id,
                                                signOff.userId
                                              )
                                            }
                                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                                          >
                                            Waive
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() =>
                                              handleRemoveReviewer(
                                                brief.id,
                                                signOff.userId
                                              )
                                            }
                                            className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-destructive"
                                          >
                                            Remove
                                          </Button>
                                        </div>
                                      )}
                                  </div>
                                </div>
                              )
                            })}

                          {brief.signOffs.filter(
                            (s) => s.version === brief.version
                          ).length === 0 && (
                            <div className="p-4 text-center text-xs text-muted-foreground">
                              No reviewers enrolled for version {brief.version}.
                              Publish the brief to automatically snapshot
                              project task assignees.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Crew Discussion & Questions (Hidden for Clients) */}
                    {!isClient && (
                      <div className="border-t pt-4">
                        <BriefDiscussion
                          briefId={brief.id}
                          currentUserId={currentUserId}
                          isManager={isManager}
                          questions={brief.questions || []}
                          onRefresh={() => router.invalidate()}
                        />
                      </div>
                    )}

                    {/* Manager Status Control Footer */}
                    {isManager && (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-t bg-muted/10 p-3 pt-4 text-xs">
                        <span className="font-medium text-muted-foreground">
                          Lifecycle State Management:
                        </span>
                        <div className="flex items-center gap-2">
                          <Select
                            value={brief.status}
                            onValueChange={(val) =>
                              val &&
                              handleStatusChange(brief.id, val as BriefStatus)
                            }
                            disabled={actionLoadingId === `status-${brief.id}`}
                          >
                            <SelectTrigger className="h-8 w-44 text-xs">
                              <SelectValue>
                                {formatBriefOption(brief.status)}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(BRIEF_STATUS_LABELS).map(
                                ([s, label]) => (
                                  <SelectItem key={s} value={s}>
                                    {label}
                                  </SelectItem>
                                )
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {totalBriefs > pageSize && (
        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Showing {(page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, totalBriefs)} of {totalBriefs} briefs
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => updateFilters({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page * pageSize >= totalBriefs}
              onClick={() => updateFilters({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      {/* Brief Dialog */}
      <BriefDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        brief={selectedBrief}
        canDeleteDraft={Boolean(
          selectedBrief &&
            initialBriefs.some(
              (item) =>
                item.id === selectedBrief.id && canDeleteDraftBrief(item)
            )
        )}
        projects={projects}
        onDeleteRequest={requestDeleteBrief}
        onSuccess={() => {
          router.invalidate()
        }}
      />

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isDeletingBrief) {
            setDeleteTarget(null)
            setDeleteError(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete draft brief?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `“${deleteTarget.title}” will be permanently deleted. Only unpublished drafts without completed reviews or discussion history can be deleted.`
                : "This draft brief will be permanently deleted."}
              {deleteError && (
                <span className="mt-2 block text-destructive">{deleteError}</span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingBrief}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isDeletingBrief}
              onClick={(event) => {
                event.preventDefault()
                void handleDeleteBrief()
              }}
            >
              {isDeletingBrief ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
              Delete brief
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Worker Sign-off Dialog */}
      <BriefSignOffDialog
        open={signOffDialogOpen}
        onOpenChange={setSignOffDialogOpen}
        brief={signOffTargetBrief}
        onSuccess={() => {
          router.invalidate()
        }}
      />
    </div>
  )
}
