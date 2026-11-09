
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { resolveMaintenanceIssue } from "@/app/actions/inventory"
import {
  InventoryCondition,
  MaintenanceStatus,
} from "@/generated/prisma/browser"
import {
  Wrench,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Calendar,
  User,
  DollarSign,
} from "lucide-react"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

export interface MaintenanceLogEntry {
  id: string
  itemId: string
  status: MaintenanceStatus
  description: string
  resolutionNotes?: string | null
  cost?: number | null
  startedAt: Date | string
  resolvedAt?: Date | string | null
  item: {
    id: string
    assetTag: string
    name: string
    category: string
    condition: InventoryCondition
    location?: string | null
  }
  reportedBy?: {
    id: string
    name?: string | null
    email: string
  } | null
}

interface MaintenanceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  logs: MaintenanceLogEntry[]
  onSuccess?: () => void
}

export function MaintenanceDialog({
  open,
  onOpenChange,
  logs,
  onSuccess,
}: MaintenanceDialogProps) {
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null)
  const [resolutionNotes, setResolutionNotes] = useState("")
  const [restoredCondition, setRestoredCondition] =
    useState<InventoryCondition>(InventoryCondition.GOOD)
  const [cost, setCost] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const activeLogs = logs.filter(
    (l) =>
      l.status === MaintenanceStatus.OPEN ||
      l.status === MaintenanceStatus.IN_PROGRESS
  )

  const handleStartResolving = (log: MaintenanceLogEntry) => {
    setSelectedLogId(log.id)
    setResolutionNotes("")
    setRestoredCondition(InventoryCondition.GOOD)
    setCost("")
    setError(null)
    setSuccessMessage(null)
  }

  const handleCancelResolving = () => {
    setSelectedLogId(null)
    setError(null)
  }

  const handleResolveSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLogId) return

    if (resolutionNotes.trim().length < 3) {
      setError(
        "Please provide descriptive resolution notes (minimum 3 characters)."
      )
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const parsedCost = cost ? parseFloat(cost) : undefined
      const res = await resolveMaintenanceIssue({
        logId: selectedLogId,
        resolutionNotes: resolutionNotes.trim(),
        restoredCondition,
        cost: !isNaN(Number(parsedCost)) ? parsedCost : undefined,
      })

      if (res.error) {
        setError(res.error)
      } else {
        setSuccessMessage(res.success || "Issue resolved successfully.")
        setSelectedLogId(null)
        if (onSuccess) {
          onSuccess()
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred."
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(96vw,44rem)] data-[side=right]:sm:max-w-2xl"
      >
        <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
          <div className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-amber-500" />
            <SheetTitle>Maintenance Queue</SheetTitle>
          </div>
          <SheetDescription className="leading-6">
            Review reported hardware defects, record repairs, and restore items
            to available inventory.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            >
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="flex items-start gap-2 rounded-md bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {activeLogs.length === 0 ? (
            <div className="flex min-h-64 flex-col items-center justify-center py-10 text-center text-muted-foreground">
              <div className="mb-3 rounded-full bg-muted p-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              </div>
              <p className="font-medium text-foreground">
                No pending maintenance
              </p>
              <p className="mt-1 text-sm">
                All studio equipment and creative assets are operational.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeLogs.map((log) => {
                const isResolving = selectedLogId === log.id
                const formattedDate = formatDate(log.startedAt)

                return (
                  <div
                    key={log.id}
                    className="min-w-0 rounded-lg border border-border bg-card p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="max-w-full rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold break-all text-muted-foreground">
                            {log.item.assetTag}
                          </span>
                          <h4 className="min-w-0 font-medium break-words text-foreground">
                            {log.item.name}
                          </h4>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Category: {log.item.category}
                        </p>
                      </div>
                      <span className="shrink-0 rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {log.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-1.5 rounded-md bg-muted/50 p-3 text-xs">
                      <div className="flex flex-col gap-1 text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          Reported {formattedDate}
                        </span>
                        {log.reportedBy && (
                          <span className="flex min-w-0 items-center gap-1 break-all sm:justify-end">
                            <User className="h-3.5 w-3.5" />
                            {log.reportedBy.name || log.reportedBy.email}
                          </span>
                        )}
                      </div>
                      <div className="border-t border-border/50 pt-1 text-foreground">
                        <p className="mb-0.5 font-semibold text-muted-foreground">
                          Issue Description:
                        </p>
                        <p className="whitespace-pre-wrap">{log.description}</p>
                      </div>
                    </div>

                    {isResolving ? (
                      <form
                        onSubmit={handleResolveSubmit}
                        className="mt-4 space-y-3 border-t border-border pt-3"
                      >
                        <div>
                          <Label
                            htmlFor={`notes-${log.id}`}
                            className="text-xs"
                          >
                            Resolution & Repair Notes *
                          </Label>
                          <Textarea
                            id={`notes-${log.id}`}
                            placeholder="Detail the repairs performed, parts replaced, or diagnostic tests run..."
                            value={resolutionNotes}
                            onChange={(e) => setResolutionNotes(e.target.value)}
                            rows={3}
                            required
                            className="mt-1 text-xs"
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <div>
                            <Label
                              htmlFor={`condition-${log.id}`}
                              className="text-xs"
                            >
                              Restored Condition *
                            </Label>
                            <Select
                              value={restoredCondition}
                              onValueChange={(val) =>
                                setRestoredCondition(val as InventoryCondition)
                              }
                            >
                              <SelectTrigger
                                id={`condition-${log.id}`}
                                className="mt-1 h-10 w-full text-sm"
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem
                                  value={InventoryCondition.EXCELLENT}
                                >
                                  Excellent
                                </SelectItem>
                                <SelectItem value={InventoryCondition.GOOD}>
                                  Good
                                </SelectItem>
                                <SelectItem value={InventoryCondition.FAIR}>
                                  Fair
                                </SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div>
                            <Label
                              htmlFor={`cost-${log.id}`}
                              className="text-xs"
                            >
                              Repair Cost ($ USD)
                            </Label>
                            <div className="relative mt-1">
                              <DollarSign className="absolute top-2 left-2.5 h-3.5 w-3.5 text-muted-foreground" />
                              <Input
                                id={`cost-${log.id}`}
                                type="number"
                                step="0.01"
                                min="0"
                                placeholder="0.00"
                                value={cost}
                                onChange={(e) => setCost(e.target.value)}
                                className="h-10 pl-7 text-sm"
                              />
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={handleCancelResolving}
                            disabled={isLoading}
                            className="min-h-10 text-sm sm:min-h-9"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isLoading}
                            className="min-h-10 text-sm sm:min-h-9"
                          >
                            {isLoading && (
                              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            )}
                            Complete Resolution
                          </Button>
                        </div>
                      </form>
                    ) : (
                      <div className="mt-3 flex justify-stretch sm:justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleStartResolving(log)}
                          className="min-h-10 w-full text-sm sm:min-h-9 sm:w-auto"
                        >
                          <Wrench className="mr-1.5 h-3.5 w-3.5" />
                          Resolve Issue
                        </Button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
