
import { useState } from "react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
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
import {
  createInventoryItem,
  updateInventoryItem,
  retireInventoryItem,
} from "@/app/actions/inventory"
import { InventoryCondition } from "@/generated/prisma/browser"
import { Plus, Trash2, Loader2, AlertCircle } from "lucide-react"
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

const CATEGORY_PRESETS = [
  "Photography",
  "Videography",
  "Computing",
  "Design & Creative",
  "Web & Staging",
  "Audio & Broadcast",
  "Mobile Testing",
  "Lighting & Grip",
  "Storage & Cables",
  "General",
]

const CONDITION_OPTIONS = [
  { value: InventoryCondition.EXCELLENT, label: "Excellent (Mint condition)" },
  { value: InventoryCondition.GOOD, label: "Good (Minor normal wear)" },
  {
    value: InventoryCondition.FAIR,
    label: "Fair (Cosmetic blemishes, functional)",
  },
  {
    value: InventoryCondition.NEEDS_ATTENTION,
    label: "Needs Attention (Requires repair)",
  },
] as const

export interface InventoryItemFormData {
  id?: string
  name: string
  category: string
  assetTag?: string
  model?: string | null
  serialNumber?: string | null
  condition: InventoryCondition
  location?: string | null
  purchaseDate?: string | null
  notes?: string | null
  metadata?: Record<string, unknown> | null
}

interface CreateItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialData?: InventoryItemFormData | null
  onSuccess?: () => void
}

