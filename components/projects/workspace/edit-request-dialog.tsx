import { useState, useTransition } from "react"
import { useRouter } from "@tanstack/react-router"
import { AlertCircle, RotateCcw } from "lucide-react";
import { EditCause } from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { requestTaskEdit } from "@/src/server/actions/task-workflow";

interface EditRequestDialogProps {
  taskId: string
  taskTitle: string
  categoryName?: string
  priority?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditRequestDialog({
  taskId,
  taskTitle,
  categoryName,
  priority,
  open,
  onOpenChange,
  onSuccess,
}: EditRequestDialogProps) {
  const router = useRouter()
  const [cause, setCause] = useState<EditCause>(EditCause.REQUIREMENT_ADJUSTMENT)
  const [description, setDescription] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!description.trim()) {
      setError("Please describe what needs to change so the team can rework it.")
      return
    }

    startTransition(async () => {
      try {
        const res = (await requestTaskEdit({
            taskId,
            cause,
            description: description.trim(),
          })) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setError(res.error)
        } else {
          setDescription("")
          onOpenChange(false)
          onSuccess?.()
          await router.invalidate()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to request edit.")
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 text-orange-600 dark:text-orange-400" />
            <DialogTitle className="text-base font-semibold">Edit Request</DialogTitle>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{taskTitle}</span>
            {categoryName && (
              <span className="rounded-full bg-orange-500/10 px-2 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
                {categoryName}
              </span>
            )}
            {priority && (
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground capitalize">
                {priority.toLowerCase()} priority
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Edit Cause Selector */}
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-semibold text-foreground">Edit Cause</Label>
              <p className="text-[11px] text-muted-foreground">
                Please clarify whether the issue arises from execution or from a new requirement.
              </p>
            </div>

            <div className="grid gap-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  cause === EditCause.REQUIREMENT_ADJUSTMENT
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="editCause"
                  checked={cause === EditCause.REQUIREMENT_ADJUSTMENT}
                  onChange={() => setCause(EditCause.REQUIREMENT_ADJUSTMENT)}
                  className="mt-0.5 size-4 text-primary"
                />
                <div className="space-y-0.5">
                  <span className="block text-xs font-semibold text-foreground">
                    Requirement Adjustment
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    They are new explanations or missing details from the task owner.
                  </span>
                </div>
              </label>

              <label
                className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors ${
                  cause === EditCause.DELIVERY_QUALITY_ISSUE
                    ? "border-primary bg-primary/5"
                    : "border-border hover:bg-muted/50"
                }`}
              >
                <input
                  type="radio"
                  name="editCause"
                  checked={cause === EditCause.DELIVERY_QUALITY_ISSUE}
                  onChange={() => setCause(EditCause.DELIVERY_QUALITY_ISSUE)}
                  className="mt-0.5 size-4 text-primary"
                />
                <div className="space-y-0.5">
                  <span className="block text-xs font-semibold text-foreground">
                    Delivery Quality Issue
                  </span>
                  <span className="block text-[11px] text-muted-foreground">
                    Something went wrong with the delivery or the quality of the work.
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Edit Requirement Description */}
          <div className="space-y-1.5">
            <div>
              <Label htmlFor="edit-requirement" className="text-xs font-semibold text-foreground">
                Edit Requirement
              </Label>
              <p className="text-[11px] text-muted-foreground">
                Describe exactly what needs to change so the specialist can rework it quickly.
              </p>
            </div>
            <Textarea
              id="edit-requirement"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what needs to be edited and why (e.g. timestamps, pacing, audio balance)..."
              className="text-xs leading-relaxed"
              disabled={isPending}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="flex gap-2 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isPending || !description.trim()}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
            >
              {isPending ? "Sending..." : "Send & finish"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
