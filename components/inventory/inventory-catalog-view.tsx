import { useEffect, useMemo, useState, useTransition } from "react"
import { useDebounce } from "@uidotdev/usehooks"
import { useLocation, useRouter } from "@tanstack/react-router"
import {
  InventoryCondition,
  InventoryStatus,
  UserRole,
} from "@/generated/prisma/browser"
import type { InventoryActivityAction } from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { CreateItemDialog } from "@/components/inventory/create-item-dialog"
import { InventoryItemDetailsSheet } from "@/components/inventory/inventory-item-details-sheet"
import { CheckoutDialog } from "@/components/inventory/checkout-dialog"
import { ReturnDialog } from "@/components/inventory/return-dialog"
import { retireInventoryItems } from "@/app/actions/inventory"
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
  MaintenanceDialog,
  type MaintenanceLogEntry,
} from "@/components/inventory/maintenance-dialog"
import {
  Search,
  Plus,
  Wrench,
  Eye,
  CheckCircle2,
  Clock,
  Pencil,
  Trash2,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Layers,
  History,
} from "lucide-react"

function formatDate(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })
}

function formatDateTime(date: Date | string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
}

export interface CatalogItem {
  id: string
  assetTag: string
  name: string
  category: string
  model: string | null
  serialNumber: string | null
  status: InventoryStatus
  condition: InventoryCondition
  location: string | null
  purchaseDate: Date | string | null
  metadata: Record<string, unknown> | null
  notes: string | null
  createdAt: Date | string
  updatedAt: Date | string
  activeLoan: {
    id: string
    itemId: string
    borrowerId: string
    checkedOutAt: Date | string
    expectedReturnAt: Date | string | null
    returnedAt: Date | string | null
    checkoutNotes: string | null
    returnNotes: string | null
    returnCondition: InventoryCondition | null
    borrower: {
      id: string
      name: string | null
      email: string
      image: string | null
    }
    isOverdue: boolean
  } | null
}

export interface InventoryStats {
  total: number
  available: number
  inUse: number
  maintenance: number
  retired: number
}

interface InventoryCatalogViewProps {
  initialItems: CatalogItem[]
  checkoutItems: CatalogItem[]
  pagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  checkoutPagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  activityLogs: {
    id: string
    action: InventoryActivityAction
    actorLabel: string
    details: unknown
    createdAt: Date | string
    item: { id: string; name: string; assetTag: string }
  }[]
  activityPagination: {
    total: number
    page: number
    pageSize: number
    totalPages: number
  }
  stats: InventoryStats
  currentUser: {
    id: string
    role: UserRole
    name?: string | null
  }
  isManager: boolean
  maintenanceQueue?: MaintenanceLogEntry[]
}

