import { useState, useTransition } from "react"
import { useRouter } from "@tanstack/react-router"
import { Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { submitTaskRating } from "@/src/server/actions/task-workflow";

interface TaskRatingDialogProps {
  taskId: string
  taskTitle: string
  initialScore?: number
  initialFeedback?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function TaskRatingDialog({
  taskId,
  taskTitle,
  initialScore = 5,
  initialFeedback = "",
  open,
  onOpenChange,
  onSuccess,
}: TaskRatingDialogProps) {
  const router = useRouter()
  const [score, setScore] = useState<number>(initialScore || 5)
  const [hoverScore, setHoverScore] = useState<number>(0)
  const [feedback, setFeedback] = useState(initialFeedback || "")
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    startTransition(async () => {
      try {
        const res = (await submitTaskRating({
            taskId,
            score,
            feedback: feedback.trim() || undefined,
          })) as { error?: string; success?: string } | undefined

        if (res?.error) {
          setError(res.error)
        } else {
          onOpenChange(false)
          onSuccess?.()
          await router.invalidate()
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit rating.")
      }
    })
  }

  const activeRating = hoverScore || score

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md text-center sm:text-left">
        <DialogHeader className="items-center text-center">
          <DialogTitle className="text-base font-semibold">
            How satisfied are you with this task?
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Your feedback helps us improve. Please rate your satisfaction for{" "}
            <span className="font-medium text-foreground">{taskTitle}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-2 space-y-4">
          {/* Star Rating Group */}
          <div className="flex flex-col items-center justify-center gap-2 py-2">
            <div className="flex items-center gap-1.5" role="group" aria-label="Rating stars">
              {[1, 2, 3, 4, 5].map((starVal) => {
                const filled = starVal <= activeRating
                return (
                  <button
                    key={starVal}
                    type="button"
                    onClick={() => setScore(starVal)}
                    onMouseEnter={() => setHoverScore(starVal)}
                    onMouseLeave={() => setHoverScore(0)}
                    disabled={isPending}
                    aria-label={`${starVal} star${starVal > 1 ? "s" : ""}`}
                    className="p-1 transition-transform hover:scale-110 focus-visible:outline-hidden"
                  >
                    <Star
                      className={`size-7 transition-colors ${
                        filled
                          ? "fill-amber-400 text-amber-400 drop-shadow-xs"
                          : "fill-transparent text-muted-foreground/30 hover:text-amber-300"
                      }`}
                    />
                  </button>
                )
              })}
            </div>
            <p className="text-xs font-semibold text-foreground">
              Your rating: <span className="text-amber-500 font-bold">{score}</span> out of 5
            </p>
          </div>

          {/* Feedback Textarea */}
          <div className="space-y-1.5 text-left">
            <Label htmlFor="task-feedback" className="text-xs font-medium">
              Additional Feedback (optional)
            </Label>
            <Textarea
              id="task-feedback"
              rows={3}
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Add any additional feedback or comments here..."
              className="text-xs leading-relaxed"
              disabled={isPending}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-destructive/10 p-2.5 text-xs text-destructive text-left">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:justify-end">
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
              disabled={isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white text-xs"
            >
              {isPending ? "Submitting..." : "Submit Feedback"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