export function CreateItemDialog({
  open,
  onOpenChange,
  initialData,
  onSuccess,
}: CreateItemDialogProps) {
  const isEditing = Boolean(initialData?.id)

  const [name, setName] = useState(initialData?.name || "")
  const [category, setCategory] = useState(
    initialData?.category || "Photography"
  )
  const [assetTag, setAssetTag] = useState(initialData?.assetTag || "")
  const [model, setModel] = useState(initialData?.model || "")
  const [serialNumber, setSerialNumber] = useState(
    initialData?.serialNumber || ""
  )
  const [condition, setCondition] = useState<InventoryCondition>(
    initialData?.condition || InventoryCondition.GOOD
  )
  const [location, setLocation] = useState(initialData?.location || "")
  const [purchaseDate, setPurchaseDate] = useState(
    initialData?.purchaseDate
      ? new Date(initialData.purchaseDate).toISOString().split("T")[0]
      : ""
  )
  const [notes, setNotes] = useState(initialData?.notes || "")

  // Metadata key-value rows
  const [metadataRows, setMetadataRows] = useState<
    Array<{ key: string; value: string }>
  >(() => {
    if (initialData?.metadata && typeof initialData.metadata === "object") {
      return Object.entries(initialData.metadata).map(([k, v]) => ({
        key: k,
        value: typeof v === "object" ? JSON.stringify(v) : String(v ?? ""),
      }))
    }
    return []
  })

  const [isLoading, setIsLoading] = useState(false)
  const [isRetiring, setIsRetiring] = useState(false)
  const [retireConfirmOpen, setRetireConfirmOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAddMetaRow = () => {
    setMetadataRows((prev) => [...prev, { key: "", value: "" }])
  }

  const handleRemoveMetaRow = (idx: number) => {
    setMetadataRows((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleMetaChange = (
    idx: number,
    field: "key" | "value",
    val: string
  ) => {
    setMetadataRows((prev) =>
      prev.map((row, i) => (i === idx ? { ...row, [field]: val } : row))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError("Asset name is required.")
      return
    }

    setIsLoading(true)
    setError(null)

    // Assemble metadata dictionary
    const metadataObj: Record<string, string> = {}
    for (const row of metadataRows) {
      if (row.key.trim()) {
        metadataObj[row.key.trim()] = row.value.trim()
      }
    }

    try {
      if (isEditing && initialData?.id) {
        const res = await updateInventoryItem({
          id: initialData.id,
          name: name.trim(),
          category: category.trim(),
          assetTag: assetTag.trim() || undefined,
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          condition,
          location: location.trim() || null,
          purchaseDate: purchaseDate || null,
          metadata: metadataObj,
          notes: notes.trim() || null,
        })

        if (res.error) throw new Error(res.error)
      } else {
        const res = await createInventoryItem({
          name: name.trim(),
          category: category.trim(),
          assetTag: assetTag.trim() || undefined,
          model: model.trim() || null,
          serialNumber: serialNumber.trim() || null,
          condition,
          location: location.trim() || null,
          purchaseDate: purchaseDate || null,
          metadata: metadataObj,
          notes: notes.trim() || null,
        })

        if (res.error) throw new Error(res.error)
      }

      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save asset.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleRetire = async () => {
    if (!initialData?.id) return

    setIsRetiring(true)
    setError(null)
    try {
      const res = await retireInventoryItem({
        id: initialData.id,
        reason: "Decommissioned by manager.",
      })
      if (res.error) throw new Error(res.error)
      setRetireConfirmOpen(false)
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to retire asset.")
    } finally {
      setIsRetiring(false)
    }
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          className="gap-0 overflow-hidden p-0 data-[side=right]:w-[min(96vw,56rem)] data-[side=right]:sm:max-w-4xl"
        >
          <SheetHeader className="shrink-0 border-b border-border px-6 py-5 pr-14 text-left">
            <SheetTitle className="text-lg">
              {isEditing ? "Edit Asset" : "Register New Asset"}
            </SheetTitle>
            <SheetDescription className="max-w-2xl text-sm leading-6">
              {isEditing
                ? "Update item details, location, or custom department attributes."
                : "Catalog physical equipment, workstations, or creative resources."}
            </SheetDescription>
          </SheetHeader>

          <form
            onSubmit={handleSubmit}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto overscroll-contain px-6 py-5">
              {error && (
                <div
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name" className="text-sm font-medium">
                    Asset Name <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Sony FX3 Cinema Camera, Wacom Cintiq 27..."
                    required
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="category" className="text-sm font-medium">
                    Category
                  </Label>
                  <Select
                    value={category}
                    onValueChange={(val) => val && setCategory(val)}
                  >
                    <SelectTrigger
                      id="category"
                      className="h-10 w-full text-sm"
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_PRESETS.map((cat) => (
                        <SelectItem key={cat} value={cat} className="text-xs">
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="assetTag" className="text-sm font-medium">
                    Asset Tag (Optional)
                  </Label>
                  <Input
                    id="assetTag"
                    value={assetTag}
                    onChange={(e) => setAssetTag(e.target.value)}
                    placeholder="Auto-generated if blank (INV-xxxx)"
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="model" className="text-sm font-medium">
                    Model / Brand (Optional)
                  </Label>
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="e.g. ILME-FX3, M2 Ultra..."
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="serialNumber" className="text-sm font-medium">
                    Serial Number (Optional)
                  </Label>
                  <Input
                    id="serialNumber"
                    value={serialNumber}
                    onChange={(e) => setSerialNumber(e.target.value)}
                    placeholder="Unique hardware serial..."
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="location" className="text-sm font-medium">
                    Storage Location (Optional)
                  </Label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="e.g. Studio Bay A, Tech Locker 2, Cloud..."
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="condition" className="text-sm font-medium">
                    Initial Condition
                  </Label>
                  <Select
                    value={condition}
                    items={CONDITION_OPTIONS}
                    onValueChange={(val) =>
                      setCondition(val as InventoryCondition)
                    }
                  >
                    <SelectTrigger
                      id="condition"
                      className="h-10 w-full text-sm"
                    >
                      <SelectValue>
                        {(value: InventoryCondition | null) =>
                          CONDITION_OPTIONS.find(
                            (option) => option.value === value
                          )?.label ?? "Select condition"
                        }
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {CONDITION_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={option.value}
                          className="text-sm"
                        >
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="purchaseDate" className="text-sm font-medium">
                    Acquisition / Purchase Date (Optional)
                  </Label>
                  <Input
                    id="purchaseDate"
                    type="date"
                    value={purchaseDate}
                    onChange={(e) => setPurchaseDate(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="notes" className="text-sm font-medium">
                    Notes & Instructions (Optional)
                  </Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add accessories included, kit contents, or handling rules..."
                    className="min-h-24 text-sm"
                  />
                </div>
              </div>

              {/* Dynamic Custom Metadata */}
              <div className="space-y-3 border-t border-border pt-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">
                      Custom Attributes
                    </h4>
                    <p className="text-xs text-muted-foreground">
                      Key-value pairs for web links, display specs, or
                      department tags.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMetaRow}
                    className="h-8 gap-1.5 text-xs"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Field</span>
                  </Button>
                </div>

                {metadataRows.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {metadataRows.map((row, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <Input
                          placeholder="Attribute name (e.g. stagingUrl, mount)"
                          value={row.key}
                          onChange={(e) =>
                            handleMetaChange(idx, "key", e.target.value)
                          }
                          className="h-8 flex-1 text-xs"
                        />
                        <Input
                          placeholder="Value (e.g. https://preview.dev, Sony E)"
                          value={row.value}
                          onChange={(e) =>
                            handleMetaChange(idx, "value", e.target.value)
                          }
                          className="h-8 flex-1 text-xs"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveMetaRow(idx)}
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <SheetFooter className="mt-0 shrink-0 flex-row items-center justify-between border-t border-border px-6 py-4 sm:justify-between">
              {isEditing && (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={isLoading || isRetiring}
                  onClick={() => setRetireConfirmOpen(true)}
                  className="text-xs"
                >
                  {isRetiring ? "Retiring..." : "Retire Asset"}
                </Button>
              )}
              <div className="ml-auto flex items-center gap-2">
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
                  {isLoading && (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  )}
                  <span>{isEditing ? "Save Changes" : "Create Asset"}</span>
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
      <AlertDialog
        open={retireConfirmOpen}
        onOpenChange={(nextOpen) => {
          if (!isRetiring) setRetireConfirmOpen(nextOpen)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Retire this asset?</AlertDialogTitle>
            <AlertDialogDescription>
              {initialData?.name} will leave the active catalog and cannot be
              checked out again. Its inventory history will be kept.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isRetiring}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={isRetiring}
              onClick={(event) => {
                event.preventDefault()
                void handleRetire()
              }}
            >
              {isRetiring ? "Retiring…" : "Retire asset"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
