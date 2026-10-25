"use client"

import { useRouter } from "next/navigation"
import { useCallback, useEffect, useState, useTransition } from "react"
import {
  Undo2,
  Trash2,
  Search,
  AlertTriangle,
  Clock,
  Check,
  RotateCcw,
  ShieldAlert,
  Loader2,
  CheckCircle2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Pagination } from "@/components/ui/pagination"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { getProfileImageSrc } from "@/lib/profile-image"
import {
  restoreTask,
  restoreMultipleTasks,
  permanentlyDeleteTask,
  emptyTrash,
} from "@/app/actions/tasks"
import type { DeletedTaskItem } from "@/lib/tasks"
import type { SearchParamsRecord } from "@/lib/pagination"
import { useDebounce } from "@uidotdev/usehooks"
import { TableRowActions } from "@/components/ui/table-row-actions"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"

export function DeletedTasksView({
  initialData,
  searchParams,
}: {
  initialData: {
    tasks: DeletedTaskItem[]
    projects: { id: string; name: string }[]
    page: number
    total: number
    totalPages: number
    trashCount: number
  }
  searchParams: SearchParamsRecord
}) {
  const router = useRouter()
  const tasks = initialData.tasks
  const currentQ = firstParam(searchParams.q)
  const [searchQuery, setSearchQuery] = useState(currentQ)
  const debouncedSearchQuery = useDebounce(searchQuery, 350)
  const [prevQ, setPrevQ] = useState(currentQ)
  if (prevQ !== currentQ) {
    setPrevQ(currentQ)
    setSearchQuery(currentQ)
  }
  const [selectedProjectId, setSelectedProjectId] = useState(
    firstParam(searchParams.project) || "ALL"
  )
  const [selectedPriority, setSelectedPriority] = useState(
    firstParam(searchParams.priority) || "ALL"
  )
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([])
  const [itemToDelete, setItemToDelete] = useState<DeletedTaskItem | null>(null)
  const [isEmptyTrashConfirmOpen, setIsEmptyTrashConfirmOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [feedbackMessage, setFeedbackMessage] = useState<{
    type: "success" | "error"
    text: string
  } | null>(null)
  const filteredTasks = tasks

  const updateFilters = useCallback(
    (
      overrides: {
        project?: string
        priority?: string
        query?: string
      } = {}
    ) => {
      const params = new URLSearchParams(window.location.search)
      const query =
        overrides.query !== undefined
          ? overrides.query.trim()
          : searchQuery.trim()
      const project = overrides.project ?? selectedProjectId
      const priority = overrides.priority ?? selectedPriority

      if (query) params.set("q", query)
      else params.delete("q")
      if (project !== "ALL") params.set("project", project)
      else params.delete("project")
      if (priority !== "ALL") params.set("priority", priority)
      else params.delete("priority")
      params.delete("page")

      const search = params.toString()
    router.replace(
      search ? `/manager/deleted-tasks?${search}` : "/manager/deleted-tasks",
      { scroll: false }
      )
    },
    [router, searchQuery, selectedPriority, selectedProjectId]
  )

  useEffect(() => {
    if (
      debouncedSearchQuery.trim() !== searchQuery.trim() ||
      debouncedSearchQuery.trim() === currentQ.trim()
    )
      return
    updateFilters({ query: debouncedSearchQuery })
  }, [currentQ, debouncedSearchQuery, searchQuery, updateFilters])

  const allSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((t) => selectedTaskIds.includes(t.id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedTaskIds([])
    } else {
      setSelectedTaskIds(filteredTasks.map((t) => t.id))
    }
    }

  const toggleSelectOne = (id: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    )
  }

  const handleRestoreTask = (id: string) => {
    startTransition(async () => {
      const res = await restoreTask(id)
      if (res.error) {
        setFeedbackMessage({ type: "error", text: res.error })
      } else {
        setSelectedTaskIds((prev) => prev.filter((itemId) => itemId !== id))
        setFeedbackMessage({
          type: "success",
          text: res.success ?? "Task restored.",
        })
        router.refresh()
      }
    })
      }

  const handleBatchRestore = () => {
    if (selectedTaskIds.length === 0) return
    const idsToRestore = [...selectedTaskIds]
    startTransition(async () => {
      const res = await restoreMultipleTasks(idsToRestore)
      if (res.error) {
        setFeedbackMessage({ type: "error", text: res.error })
      } else {
        setSelectedTaskIds([])
        setFeedbackMessage({
          type: "success",
          text: res.success ?? "Tasks restored.",
        })
        router.refresh()
      }
    })
      }

  const handlePermanentDelete = (id: string) => {
    startTransition(async () => {
      const res = await permanentlyDeleteTask(id)
      if (res.error) {
        setFeedbackMessage({ type: "error", text: res.error })
      } else {
        setSelectedTaskIds((prev) => prev.filter((itemId) => itemId !== id))
        setItemToDelete(null)
        setFeedbackMessage({
          type: "success",
          text: res.success ?? "Task permanently deleted.",
        })
        router.refresh()
      }
    })
      }

  const handleEmptyTrash = () => {
    startTransition(async () => {
      const res = await emptyTrash()
      if (res.error) {
        setFeedbackMessage({ type: "error", text: res.error })
      } else {
        setSelectedTaskIds([])
        setIsEmptyTrashConfirmOpen(false)
        setFeedbackMessage({
          type: "success",
          text: res.success ?? "Trash emptied.",
        })
        router.refresh()
      }
    })
      }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
          Deleted Tasks
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          Items in the trash vault are kept for 30 days before being
          automatically purged.
        </p>
      </div>

      {/* Inline Feedback Banner */}
      {feedbackMessage && (
        <div
          role="status"
          className={`flex items-center justify-between rounded-xl border px-4 py-2.5 text-xs font-medium ${
            feedbackMessage.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/10 text-destructive"
          }`}
        >
          <div className="flex items-center gap-2">
            {feedbackMessage.type === "success" ? (
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <AlertTriangle className="size-4 shrink-0 text-destructive" />
            )}
            <span>{feedbackMessage.text}</span>
          </div>
          <button
            onClick={() => setFeedbackMessage(null)}
            className="ml-4 cursor-pointer text-xs font-normal underline opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Controls */}
      <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 sm:flex-row sm:items-center">
        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(220px,1fr)_180px_180px]">
          <div className="relative min-w-0">
            <Search className="absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search deleted tasks by title or notes..."
              aria-label="Search deleted tasks by title or notes"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-10 rounded-lg pr-3 pl-9 text-sm"
            />
          </div>
          <select
            value={selectedProjectId}
            aria-label="Filter by project"
            onChange={(event) => {
              setSelectedProjectId(event.target.value)
              updateFilters({ project: event.target.value })
            }}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-2xs sm:w-auto"
          >
            <option value="ALL">All Projects</option>
            {initialData.projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>

          <select
            value={selectedPriority}
            aria-label="Filter by priority"
            onChange={(event) => {
              setSelectedPriority(event.target.value)
              updateFilters({ priority: event.target.value })
            }}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-2xs sm:w-auto"
          >
            <option value="ALL">All Priorities</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>
        </div>

        {initialData.trashCount > 0 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => setIsEmptyTrashConfirmOpen(true)}
            className="h-8 gap-1.5 rounded-full border-destructive/20 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
            <span>Empty Trash</span>
          </Button>
        )}
      </div>

      {/* Floating Batch Action Bar when items selected */}
      {selectedTaskIds.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-2 text-xs transition-all">
          <div className="flex items-center gap-2 font-medium text-foreground">
            <Check className="size-4 text-primary" />
            <span>{selectedTaskIds.length} tasks selected</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleBatchRestore}
              className="h-7 gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground"
            >
              {isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RotateCcw className="size-3" />
              )}
              <span>Restore Selected ({selectedTaskIds.length})</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setSelectedTaskIds([])}
              className="h-7 rounded-full text-xs"
            >
              Deselect
            </Button>
          </div>
        </div>
      )}

      {/* Main Vault Table */}
      {filteredTasks.length === 0 ? (
        <div className="space-y-3 rounded-2xl border bg-card p-12 text-center shadow-xs">
          <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground">
            <Trash2 className="size-6 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {initialData.total === 0 && !hasFilters(searchParams)
                ? "Trash is empty"
                : "No deleted tasks match your filter"}
            </h3>
            <p className="mx-auto max-w-sm text-xs text-muted-foreground">
              {initialData.total === 0 && !hasFilters(searchParams)
                ? "Deleted tasks are stored here for 30 days before being automatically purged."
                : "Try resetting your search query or choosing another project."}
            </p>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
          <Table className="min-w-[980px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all rows"
                    className="size-3.5 cursor-pointer rounded border-border accent-primary"
                  />
                </TableHead>
                <TableHead className="text-xs">Task Name & Scope</TableHead>
                <TableHead className="text-xs">Project</TableHead>
                <TableHead className="text-xs">Original Status</TableHead>
                <TableHead className="text-xs">Priority</TableHead>
                <TableHead className="text-xs">Deleted By</TableHead>
                <TableHead className="text-xs">Retention</TableHead>
                <TableHead className="text-right text-xs">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTasks.map((t) => {
                const isSelected = selectedTaskIds.includes(t.id)

                return (
                  <TableRow
                    key={t.id}
                    className={`transition-colors ${
                      isSelected ? "bg-primary/5" : "hover:bg-muted/40"
                    }`}
                  >
                    {/* Checkbox */}
                    <TableCell className="align-middle">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(t.id)}
                        aria-label={`Select ${t.title}`}
                        className="size-3.5 cursor-pointer rounded border-border accent-primary"
                      />
                    </TableCell>

                    {/* Task Title & Details */}
                    <TableCell className="max-w-sm py-3 align-middle">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-foreground">
                            {t.title}
                          </span>
                          <Badge
                            variant="outline"
                            className="rounded-full px-2 py-0.5 font-mono text-xs"
                          >
                            {t.type === "DAILY_ENTRY"
                              ? "Daily Log"
                              : "Assigned"}
                          </Badge>
                        </div>
                        {t.description && (
                          <p className="line-clamp-1 text-xs text-muted-foreground">
                            {t.description}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    {/* Project */}
                    <TableCell className="align-middle text-xs whitespace-nowrap text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {t.projectName}
                      </span>
                    </TableCell>

                    {/* Original Status */}
                    <TableCell className="align-middle text-xs">
                      <Badge
                        variant="secondary"
                        className="rounded-full px-2 py-0.5 text-xs"
                      >
                        {t.status}
                      </Badge>
                    </TableCell>

                    {/* Priority */}
                    <TableCell className="align-middle text-xs">
                      <span
                        className={`text-xs font-semibold ${
                          t.priority === "HIGH"
                            ? "text-rose-500"
                            : t.priority === "MEDIUM"
                            ? "text-amber-500"
                            : "text-muted-foreground"
                        }`}
                      >
                        {t.priority}
                      </span>
                    </TableCell>

                    {/* Deleted By */}
                    <TableCell className="align-middle text-xs whitespace-nowrap text-muted-foreground">
                      <div className="flex items-center gap-1.5">
                        <Avatar className="size-6 ring-1 ring-border">
                          {t.deletedByImage ? (
                            <AvatarImage
                              src={
                                getProfileImageSrc(
                                  t.deletedByImage,
                                  t.deletedById
                                ) ?? undefined
                              }
                              alt={t.deletedByName}
                            />
                          ) : null}
                          <AvatarFallback className="text-[11px] font-semibold">
                            {t.deletedByName
                              .split(" ")
                              .map((n) => n[0])
                              .join("")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs font-medium text-foreground">
                          {t.deletedByName}
                        </span>
                      </div>
                    </TableCell>

                    {/* Auto-Purge Countdown */}
                    <TableCell className="align-middle text-xs whitespace-nowrap">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="size-3 text-muted-foreground" />
                        <span>{t.daysRemaining}d left</span>
                      </div>
                    </TableCell>

                    {/* Quick Row Actions */}
                    <TableCell className="py-2 text-right align-middle whitespace-nowrap">
                      <TableRowActions label={`Actions for ${t.title}`}>
                        <DropdownMenuItem
                          disabled={isPending}
                          onClick={() => handleRestoreTask(t.id)}
                        >
                          <Undo2 aria-hidden="true" />
                          Restore task
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          disabled={isPending}
                          onClick={() => setItemToDelete(t)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete permanently
                        </DropdownMenuItem>
                      </TableRowActions>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        pathname="/manager/deleted-tasks"
        searchParams={searchParams}
        page={initialData.page}
        totalPages={initialData.totalPages}
        totalItems={initialData.total}
      />

      {/* Confirmation Dialog: Permanent Delete */}
      <Dialog
        open={Boolean(itemToDelete)}
        onOpenChange={(open) => !open && setItemToDelete(null)}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <ShieldAlert className="size-4" />
              <span>Delete Task Permanently?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              This will permanently erase{" "}
              <strong>&ldquo;{itemToDelete?.title}&rdquo;</strong> and its
              assignee records from the database. This action cannot be
              reversed.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setItemToDelete(null)}
              className="h-8 rounded-full text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                if (itemToDelete) {
                  handlePermanentDelete(itemToDelete.id)
                }
              }}
              className="h-8 rounded-full bg-destructive text-xs font-medium text-white hover:bg-destructive/90"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Deleting…</span>
                </span>
              ) : (
                "Permanently Delete"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Empty All Trash */}
      <Dialog
        open={isEmptyTrashConfirmOpen}
        onOpenChange={setIsEmptyTrashConfirmOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-destructive">
              <AlertTriangle className="size-4" />
              <span>Empty Entire Trash?</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Are you sure you want to permanently delete all{" "}
              {initialData.trashCount} items in the trash? This will purge all
              soft-deleted records across all projects.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="pt-2">
            <Button
              variant="ghost"
              size="sm"
              disabled={isPending}
              onClick={() => setIsEmptyTrashConfirmOpen(false)}
              className="h-8 rounded-full text-xs"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={handleEmptyTrash}
              className="h-8 rounded-full bg-destructive text-xs font-medium text-white hover:bg-destructive/90"
            >
              {isPending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Emptying…</span>
                </span>
              ) : (
                "Yes, Empty Trash"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "")
}

function hasFilters(searchParams: SearchParamsRecord) {
  return Boolean(
    firstParam(searchParams.q).trim() ||
    (firstParam(searchParams.project) &&
      firstParam(searchParams.project) !== "ALL") ||
    (firstParam(searchParams.priority) &&
      firstParam(searchParams.priority) !== "ALL")
  )
}
