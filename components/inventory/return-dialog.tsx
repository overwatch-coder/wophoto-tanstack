
import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { returnInventoryItem } from "@/app/actions/inventory"
import { InventoryCondition } from "@/generated/prisma/browser"
import { Loader2, AlertCircle, Wrench } from "lucide-react"

const conditionLabels: Record<InventoryCondition, string> = {
  [InventoryCondition.EXCELLENT]: "Excellent",
  [InventoryCondition.GOOD]: "Good",
  [InventoryCondition.FAIR]: "Fair",
  [InventoryCondition.NEEDS_ATTENTION]: "Needs attention",
}

interface ReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  loan: {
    id: string
    item: {
      id: string
      name: string
      assetTag: string
    }
    checkedOutAt: string | Date
  } | null
  onSuccess?: () => void
}

export function ReturnDialog({
  open,
  onOpenChange,
  loan,
  onSuccess,
}: ReturnDialogProps) {
  const [condition, setCondition] = useState<InventoryCondition>(
    InventoryCondition.GOOD
  )
  const [notes, setNotes] = useState("")
  const [hasIssue, setHasIssue] = useState(false)
  const [issueDetails, setIssueDetails] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!loan) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (hasIssue && !issueDetails.trim()) {
      setError("Please describe the issue or damage noticed on return.")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const res = await returnInventoryItem({
        loanId: loan.id,
        condition,
        notes: notes.trim() || null,
        hasIssue,
        issueDetails: hasIssue ? issueDetails.trim() : null,
      })

      if (res.error) throw new Error(res.error)

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to return item.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Return Asset</DialogTitle>
          <DialogDescription>
            Record the current condition and return this item to the studio
            pool.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Item Summary Card */}
        <div className="space-y-1 rounded-xl border border-border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {loan.item.name}
            </span>
            <span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs font-semibold">
              {loan.item.assetTag}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Checked out on {new Date(loan.checkedOutAt).toLocaleString()}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="returnCondition" className="text-xs font-medium">
              Return Condition
            </Label>
            <Select
              value={condition}
              onValueChange={(val) => setCondition(val as InventoryCondition)}
            >
              <SelectTrigger id="returnCondition" className="h-9 w-full text-xs">
                <SelectValue>{conditionLabels[condition]}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  value={InventoryCondition.EXCELLENT}
                  className="text-xs"
                >
                  {conditionLabels[InventoryCondition.EXCELLENT]} (Clean, mint condition)
                </SelectItem>
                <SelectItem value={InventoryCondition.GOOD} className="text-xs">
                  {conditionLabels[InventoryCondition.GOOD]} (Standard working order)
                </SelectItem>
                <SelectItem value={InventoryCondition.FAIR} className="text-xs">
                  {conditionLabels[InventoryCondition.FAIR]} (Functional with cosmetic wear)
                </SelectItem>
                <SelectItem
                  value={InventoryCondition.NEEDS_ATTENTION}
                  className="text-xs"
                >
                  {conditionLabels[InventoryCondition.NEEDS_ATTENTION]} (Damage / issue present)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="returnNotes" className="text-xs font-medium">
              Return Notes (Optional)
            </Label>
            <Textarea
              id="returnNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Cleaned and stored back in Bay 1 locker, memory card formatted..."
              className="min-h-[50px] text-xs"
            />
          </div>

          {/* Damage / Issue Toggle */}
          <div className="space-y-2.5 rounded-xl border border-border bg-card p-3">
            <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-foreground select-none">
              <input
                type="checkbox"
                checked={hasIssue}
                onChange={(e) => {
                  setHasIssue(e.target.checked)
                  if (e.target.checked)
                    setCondition(InventoryCondition.NEEDS_ATTENTION)
                }}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>Report damage, malfunction, or missing parts</span>
            </label>

            {hasIssue && (
              <div className="animate-in space-y-2 pt-1 duration-150 fade-in-0">
                <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                  <Wrench className="h-3.5 w-3.5" />
                  <span>
                    Item will be set to Maintenance and queued for manager
                    inspection.
                  </span>
                </div>
                <Textarea
                  value={issueDetails}
                  onChange={(e) => setIssueDetails(e.target.value)}
                  placeholder="Describe the issue in detail (e.g. hot pixel on sensor, bent tripod leg, software license expired)..."
                  className="min-h-[60px] text-xs"
                  required
                />
              </div>
            )}
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isLoading}
              className="gap-1.5 text-xs font-semibold"
            >
              {isLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>Complete Return</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
