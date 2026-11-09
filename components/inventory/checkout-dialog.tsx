
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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { checkoutInventoryItem } from "@/app/actions/inventory"
import { Loader2, AlertCircle, MapPin } from "lucide-react"

interface CheckoutDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  item: {
    id: string
    name: string
    assetTag: string
    category: string
    location?: string | null
  } | null
  onSuccess?: () => void
}

export function CheckoutDialog({
  open,
  onOpenChange,
  item,
  onSuccess,
}: CheckoutDialogProps) {
  const [expectedReturnAt, setExpectedReturnAt] = useState("")
  const [notes, setNotes] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!item) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    try {
      const res = await checkoutInventoryItem({
        itemId: item.id,
        expectedReturnAt: expectedReturnAt || null,
        notes: notes.trim() || null,
      })

      if (res.error) throw new Error(res.error)

      setExpectedReturnAt("")
      setNotes("")
      setError(null)
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to check out item.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Check Out Asset</DialogTitle>
          <DialogDescription>
            You are checking out this item from the studio inventory.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Item Summary Card */}
        <div className="space-y-1.5 rounded-xl border border-border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              {item.name}
            </span>
            <span className="rounded border border-border bg-background px-2 py-0.5 font-mono text-xs font-semibold">
              {item.assetTag}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span>Category: {item.category}</span>
            {item.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {item.location}
              </span>
            )}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
          <div className="space-y-1.5">
            <Label htmlFor="expectedReturnAt" className="text-xs font-medium">
              Expected Return Date & Time (Optional)
            </Label>
            <div className="relative">
              <Input
                id="expectedReturnAt"
                type="datetime-local"
                value={expectedReturnAt}
                onChange={(e) => setExpectedReturnAt(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Leaving this empty allows an open-ended loan. Setting a deadline
              flags overdue items if not returned.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes" className="text-xs font-medium">
              Checkout Purpose / Shoot Reference (Optional)
            </Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Summer Lookbook shoot in Studio Bay 1, client demo, or web testing..."
              className="min-h-[60px] text-xs"
            />
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
              <span>Confirm Check-Out</span>
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
