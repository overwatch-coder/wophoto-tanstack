import { useEffect, useState, useTransition } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { CheckCircle2, Download, ExternalLink, Eye, MessageSquare, Paperclip, Plus, RotateCcw, Send, Star, Trash2, Upload, X } from "lucide-react";
import {
  DeliverableType,
  EditCause,
  TaskPriority,
  TaskStatus,
  UserRole,
} from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"
import { EditRequestDialog } from "./edit-request-dialog"
import { TaskRatingDialog } from "./task-rating-dialog"
import type { ProjectWorkspaceTask } from "@/lib/projects"
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

interface TaskDetailsSheetProps {
  task: ProjectWorkspaceTask | null
  projectName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  currentUserRole: UserRole
}

export function TaskDetailsSheet({
  task,
  projectName,
  open,
  onOpenChange,
  currentUserRole,
}: TaskDetailsSheetProps) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(
    task?.status ?? TaskStatus.PENDING
  )
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [commentText, setCommentText] = useState("")
  const [commentError, setCommentError] = useState<string | null>(null)
  const [editRequestOpen, setEditRequestOpen] = useState(false)
  const [ratingOpen, setRatingOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    if (task) {
      setCurrentStatus(task.status)
      setStatusMessage(null)
    }
  }, [task?.status, task?.id])

  // Upload attachment state
  const [showAddAttachment, setShowAddAttachment] = useState<DeliverableType | null>(null)
  const [attachmentName, setAttachmentName] = useState("")
  const [attachmentUrl, setAttachmentUrl] = useState("")
  const [uploadError, setUploadError] = useState<string | null>(null)

  if (!task) return null

  const inputDeliverables = task.deliverables.filter((d) => d.type === DeliverableType.INPUT)
  const outputDeliverables = task.deliverables.filter((d) => d.type === DeliverableType.OUTPUT)
  const latestRating = task.ratings[0]
  const categoryName = task.services[0]?.service.name || task.specializations[0]?.specialization

  const isManager = currentUserRole === UserRole.MANAGER || currentUserRole === UserRole.SUPERVISOR

  async function handleStatusChange(nextStatus: TaskStatus) {
    if (!task) return
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
          setStatusMessage(
            `Status updated to ${TASK_STATUS_LABELS[nextStatus] || nextStatus}.`
          )
          await router.invalidate()
        }
      } catch (err) {
        console.error("Failed to update status:", err)
        setStatusMessage(
          err instanceof Error ? err.message : "Failed to update status."
        )
        setCurrentStatus(previousStatus)
      }
    })
  }

  async function handleSendComment(e: React.FormEvent) {
    e.preventDefault()
    if (!task || !commentText.trim()) return
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
    if (!task || !attachmentName.trim() || !attachmentUrl.trim() || !showAddAttachment) return
    setUploadError(null)

    startTransition(async () => {
      try {
        const res = (await uploadTaskDeliverable({
            taskId: task.id,
            name: attachmentName.trim(),
            fileUrl: attachmentUrl.trim(),
            type: showAddAttachment,
          })) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setUploadError(res.error)
        } else {
          setAttachmentName("")
          setAttachmentUrl("")
          setShowAddAttachment(null)
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

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col">
          {/* Header */}
          <div className="border-b border-border p-6 bg-muted/20">
            <div className="flex items-center justify-between gap-3">
              {task.projectId ? (
                <Link
                  to="/manager/projects/$projectId"
                  params={{ projectId: task.projectId }}
                  className="text-[11px] font-medium text-muted-foreground hover:text-foreground uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                >
                  <span>{projectName}</span>
                  <span className="text-[10px] text-muted-foreground/60">→</span>
                </Link>
              ) : (
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  {projectName}
                </span>
              )}
              <div className="flex items-center gap-2">
                <Link
                  to="/manager/tasks/$taskId"
                  params={{ taskId: task.id }}
                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-1"
                  title="Open dedicated task page"
                >
                  <span>Full page</span>
                  <ExternalLink className="size-3" />
                </Link>
                {latestRating && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <Star className="size-3 fill-amber-400 text-amber-400" />
                    {latestRating.score} ★
                  </span>
                )}
              </div>
            </div>

            <SheetTitle className="mt-2 text-lg font-bold text-foreground">
              {task.title}
            </SheetTitle>

            {/* Category & Status pills */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {categoryName && (
                <span className="rounded-full bg-orange-500/15 px-3 py-1 text-xs font-semibold text-orange-700 dark:text-orange-400">
                  {categoryName}
                </span>
              )}

              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                  task.priority === TaskPriority.HIGH
                    ? "bg-red-500/15 text-red-700 dark:text-red-400"
                    : task.priority === TaskPriority.MEDIUM
                      ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                      : "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                }`}
              >
                {task.priority.toLowerCase()} priority
              </span>
            </div>

            {/* Dates & Status Controls */}
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 border-t border-border/60 pt-4 text-xs">
              <div>
                <span className="text-muted-foreground block text-[11px]">Start Date</span>
                <span className="font-medium text-foreground mt-0.5 block">
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
                <span className="font-medium text-foreground mt-0.5 block">
                  {task.dueAt
                    ? new Date(task.dueAt).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "Not specified"}
                </span>
              </div>

              <div className="col-span-2 sm:col-span-1">
                <span className="text-muted-foreground block text-[11px] mb-1">Status</span>
                <Select
                  value={currentStatus}
                  onValueChange={(val) => val && handleStatusChange(val as TaskStatus)}
                  disabled={isPending}
                >
                  <SelectTrigger className="h-8 text-xs bg-background">
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
            </div>
          </div>

          <div className="flex-1 p-6 space-y-6">
            {/* Assign Specialists */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Assigned Specialists
              </h4>
              {task.assignees.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No specialists assigned yet.</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {task.assignees.map((a) => (
                    <div
                      key={a.userId}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-xs"
                    >
                      <Avatar className="size-6">
                        <AvatarImage
                          src={getProfileImageSrc(a.user.image, a.userId) || undefined}
                          alt={a.user.name || "Worker"}
                        />
                        <AvatarFallback className="text-[10px] font-semibold bg-primary/10 text-primary">
                          {a.user.name?.charAt(0).toUpperCase() || "W"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-foreground">{a.user.name || a.user.email}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Content Requirements */}
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Content Requirements
              </h4>
              <div className="rounded-xl border border-border bg-muted/20 p-4 text-xs leading-relaxed text-foreground whitespace-pre-wrap">
                {task.description || "No specific content requirements specified."}
              </div>
            </div>

            {/* Revisions History (if any) */}
            {task.revisions.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-orange-600 dark:text-orange-400 tracking-wide uppercase flex items-center gap-1.5">
                  <RotateCcw className="size-3.5" />
                  Revision History ({task.revisions.length})
                </h4>
                <div className="space-y-2">
                  {task.revisions.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-lg border border-orange-500/30 bg-orange-500/5 p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-semibold text-orange-700 dark:text-orange-400">
                          {rev.cause === EditCause.REQUIREMENT_ADJUSTMENT
                            ? "Requirement Adjustment"
                            : "Delivery Quality Issue"}
                        </span>
                        <span className="text-muted-foreground">
                          {new Date(rev.createdAt).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="mt-1 text-foreground/90 leading-relaxed">{rev.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action Bar (When in DONE or for reviews) */}
            {currentStatus === TaskStatus.COMPLETED && (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                      Deliverable Ready for Review
                    </span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  The team has completed this task. You can inspect the delivered files below, request
                  refinements, or submit your satisfaction rating.
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditRequestOpen(true)}
                    className="text-xs gap-1.5 border-orange-500/30 text-orange-700 dark:text-orange-400 hover:bg-orange-500/10"
                  >
                    <RotateCcw className="size-3.5" />
                    Request Changes / To Edit
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setRatingOpen(true)}
                    className="text-xs gap-1.5 bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    <Star className="size-3.5 fill-current" />
                    {latestRating ? "Update Rating" : "Rate Deliverable"}
                  </Button>
                </div>
              </div>
            )}

            {/* Attachments Section (Input vs Output) */}
            <div className="space-y-4">
              <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase">
                Attachments & Deliverables
              </h4>

              {/* Input Files */}
              <div className="space-y-2 rounded-xl border border-border p-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                    Input {inputDeliverables.length} File{inputDeliverables.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddAttachment(DeliverableType.INPUT)}
                    className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <Plus className="size-3" /> Add Input Attachment
                  </button>
                </div>

                {inputDeliverables.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">No input files attached.</p>
                ) : (
                  <div className="space-y-1.5">
                    {inputDeliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Paperclip className="size-4 shrink-0 text-sky-600 dark:text-sky-400" />
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {d.name}
                            </span>
                            {d.fileSize ? (
                              <span className="block text-[10px] text-muted-foreground">
                                {(d.fileSize / (1024 * 1024)).toFixed(2)} MB
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Preview file"
                          >
                            <Eye className="size-3.5" />
                          </a>
                          <a
                            href={d.fileUrl}
                            download={d.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="size-3.5" />
                          </a>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(d.id)}
                              className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Output Deliverables */}
              <div className="space-y-2 rounded-xl border border-border p-3 bg-card">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    Output {outputDeliverables.length} Deliverable
                    {outputDeliverables.length === 1 ? "" : "s"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowAddAttachment(DeliverableType.OUTPUT)}
                    className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:underline flex items-center gap-1"
                  >
                    <Upload className="size-3" /> Upload Deliverable
                  </button>
                </div>

                {outputDeliverables.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic py-1">
                    No deliverables uploaded yet.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {outputDeliverables.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/80 bg-background p-2.5 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                          <div className="min-w-0">
                            <span className="block truncate font-medium text-foreground">
                              {d.name}
                            </span>
                            <span className="block text-[10px] text-muted-foreground">
                              {d.fileSize ? `${(d.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                              Uploaded by {d.uploadedBy.name || "Specialist"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Preview file"
                          >
                            <Eye className="size-3.5" />
                          </a>
                          <a
                            href={d.fileUrl}
                            download={d.name}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded p-1 text-muted-foreground hover:text-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="size-3.5" />
                          </a>
                          {isManager && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDeliverable(d.id)}
                              className="rounded p-1 text-muted-foreground hover:text-destructive transition-colors"
                              title="Delete file"
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Attachment inline modal */}
              {showAddAttachment && (
                <form
                  onSubmit={handleAddAttachment}
                  className="rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3 space-y-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Add {showAddAttachment === DeliverableType.INPUT ? "Input" : "Deliverable"} File
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowAddAttachment(null)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                  <div className="space-y-1">
                    <input
                      type="text"
                      placeholder="File title (e.g. video_v1.mp4, brand_guide.pdf)"
                      value={attachmentName}
                      onChange={(e) => setAttachmentName(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <input
                      type="url"
                      placeholder="File URL or Cloud Link"
                      value={attachmentUrl}
                      onChange={(e) => setAttachmentUrl(e.target.value)}
                      className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs"
                      required
                    />
                  </div>
                  {uploadError && <p className="text-[11px] text-destructive">{uploadError}</p>}
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddAttachment(null)}
                      className="text-xs h-7"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isPending || !attachmentName || !attachmentUrl}
                      className="text-xs h-7"
                    >
                      {isPending ? "Saving..." : "Save File"}
                    </Button>
                  </div>
                </form>
              )}
            </div>

            {/* Comments Stream */}
            <div className="space-y-3 border-t border-border pt-4">
              <h4 className="text-xs font-semibold text-foreground tracking-wide uppercase flex items-center gap-2">
                <MessageSquare className="size-3.5" />
                Discussion & Comments ({task.comments.length})
              </h4>

              <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                {task.comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    No comments yet. Start the conversation with the team below.
                  </p>
                ) : (
                  task.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-lg border border-border bg-background p-3 space-y-1.5 text-xs shadow-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Avatar className="size-5 shrink-0">
                            <AvatarImage
                              src={getProfileImageSrc(comment.author.image, comment.author.id) || undefined}
                              alt={comment.author.name || "User"}
                            />
                            <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                              {comment.author.name?.charAt(0).toUpperCase() || "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate font-semibold text-foreground">
                            {comment.author.name || "User"}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                            {comment.author.role}
                          </span>
                        </div>
                        <span className="text-[10px] text-muted-foreground shrink-0">
                          {new Date(comment.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <p className="text-foreground leading-relaxed whitespace-pre-wrap">
                        {comment.body}
                      </p>
                    </div>
                  ))
                )}
              </div>

              {/* Add Comment Input */}
              <form onSubmit={handleSendComment} className="pt-2">
                <div className="relative">
                  <Textarea
                    rows={2}
                    placeholder="Add a comment... ask questions or share feedback"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="text-xs pr-10 resize-none"
                    disabled={isPending}
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isPending || !commentText.trim()}
                    className="absolute right-2 bottom-2 size-7 p-0 rounded-full"
                    title="Send comment"
                  >
                    <Send className="size-3" />
                  </Button>
                </div>
                {commentError && (
                  <p className="mt-1 text-[11px] text-destructive">{commentError}</p>
                )}
              </form>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Request Dialog */}
      <EditRequestDialog
        taskId={task.id}
        taskTitle={task.title}
        categoryName={categoryName}
        priority={task.priority}
        open={editRequestOpen}
        onOpenChange={setEditRequestOpen}
      />

      {/* Rating Dialog */}
      <TaskRatingDialog
        taskId={task.id}
        taskTitle={task.title}
        initialScore={latestRating?.score}
        initialFeedback={latestRating?.feedback}
        open={ratingOpen}
        onOpenChange={setRatingOpen}
      />
    </>
  )
}