const CATEGORIES = [
  "ALL",
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

const STATUS_FILTERS = [
  { label: "All Items", value: "ALL" },
  { label: "Available", value: InventoryStatus.AVAILABLE },
  { label: "In Use", value: InventoryStatus.IN_USE },
  { label: "Maintenance", value: InventoryStatus.MAINTENANCE },
  { label: "Retired", value: InventoryStatus.RETIRED },
]

const CONDITION_LABELS: Record<InventoryCondition, string> = {
  [InventoryCondition.EXCELLENT]: "Excellent",
  [InventoryCondition.GOOD]: "Good",
  [InventoryCondition.FAIR]: "Fair",
  [InventoryCondition.NEEDS_ATTENTION]: "Needs attention",
}

const STATUS_LABELS: Record<InventoryStatus, string> = {
  [InventoryStatus.AVAILABLE]: "Available",
  [InventoryStatus.IN_USE]: "In use",
  [InventoryStatus.MAINTENANCE]: "Maintenance",
  [InventoryStatus.RETIRED]: "Retired",
}

const ACTIVITY_LABELS: Record<InventoryActivityAction, string> = {
  ITEM_CREATED: "Asset added",
  ITEM_UPDATED: "Asset updated",
  ITEM_RETIRED: "Asset retired",
  ITEM_CHECKED_OUT: "Asset checked out",
  ITEM_RETURNED: "Asset returned",
  MAINTENANCE_REPORTED: "Maintenance reported",
  MAINTENANCE_RESOLVED: "Maintenance resolved",
}

function activityDescription(action: InventoryActivityAction, details: unknown) {
  const data = details && typeof details === "object" ? details as Record<string, unknown> : {}
  if (action === "ITEM_UPDATED" && Array.isArray(data.changedFields)) {
    return `Changed: ${data.changedFields.map(String).join(", ")}`
  }
  if (action === "ITEM_RETIRED" && typeof data.reason === "string" && data.reason) {
    return data.reason
  }
  if (action === "ITEM_CHECKED_OUT" && typeof data.expectedReturnAt === "string") {
    return `Expected return ${formatDateTime(data.expectedReturnAt)}`
  }
  if (action === "ITEM_RETURNED") {
    const condition = typeof data.condition === "string" ? CONDITION_LABELS[data.condition as InventoryCondition] ?? data.condition : null
    return [condition ? `Condition: ${condition}` : null, data.issueReported ? "Issue reported" : null].filter(Boolean).join(" · ") || "Loan closed"
  }
  if ((action === "MAINTENANCE_REPORTED" || action === "MAINTENANCE_RESOLVED") && typeof data.title === "string") {
    return data.title
  }
  if (data.historical === true && typeof data.note === "string") return data.note
  if (action === "MAINTENANCE_RESOLVED" && typeof data.restoredCondition === "string") {
    return `Restored condition: ${CONDITION_LABELS[data.restoredCondition as InventoryCondition] ?? data.restoredCondition}`
  }
  return "Inventory record changed"
}

export function InventoryCatalogView({
  initialItems,
  checkoutItems,
  pagination,
  checkoutPagination,
  activityLogs,
  activityPagination,
  stats,
  currentUser,
  isManager,
  maintenanceQueue = [],
}: InventoryCatalogViewProps) {
  const router = useRouter()
  const location = useLocation()
  const pathname = location.pathname
  const searchParams = useMemo(() => new URLSearchParams(location.searchStr), [location.searchStr])
  const [, startTransition] = useTransition()

  // Search and tab state
  const currentSearch = searchParams.get("search") || ""
  const currentCategory = searchParams.get("category") || "ALL"
  const currentStatus = searchParams.get("status") || "ALL"
  const tabParam = searchParams.get("tab")
  const currentTab = tabParam === "checkout" || tabParam === "activity" ? tabParam : "inventory"
  const activePagination = currentTab === "checkout" ? checkoutPagination : currentTab === "activity" ? activityPagination : pagination
  const [searchDraft, setSearchDraft] = useState({
    committed: currentSearch,
    value: currentSearch,
  })
  const searchInput =
    searchDraft.committed === currentSearch ? searchDraft.value : currentSearch
  const setSearchInput = (value: string) => {
    setSelectedAssetIds([])
    setSearchDraft({ committed: currentSearch, value })
  }
  const debouncedSearch = useDebounce(searchInput, 350)

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null)
  const [viewingItem, setViewingItem] = useState<CatalogItem | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [retireConfirmOpen, setRetireConfirmOpen] = useState(false)
  const [retireError, setRetireError] = useState<string | null>(null)
  const [isRetiring, setIsRetiring] = useState(false)
  const [checkoutItem, setCheckoutItem] = useState<CatalogItem | null>(null)
  const [returnLoan, setReturnLoan] = useState<{
    id: string
    item: { id: string; name: string; assetTag: string }
    checkedOutAt: string | Date
  } | null>(null)
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false)

  const retireableItems = initialItems.filter(
    (item) =>
      item.status === InventoryStatus.AVAILABLE ||
      item.status === InventoryStatus.MAINTENANCE
  )
  const selectedRetireableIds = selectedAssetIds.filter((id) =>
    retireableItems.some((item) => item.id === id)
  )
  const allRetireableSelected =
    retireableItems.length > 0 &&
    retireableItems.every((item) => selectedAssetIds.includes(item.id))

  const toggleAssetSelection = (id: string) => {
    setSelectedAssetIds((current) =>
      current.includes(id)
        ? current.filter((itemId) => itemId !== id)
        : [...current, id]
    )
  }

  const openRetireConfirmation = (ids: string[]) => {
    setSelectedAssetIds(ids)
    setRetireError(null)
    setRetireConfirmOpen(true)
  }

  const handleRetireSelected = async () => {
    if (selectedRetireableIds.length === 0) return
    setIsRetiring(true)
    setRetireError(null)
    try {
      const result = await retireInventoryItems({
        ids: selectedRetireableIds,
        reason: "Retired by manager from the inventory catalog.",
      })
      if (result.error) {
        setRetireError(result.error)
        return
      }
      setRetireConfirmOpen(false)
      setSelectedAssetIds([])
      router.invalidate()
    } catch (error) {
      setRetireError(
        error instanceof Error
          ? error.message
          : "Could not retire the selected assets."
      )
    } finally {
      setIsRetiring(false)
    }
  }

  useEffect(() => {
    const search = debouncedSearch.trim()
    if (search === currentSearch) return

    const params = new URLSearchParams(searchParams.toString())
    if (search) params.set("search", search)
    else params.delete("search")
    params.delete("page")

    startTransition(() => {
      router.navigate({ href: `${pathname}?${params.toString()}`, replace: true })
    })
  }, [
    currentSearch,
    debouncedSearch,
    pathname,
    router,
    searchParams,
    startTransition,
  ])

  const updateFilters = (newParams: Record<string, string | null>) => {
    setSelectedAssetIds([])
    const params = new URLSearchParams(searchParams.toString())
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === "" || v === "ALL") {
        params.delete(k)
      } else {
        params.set(k, v)
      }
    })
    // Reset to page 1 on filter changes if not paging
    if (!("page" in newParams)) {
      params.delete("page")
    }

    startTransition(() => {
      router.navigate({ href: `${pathname}?${params.toString()}` })
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchInput.trim() })
  }

  const handleRefresh = () => {
    startTransition(() => {
      router.invalidate()
    })
  }

  const handleOpenEdit = (item: CatalogItem) => {
    setEditingItem(item)
    setCreateDialogOpen(true)
  }

  const handleCloseCreate = (open: boolean) => {
    setCreateDialogOpen(open)
    if (!open) {
      setEditingItem(null)
    }
  }

  const openReturn = (item: CatalogItem) => {
    if (!item.activeLoan) return
    setReturnLoan({
      id: item.activeLoan.id,
      item: { id: item.id, name: item.name, assetTag: item.assetTag },
      checkedOutAt: item.activeLoan.checkedOutAt,
    })
  }

  const activeMaintenanceCount = maintenanceQueue.filter(
    (l) => l.status === "OPEN" || l.status === "IN_PROGRESS"
  ).length

  return (
    <div className="w-full max-w-full min-w-0 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Inventory & Equipment
          </h1>
          <p className="mt-0.5 max-w-full text-sm break-words text-muted-foreground">
            Track studio cameras, workstations, staging credentials, and
            creative assets.
          </p>
        </div>

        <div className="grid w-full grid-cols-1 gap-2 min-[420px]:grid-cols-2 sm:flex sm:w-auto">
          {isManager && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setMaintenanceDialogOpen(true)}
                className="relative w-full min-w-0 gap-1.5 border-amber-500/50 bg-amber-500/5 text-foreground hover:border-amber-500/80 hover:bg-amber-500/10 focus-visible:ring-amber-500/40 sm:w-auto dark:border-amber-500/60 dark:bg-amber-500/10 dark:hover:border-amber-400 dark:hover:bg-amber-500/15"
              >
                <Wrench className="h-4 w-4 text-amber-500" />
                <span>Maintenance Queue</span>
                {activeMaintenanceCount > 0 && (
                  <span className="ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/15 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                    {activeMaintenanceCount}
                  </span>
                )}
              </Button>

              <Button
                size="sm"
                onClick={() => {
                  setEditingItem(null)
                  setCreateDialogOpen(true)
                }}
                className="w-full gap-1.5 sm:w-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add Asset</span>
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Total Assets
            </span>
            <Layers className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.total}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Available
            </span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.available}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              In Use / Loaned
            </span>
            <Clock className="h-4 w-4 text-blue-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.inUse}
          </div>
        </div>

        <div className="min-w-0 overflow-hidden rounded-lg border border-border bg-card p-4 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Maintenance
            </span>
            <Wrench className="h-4 w-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {stats.maintenance}
          </div>
        </div>
      </div>

      <Tabs value={currentTab} onValueChange={(value) => updateFilters({ tab: value, page: null })} className="min-w-0 gap-4">
        <TabsList aria-label="Inventory views" className="w-full max-w-lg justify-start rounded-lg">
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
          <TabsTrigger value="checkout">Checkout</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>
      {/* Shared search and category filters */}
      {currentTab !== "activity" && (
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <form onSubmit={handleSearchSubmit} className="relative w-full min-w-0 flex-1 sm:max-w-md">
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input type="search" placeholder="Search by asset tag, name, model, serial..." value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="h-9 pl-9 text-xs" />
          </form>
          {currentTab === "inventory" && (
            <div role="group" aria-label="Filter assets by status" className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto overscroll-x-contain rounded-md border border-border bg-muted/30 p-1 text-xs sm:max-w-full">
              {STATUS_FILTERS.map((f) => (
                <button key={f.value} type="button" onClick={() => updateFilters({ status: f.value })} aria-pressed={currentStatus === f.value} className={`min-h-9 flex-none rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 ${currentStatus === f.value ? "border-primary bg-primary text-primary-foreground shadow-xs" : "border-foreground/15 bg-background text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-foreground"}`}>
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div role="group" aria-label="Filter assets by category" className="no-scrollbar flex max-w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 text-xs">
          {CATEGORIES.map((cat) => {
            const isSelected = currentCategory === cat
            return <button key={cat} type="button" onClick={() => updateFilters({ category: cat })} aria-pressed={isSelected} className={`min-h-8 flex-none rounded-full border px-2.5 py-1.5 whitespace-nowrap transition-colors ${isSelected ? "border-foreground bg-foreground font-medium text-background" : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"}`}>{cat === "ALL" ? "All Categories" : cat}</button>
          })}
        </div>
      </div>
      )}

        <TabsContent value="inventory" className="min-w-0 space-y-4">
          {initialItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-14 text-center">
              <Layers className="mx-auto mb-3 size-9 text-muted-foreground/50" />
              <h3 className="font-medium text-foreground">No equipment found</h3>
              <p className="mx-auto mt-1 max-w-sm px-4 text-xs text-muted-foreground">
                {currentSearch || currentCategory !== "ALL" || currentStatus !== "ALL"
                  ? "No items match these filters. Try clearing a filter or changing your search."
                  : "No assets have been added to the studio catalog yet."}
              </p>
              {(currentSearch || currentCategory !== "ALL" || currentStatus !== "ALL") && (
                <Button variant="outline" size="sm" onClick={() => updateFilters({ search: "", category: "ALL", status: "ALL" })} className="mt-4 text-xs">Clear filters</Button>
              )}
            </div>
          ) : (
            <div className="max-w-full min-w-0 rounded-lg border border-border bg-card">
              <p className="px-3 pt-3 text-xs text-muted-foreground sm:hidden">Swipe horizontally to view all columns.</p>
              {isManager && selectedRetireableIds.length > 0 && (
                <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-muted-foreground">{selectedRetireableIds.length} asset{selectedRetireableIds.length === 1 ? "" : "s"} selected</p>
                  <Button type="button" size="sm" variant="outline" onClick={() => openRetireConfirmation(selectedRetireableIds)} className="h-9 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"><Trash2 className="size-4" />Retire selected</Button>
                </div>
              )}
              <Table className="min-w-[950px] table-fixed">
                <colgroup>
                  {isManager && <col className="w-10" />}
                  <col className="w-[100px]" /><col className="w-[180px]" /><col className="w-[120px]" /><col className="w-[105px]" /><col className="w-[120px]" /><col className="w-[120px]" /><col className="w-[140px]" /><col className="w-16" />
                </colgroup>
                <TableHeader><TableRow className="text-xs">
                  {isManager && <TableHead className="w-10"><input type="checkbox" checked={allRetireableSelected} disabled={retireableItems.length === 0} onChange={(event) => setSelectedAssetIds(event.target.checked ? retireableItems.map((item) => item.id) : [])} aria-label="Select all assets that can be retired on this page" className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed" /></TableHead>}
                  <TableHead>Asset tag</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Condition</TableHead><TableHead>Location</TableHead><TableHead>Borrower / due date</TableHead><TableHead className="text-right">Actions</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {initialItems.map((item) => {
                    const isAvailable = item.status === InventoryStatus.AVAILABLE
                    const isInUse = item.status === InventoryStatus.IN_USE
                    const isMaintenance = item.status === InventoryStatus.MAINTENANCE
                    const isUserBorrower = isInUse && item.activeLoan?.borrowerId === currentUser.id
                    return <TableRow key={item.id} className={`text-xs ${selectedAssetIds.includes(item.id) ? "bg-primary/5" : ""}`}>
                      {isManager && <TableCell className="w-10"><input type="checkbox" checked={selectedAssetIds.includes(item.id)} disabled={!isAvailable && !isMaintenance} onChange={() => toggleAssetSelection(item.id)} aria-label={`Select ${item.name} for retirement`} className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40" /></TableCell>}
                      <TableCell className="font-mono font-medium whitespace-nowrap">{item.assetTag}</TableCell>
                      <TableCell className="max-w-0"><div className="truncate font-medium" title={item.name}>{item.name}</div>{item.model && <div className="truncate text-xs text-muted-foreground" title={item.model}>{item.model}</div>}</TableCell>
                      <TableCell className="truncate text-muted-foreground" title={item.category}>{item.category}</TableCell>
                      <TableCell><span className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${isAvailable ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : isInUse ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : isMaintenance ? "bg-amber-500/10 text-amber-600 dark:text-amber-400" : "bg-muted text-muted-foreground"}`}>{STATUS_LABELS[item.status]}</span></TableCell>
                      <TableCell>{CONDITION_LABELS[item.condition]}</TableCell>
                      <TableCell className="text-muted-foreground">{item.location || "—"}</TableCell>
                      <TableCell>{isInUse && item.activeLoan ? <div><div className="font-medium">{item.activeLoan.borrower.name || item.activeLoan.borrower.email}</div><div className={`text-xs ${item.activeLoan.isOverdue ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{item.activeLoan.expectedReturnAt ? `Due: ${formatDate(item.activeLoan.expectedReturnAt)}` : "No due date"}</div></div> : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell className="text-right"><TableRowActions label={`Actions for ${item.name}`}>
                        <DropdownMenuItem onClick={() => setViewingItem(item)}><Eye aria-hidden="true" />View details</DropdownMenuItem>
                        {isAvailable && <DropdownMenuItem onClick={() => setCheckoutItem(item)}>Check out</DropdownMenuItem>}
                        {isUserBorrower && <DropdownMenuItem onClick={() => openReturn(item)}><RotateCcw aria-hidden="true" />Return</DropdownMenuItem>}
                        {isManager && <><DropdownMenuItem onClick={() => handleOpenEdit(item)}><Pencil aria-hidden="true" />Edit</DropdownMenuItem>{(isAvailable || isMaintenance) && <><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => openRetireConfirmation([item.id])}><Trash2 aria-hidden="true" />Retire asset</DropdownMenuItem></>}</>}
                      </TableRowActions></TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="checkout" className="min-w-0">
          {checkoutItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-14 text-center"><Clock className="mx-auto mb-3 size-8 text-muted-foreground/50" /><h3 className="font-medium">No checked-out assets</h3><p className="mt-1 text-sm text-muted-foreground">Active equipment loans will appear here.</p></div>
          ) : (
            <div className="max-w-full min-w-0 rounded-lg border border-border bg-card">
              <p className="px-3 pt-3 text-xs text-muted-foreground sm:hidden">Swipe horizontally to view all columns.</p>
              <Table className="min-w-[900px] table-fixed">
                <colgroup><col className="w-[110px]" /><col className="w-[190px]" /><col className="w-[130px]" /><col className="w-[170px]" /><col className="w-[150px]" /><col className="w-[150px]" /><col className="w-[110px]" /><col className="w-16" /></colgroup>
                <TableHeader><TableRow className="text-xs"><TableHead>Asset tag</TableHead><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead>Checked out by</TableHead><TableHead>Checked out</TableHead><TableHead>Due date</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                <TableBody>
                  {checkoutItems.map((item) => {
                    const loan = item.activeLoan
                    if (!loan) return null
                    const isBorrower = loan.borrowerId === currentUser.id
                    return <TableRow key={loan.id} className="text-xs">
                      <TableCell className="font-mono font-medium whitespace-nowrap">{item.assetTag}</TableCell>
                      <TableCell className="max-w-0"><div className="truncate font-medium" title={item.name}>{item.name}</div>{item.model && <div className="truncate text-xs text-muted-foreground">{item.model}</div>}</TableCell>
                      <TableCell className="text-muted-foreground">{item.category}</TableCell>
                      <TableCell><div className="truncate font-medium">{loan.borrower.name || loan.borrower.email}</div><div className="truncate text-xs text-muted-foreground">{loan.borrower.email}</div></TableCell>
                      <TableCell className="whitespace-nowrap">{formatDateTime(loan.checkedOutAt)}</TableCell>
                      <TableCell className={`whitespace-nowrap ${loan.isOverdue ? "font-semibold text-rose-600 dark:text-rose-400" : "text-muted-foreground"}`}>{loan.expectedReturnAt ? formatDateTime(loan.expectedReturnAt) : "Open loan"}</TableCell>
                      <TableCell><span className={`inline-flex rounded px-2 py-0.5 font-medium ${loan.isOverdue ? "bg-rose-500/10 text-rose-600 dark:text-rose-400" : "bg-blue-500/10 text-blue-600 dark:text-blue-400"}`}>{loan.isOverdue ? "Overdue" : "Checked out"}</span></TableCell>
                      <TableCell className="text-right"><TableRowActions label={`Actions for ${item.name}`}><DropdownMenuItem onClick={() => setViewingItem(item)}><Eye aria-hidden="true" />View details</DropdownMenuItem>{isBorrower && <DropdownMenuItem onClick={() => openReturn(item)}><RotateCcw aria-hidden="true" />Return asset</DropdownMenuItem>}</TableRowActions></TableCell>
                    </TableRow>
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="activity" className="min-w-0">
          <p className="mb-3 text-sm text-muted-foreground">
            {isManager
              ? "All inventory activity across the studio."
              : "Inventory activity recorded under your account."}
          </p>
          {activityLogs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border py-14 text-center">
              <History className="mx-auto mb-3 size-8 text-muted-foreground/50" />
              <h3 className="font-medium">No inventory activity yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">Checkouts, returns, and inventory changes will be recorded here.</p>
            </div>
          ) : (
            <div className="max-w-full min-w-0 overflow-x-auto rounded-lg border border-border bg-card">
              <Table className="min-w-[780px] table-fixed">
                <colgroup><col className="w-[165px]" /><col className="w-[190px]" /><col className="w-[210px]" /><col className="w-[180px]" /><col /></colgroup>
                <TableHeader><TableRow className="text-xs"><TableHead>Date &amp; time</TableHead><TableHead>Activity</TableHead><TableHead>Inventory item</TableHead><TableHead>Done by</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>
                  {activityLogs.map((entry) => (
                    <TableRow key={entry.id} className="text-xs">
                      <TableCell className="whitespace-nowrap">{formatDateTime(entry.createdAt)}</TableCell>
                      <TableCell className="font-medium">{ACTIVITY_LABELS[entry.action]}</TableCell>
                      <TableCell><div className="truncate font-medium" title={entry.item.name}>{entry.item.name}</div><div className="font-mono text-muted-foreground">{entry.item.assetTag}</div></TableCell>
                      <TableCell className="truncate" title={entry.actorLabel}>{entry.actorLabel}</TableCell>
                      <TableCell className="whitespace-normal text-muted-foreground">{activityDescription(entry.action, entry.details)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Pagination Footer */}
      {activePagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing page {activePagination.page} of {activePagination.totalPages} (
            {activePagination.total} total items)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={activePagination.page <= 1}
              onClick={() =>
                updateFilters({ page: String(activePagination.page - 1) })
              }
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={activePagination.page >= activePagination.totalPages}
              onClick={() =>
                updateFilters({ page: String(activePagination.page + 1) })
              }
              className="h-8 gap-1 text-xs"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateItemDialog
        key={`${createDialogOpen ? "open" : "closed"}-${editingItem?.id ?? "new"}`}
        open={createDialogOpen}
        onOpenChange={handleCloseCreate}
        initialData={
          editingItem
            ? {
                id: editingItem.id,
                name: editingItem.name,
                category: editingItem.category,
                assetTag: editingItem.assetTag,
                model: editingItem.model,
                serialNumber: editingItem.serialNumber,
                condition: editingItem.condition,
                location: editingItem.location,
                purchaseDate: editingItem.purchaseDate
                  ? String(editingItem.purchaseDate)
                  : null,
                notes: editingItem.notes,
                metadata: editingItem.metadata,
              }
            : null
        }
        onSuccess={handleRefresh}
      />

      <CheckoutDialog
        key={checkoutItem?.id ?? "checkout-closed"}
        open={Boolean(checkoutItem)}
        onOpenChange={(open) => !open && setCheckoutItem(null)}
        item={checkoutItem}
        onSuccess={handleRefresh}
      />

      <ReturnDialog
        open={Boolean(returnLoan)}
        onOpenChange={(open) => !open && setReturnLoan(null)}
        loan={returnLoan}
        onSuccess={handleRefresh}
      />

      <InventoryItemDetailsSheet
        item={viewingItem}
        onOpenChange={(open) => !open && setViewingItem(null)}
      />

      {isManager && (
        <AlertDialog
          open={retireConfirmOpen}
          onOpenChange={(open) => {
            if (!isRetiring) {
              setRetireConfirmOpen(open)
              if (!open) setRetireError(null)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                Retire{" "}
                {selectedRetireableIds.length === 1
                  ? "this asset"
                  : `${selectedRetireableIds.length} assets`}
                ?
              </AlertDialogTitle>
              <AlertDialogDescription>
                Retired assets leave the active catalog and cannot be checked
                out again. Their inventory history is kept. Checked out assets
                must be returned before retirement.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {retireError && (
              <p role="alert" className="text-sm text-destructive">
                {retireError}
              </p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isRetiring}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                disabled={isRetiring || selectedRetireableIds.length === 0}
                onClick={(event) => {
                  event.preventDefault()
                  void handleRetireSelected()
                }}
              >
                {isRetiring ? "Retiring…" : "Retire assets"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {isManager && (
        <MaintenanceDialog
          open={maintenanceDialogOpen}
          onOpenChange={setMaintenanceDialogOpen}
          logs={maintenanceQueue}
          onSuccess={handleRefresh}
        />
      )}
    </div>
  )
}
