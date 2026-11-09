import { useEffect, useState, useTransition } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft, Calendar, CheckCircle2, Clock, Download, Eye, Flag, MessageSquare, Paperclip, Plus, RotateCcw, Send, Star, Trash2, Upload } from "lucide-react";
import {
  DeliverableType,
  EditCause,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"
import { EditRequestDialog } from "@/components/projects/workspace/edit-request-dialog"
import { TaskRatingDialog } from "@/components/projects/workspace/task-rating-dialog"
import type { TaskDetailsData } from "@/lib/tasks"
import { updateTaskStatus } from "@/src/server/actions/tasks";
import { addTaskComment, uploadTaskDeliverable, deleteTaskDeliverable } from "@/src/server/actions/task-workflow";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.PENDING]: "Pending",
  [TaskStatus.TODO]: "To do",
  [TaskStatus.IN_PROGRESS]: "In progress",
  [TaskStatus.IN_REVIEW]: "In review",
  [TaskStatus.COMPLETED]: "Completed",
  [TaskStatus.TO_EDIT]: "To edit",
}

interface TaskDetailsViewProps {
  data: TaskDetailsData
  backUrl?: string
}

export function TaskDetailsView({ data, backUrl = "/manager/tasks" }: TaskDetailsViewProps) {
  const { task, currentUserRole } = data
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(task.status)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)
  const [editRequestOpen, setEditRequestOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Attachment dialog state
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false)
  const [uploadType, setUploadType] = useState<DeliverableType>(DeliverableType.INPUT)
  const [attachmentName, setAttachmentName] = useState("")
  const [attachmentUrl, setAttachmentUrl] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)

  useEffect(() => {
    setCurrentStatus(task.status)
    setStatusMessage(null)
  }, [task.status, task.id])

  const inputDeliverables = task.deliverables.filter((d) => d.type === DeliverableType.INPUT)
  const outputDeliverables = task.deliverables.filter((d) => d.type === DeliverableType.OUTPUT)
  const latestRating = task.ratings[0]
  const categoryName = task.services[0]?.name || task.specializations[0]?.specialization
  const isManager = currentUserRole === UserRole.MANAGER || currentUserRole === UserRole.SUPERVISOR

  const isOverdue =
    task.dueAt &&
    new Date(task.dueAt).getTime() < Date.now() &&
    task.status !== TaskStatus.COMPLETED

  async function handleStatusChange(nextStatus: TaskStatus) {
    if (nextStatus === TaskStatus.TO_EDIT) {
      setEditRequestOpen(true)
      return
    }

    const previousStatus = currentStatus
    setCurrentStatus(nextStatus)
    setStatusMessage(null)

    startTransition(async () => {
      try {
        const res = (await updateTaskStatus(task.id, nextStatus)) as { error?: string; success?: boolean } | undefined

        if (res?.error) {
          setStatusMessage(res.error)
          setCurrentStatus(previousStatus)
        } else {
          setStatusMessage(`Status updated to ${TASK_STATUS_LABELS[nextStatus] || nextStatus}.`)
          await router.invalidate()
        }
      } catch (err) {
        console.error("Failed to update status:", err)
        setStatusMessage(err instanceof Error ? err.message : "Failed to update status.")
        setCurrentStatus(previousStatus)
      }
    })
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!commentText.trim()) return
    setCommentError(null)

    startTransition(async () => {
      try {
        const res = (await addTaskComment({
            taskId: task.id,
            body: commentText.trim(),
          })) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setCommentError(res.error)
        } else {
          setCommentText("")
          await router.invalidate()
        }
      } catch (err) {
        setCommentError(err instanceof Error ? err.message : "Failed to post comment.")
      }
    })
  }

  async function handleAddAttachment(e: React.FormEvent) {
    e.preventDefault()
    if (!attachmentName.trim() || !attachmentUrl.trim()) return
    setUploadError(null)

    startTransition(async () => {
      try {
        const res = (await uploadTaskDeliverable({
            taskId: task.id,
            name: attachmentName.trim(),
            fileUrl: attachmentUrl.trim(),
            type: uploadType,
          })) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setUploadError(res.error)
        } else {
          setAttachmentName("")
          setAttachmentUrl("")
          setUploadDialogOpen(false)
          await router.invalidate()
        }
      } catch (err) {
        setUploadError(err instanceof Error ? err.message : "Failed to add attachment.")
      }
    })
  }

  async function handleDeleteDeliverable(deliverableId: string) {
    if (!confirm("Are you sure you want to delete this file?")) return
    startTransition(async () => {
      try {
        await deleteTaskDeliverable(deliverableId)
        await router.invalidate()
      } catch (err) {
        console.error("Failed to delete deliverable:", err)
      }
    })
  }

  function openUploadDialog(type: DeliverableType) {
    setUploadType(type)
    setAttachmentName("")
    setAttachmentUrl("")
    setUploadError(null)
    setUploadDialogOpen(true)
  }

  return (
    <div className="flex flex-col min-h-full pb-16">
      {/* Top Breadcrumbs / Back Bar */}
      <div className="border-b border-border bg-card/60 px-4 sm:px-8 py-3.5 backdrop-blur-xs">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-0">
            <Link
              to={backUrl}
              className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Tasks</span>
            </Link>
            <span className="text-muted-foreground/40 shrink-0">•</span>
            {task.projectId ? (
              <Link
                to={isManager ? "/manager/projects/$projectId" : "/manager/tasks"}
                params={isManager ? { projectId: task.projectId } : undefined}
                className="truncate font-medium hover:text-foreground transition-colors"
                title={task.project.name}
              >
                {task.project.name}
              </Link>
            ) : (
              <span className="truncate">{task.project.name}</span>
            )}
            <span className="text-muted-foreground/40 shrink-0">/</span>
            <span className="truncate font-semibold text-foreground">{task.title}</span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {latestRating && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                <Star className="size-3 fill-amber-400 text-amber-400" />
                {latestRating.score} ★
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl px-4 sm:px-8 py-6 space-y-6">
        {/* Task Header Card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
            <div className="space-y-2 min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {categoryName && (
                  <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                    {categoryName}
                  </span>
                )}
                {task.project.program && task.project.program !== "No program" && (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-foreground">
                    {task.project.program}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                    task.priority === TaskPriority.HIGH
                      ? "bg-red-500/15 text-red-700 dark:text-red-400"
                      : task.priority === TaskPriority.MEDIUM
                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                        : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  }`}
                >
                  <Flag className="size-3" />
                  {task.priority.toLowerCase()} priority
                </span>
                {isOverdue && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-400">
                    <Clock className="size-3" /> Overdue
                  </span>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {task.title}
              </h1>

              {task.project.client && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pt-0.5">
                  <span>Client / Brief Owner:</span>
                  <div className="flex items-center gap-1.5 font-medium text-foreground">
                    <Avatar className="size-4">
                      <AvatarImage
                        src={getProfileImageSrc(task.project.client.image, task.project.client.id) || undefined}
                        alt={task.project.client.name ?? "Client"}
                      />
                      <AvatarFallback className="text-[8px]">
                        {(task.project.client.name ?? "C").charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{task.project.client.name ?? "Client"}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Status & Quick Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 shrink-0">
              <div className="w-44">
                <span className="block text-[11px] font-medium text-muted-foreground mb-1">
                  Task Status
                </span>
                <Select
                  value={currentStatus}
                  onValueChange={(val) => val && handleStatusChange(val as TaskStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-9 text-xs bg-background">
                    <SelectValue>
                      {(val: TaskStatus | null) =>
                        val ? TASK_STATUS_LABELS[val] ?? val : "Select status"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TaskStatus.PENDING}>Pending</SelectItem>
                    <SelectItem value={TaskStatus.TODO}>To do</SelectItem>
                    <SelectItem value={TaskStatus.IN_PROGRESS}>In progress</SelectItem>
                    <SelectItem value={TaskStatus.IN_REVIEW}>In review</SelectItem>
                    <SelectItem value={TaskStatus.COMPLETED}>Completed</SelectItem>
                    <SelectItem value={TaskStatus.TO_EDIT}>To edit</SelectItem>
                  </SelectContent>
                </Select>
                {statusMessage && (
                  <p
                    className={`mt-1 text-[11px] ${
                      statusMessage.startsWith("Status updated")
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive"
                    }`}
                  >
                    {statusMessage}
                  </p>
                )}
              </div>

              {currentStatus === TaskStatus.COMPLETED && (
                <div className="flex items-center gap-2 pt-5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditRequestOpen(true)}
                    className="text-xs gap-1.5 border-orange-500/30 text-orange-700 dark:text-orange-400 hover:bg-orange-500/10 h-9"
                  >
                    <RotateCcw className="size-3.5" />
                    Request Changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setRatingOpen(true)}
                    className="text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white h-9"
                  >
                    <Star className="size-3.5 fill-current" />
                    {latestRating ? "Update Rating" : "Rate Task"}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Metadata Row */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 border-t border-border pt-4 text-xs">
            <div>
              <span className="text-muted-foreground block text-[11px]">Start Date</span>
              <span className="font-medium text-foreground mt-0.5 inline-flex items-center gap-1.5">
                <Calendar className="size-3.5 text-muted-foreground" />
                {task.startAt
                  ? new Date(task.startAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "Not specified"}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Due Date</span>
              <span
                className={`font-medium mt-0.5 inline-flex items-center gap-1.5 ${
                  isOverdue ? "text-rose-600 dark:text-rose-400 font-semibold" : "text-foreground"
                }`}
              >
                <Clock className="size-3.5 text-muted-foreground" />
                {task.dueAt
                  ? new Date(task.dueAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })
                  : "Not specified"}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Project Brief</span>
              <span className="font-medium text-foreground mt-0.5 truncate block" title={task.project.name}>
                {task.project.name}
              </span>
            </div>

            <div>
              <span className="text-muted-foreground block text-[11px]">Specialists</span>
              <span className="font-medium text-foreground mt-0.5 block">
                {task.assignees.length} assigned
              </span>
            </div>
          </div>
        </div>

        {/* Active Revision Alert if in TO_EDIT */}
        {currentStatus === TaskStatus.TO_EDIT && task.revisions[0] && (
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
            <div className="flex items-start gap-3">
              <RotateCcw className="size-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-orange-800 dark:text-orange-300">
                    Active Revision Request:{" "}
                    {task.revisions[0].cause === EditCause.REQUIREMENT_ADJUSTMENT
                      ? "Requirement Adjustment"
                      : "Delivery Quality Issue"}
                  </span>
                  <span className="text-muted-foreground">
                    • {new Date(task.revisions[0].createdAt).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-foreground leading-relaxed">{task.revisions[0].description}</p>
              </div>
            </div>
          </div>
        )}

        {/* Two-Column Workspace Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Left Column (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {/* Content Requirements Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-3">
              <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
                Content Requirements
              </h3>
              <div className="rounded-lg border border-border/80 bg-muted/20 p-4 text-xs sm:text-sm leading-relaxed text-foreground whitespace-pre-wrap">
                {task.description || "No specific content requirements specified for this task."}
              </div>
            </div>

            {/* Attachments & Deliverables Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-5">
              <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
                Attachments & Deliverables
              </h3>

              {/* Input Files */}
              <div className="space-y-3 rounded-xl border border-border/70 p-4 bg-muted/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400">
                    Input • {inputDeliverables.length} File{inputDeliverables.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openUploadDialog(DeliverableType.INPUT)}
                    className="text-xs font-medium text-sky-700 dark:text-sky-400 hover:text-sky-800 h-8 gap-1.5"
                  >
                    <Plus className="size-3.5" /> Add Input Attachment
                  </Button>
                </div>

                {inputDeliverables.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No input files attached.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {inputDeliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <Paperclip className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground text-xs sm:text-sm">
                              {d.name}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {d.fileSize ? `${(d.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                              Uploaded by {d.uploadedBy.name || "Specialist"} on{" "}
                              {new Date(d.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Preview file"
                          >
                            <Eye className="size-4" />
                          </a>
                          <a
                            href={d.fileUrl}
                            download={d.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Download file"
                          >
                            <Download className="size-4" />
                          </a>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(d.id)}
                              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Output Deliverables */}
              <div className="space-y-3 rounded-xl border border-border/70 p-4 bg-muted/10">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    Output • {outputDeliverables.length} Deliverable
                    {outputDeliverables.length === 1 ? "" : "s"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => openUploadDialog(DeliverableType.OUTPUT)}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 h-8 gap-1.5"
                  >
                    <Upload className="size-3.5" /> Upload Deliverable
                  </Button>
                </div>

                {outputDeliverables.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-2">
                    No deliverables uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {outputDeliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-card p-3 text-xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground text-xs sm:text-sm">
                              {d.name}
                            </span>
                            <span className="block text-[11px] text-muted-foreground">
                              {d.fileSize ? `${(d.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                              Uploaded by {d.uploadedBy.name || "Specialist"} on{" "}
                              {new Date(d.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Preview file"
                          >
                            <Eye className="size-4" />
                          </a>
                          <a
                            href={d.fileUrl}
                            download={d.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="Download file"
                          >
                            <Download className="size-4" />
                          </a>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(d.id)}
                              className="rounded p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="size-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Revision History Card (if any) */}
            {task.revisions.length > 0 && (
              <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
                <h3 className="text-sm font-bold text-orange-600 dark:text-orange-400 tracking-wide uppercase flex items-center gap-2">
                  <RotateCcw className="size-4" />
                  Revision History ({task.revisions.length})
                </h3>
                <div className="space-y-3">
                  {task.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-4 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-orange-700 dark:text-orange-400 text-xs">
                          {rev.cause === EditCause.REQUIREMENT_ADJUSTMENT
                            ? "Requirement Adjustment"
                            : "Delivery Quality Issue"}
                        </span>
                        <span className="text-muted-foreground text-[11px]">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed">{rev.description}</p>
                      {rev.requestedBy && (
                        <div className="flex items-center gap-2 pt-1 text-[11px] text-muted-foreground">
                          <span>Requested by:</span>
                          <span className="font-medium text-foreground">
                            {rev.requestedBy.name || "Client"}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar Right Column (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Assigned Specialists Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
              <h3 className="text-sm font-bold text-foreground tracking-wide uppercase">
                Assigned Specialists
              </h3>
              {task.assignees.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No specialists assigned yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {task.assignees.map((a) => (
                    <div
                      key={a.userId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-muted/20 p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="size-8">
                          <AvatarImage
                            src={getProfileImageSrc(a.user.image, a.userId) || undefined}
                            alt={a.user.name || "Specialist"}
                          />
                          <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                            {a.user.name?.charAt(0).toUpperCase() || "S"}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-foreground">
                            {a.user.name || "Specialist"}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">{a.user.email}</p>
                        </div>
                      </div>

                      <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground shrink-0">
                        {TASK_STATUS_LABELS[a.status] || a.status}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Discussion & Comments Card */}
            <div className="rounded-xl border border-border bg-card p-6 shadow-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-foreground tracking-wide uppercase flex items-center gap-2">
                  <MessageSquare className="size-4" />
                  Discussion & Comments ({task.comments.length})
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Collaborate and communicate directly with the team.
                </p>
              </div>

              {/* Comments Feed */}
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {task.comments.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                    No comments yet. Start the conversation with the team below.
                  </div>
                ) : (
                  task.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border bg-muted/20 p-3.5 space-y-2 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-6 shrink-0">
                            <AvatarImage
                              src={getProfileImageSrc(comment.author.image, comment.author.id) || undefined}
                              alt={comment.author.name || "User"}
                            />
                            <AvatarFallback className="text-[10px] font-bold bg-muted text-muted-foreground">
                              {comment.author.name?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate font-semibold text-foreground">
                            {comment.author.name || "User"}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">
                            {comment.author.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(comment.createdAt).toLocaleDateString([], {
                            month: "short",
                            day: "numeric",
                          })}{" "}
                          at{" "}
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap pl-8">
                        {comment.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleSendComment} className="pt-2 border-t border-border">
                <div className="relative">
                  <Textarea
                    rows={3}
                    placeholder="Add a comment... ask questions or share feedback"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="text-xs pr-12 resize-none"
                    disabled={isPending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending || !commentText.trim()}
                    className="absolute right-2.5 bottom-2.5 size-7 p-0 rounded-full"
                    title="Send comment"
                  >
                    <Send className="size-3.5" />
                  </Button>
                </div>
                {commentError && (
                  <p className="mt-1 text-[11px] text-destructive">{commentError}</p>
                )}
              </form>
            </div>
          </div>
        </div>
      </div>

      {/* Add Attachment / Deliverable Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              Add {uploadType === DeliverableType.INPUT ? "Input Attachment" : "Output Deliverable"}
            </DialogTitle>
            <DialogDescription>
              Provide the file title and URL or storage link for this file.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleAddAttachment} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file-name" className="text-xs">
                File Title
              </Label>
              <Input
                id="file-name"
                placeholder="e.g. final_cut.mp4, brand_guidelines.pdf"
                value={attachmentName}
                onChange={(e) => setAttachmentName(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="file-url" className="text-xs">
                File URL / Cloud Link
              </Label>
              <Input
                id="file-url"
                type="url"
                placeholder="https://..."
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="text-xs"
                required
              />
            </div>

            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setUploadDialogOpen(false)}
                className="text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isPending || !attachmentName || !attachmentUrl}
                className="text-xs"
              >
                {isPending ? "Saving..." : "Save File"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Request Dialog */}
      <EditRequestDialog
        taskId={task.id}
        taskTitle={task.title}
        categoryName={categoryName}
        priority={task.priority}
        open={editRequestOpen}
        onOpenChange={setEditRequestOpen}
      />

      {/* Task Rating Dialog */}
      <TaskRatingDialog
        taskId={task.id}
        taskTitle={task.title}
        open={ratingOpen}
        onOpenChange={setRatingOpen}
      />
    </div>
  )
}
