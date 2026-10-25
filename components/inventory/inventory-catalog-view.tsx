"use client"

import { useEffect, useState, useTransition } from "react"
import { useDebounce } from "@uidotdev/usehooks"
import Image from "next/image"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import {
  InventoryCondition,
  InventoryStatus,
  UserRole,
} from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import { TableRowActions } from "@/components/ui/table-row-actions"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
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
import { getProfileImageSrc } from "@/lib/profile-image"
import {
  Search,
  Plus,
  Wrench,
  Eye,
  CheckCircle2,
  Clock,
  LayoutGrid,
  List,
  MoreVertical,
  Pencil,
  Trash2,
  RotateCcw,
  MapPin,
  ChevronLeft,
  ChevronRight,
  Layers,
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

export interface UserLoanSummary {
  id: string
  itemId: string
  borrowerId: string
  checkedOutAt: Date | string
  expectedReturnAt: Date | string | null
  isOverdue: boolean
  item: {
    id: string
    name: string
    assetTag: string
    category: string
    location: string | null
  }
}

interface InventoryCatalogViewProps {
  initialItems: CatalogItem[]
  pagination: {
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
  userActiveLoans?: UserLoanSummary[]
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

export function InventoryCatalogView({
  initialItems,
  pagination,
  stats,
  currentUser,
  isManager,
  maintenanceQueue = [],
  userActiveLoans = [],
}: InventoryCatalogViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  // Search and view preferences
  const currentSearch = searchParams.get("search") || ""
  const currentCategory = searchParams.get("category") || "ALL"
  const currentStatus = searchParams.get("status") || "ALL"
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
  const [viewMode, setViewMode] = useState<"grid" | "table">("table")

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
      router.refresh()
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
      router.replace(`${pathname}?${params.toString()}`)
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
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    updateFilters({ search: searchInput.trim() })
  }

  const handleRefresh = () => {
    startTransition(() => {
      router.refresh()
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

      {/* Worker Active Loans Quick Bar (if any) */}
      {userActiveLoans.length > 0 && (
        <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
          <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <h3 className="text-sm font-semibold text-foreground">
                Your Checked-Out Equipment ({userActiveLoans.length})
              </h3>
            </div>
            <span className="text-xs text-muted-foreground sm:text-right">
              Please return promptly after studio sessions
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {userActiveLoans.map((loan) => (
              <div
                key={loan.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 shadow-xs"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {loan.item.assetTag}
                    </span>
                    {loan.isOverdue && (
                      <span className="py-0.2 rounded bg-rose-500/10 px-1.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                        OVERDUE
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs font-medium text-foreground">
                    {loan.item.name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Due:{" "}
                    {loan.expectedReturnAt
                      ? formatDateTime(loan.expectedReturnAt)
                      : "Open loan"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setReturnLoan({
                      id: loan.id,
                      item: {
                        id: loan.item.id,
                        name: loan.item.name,
                        assetTag: loan.item.assetTag,
                      },
                      checkedOutAt: loan.checkedOutAt,
                    })
                  }
                  className="h-7 shrink-0 gap-1 px-2.5 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Return
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filter Bar & Controls */}
      <div className="min-w-0 space-y-3">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search input */}
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full min-w-0 flex-1 sm:max-w-md"
          >
            <Search className="absolute top-2.5 left-3 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search by asset tag, name, model, serial..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </form>

          {/* Status selector and view mode */}
          <div className="flex min-w-0 items-center gap-2 sm:shrink-0">
            <div
              role="group"
              aria-label="Filter assets by status"
              className="no-scrollbar flex min-w-0 flex-1 items-center gap-1 overflow-x-auto overscroll-x-contain rounded-md border border-border bg-muted/30 p-1 text-xs"
            >
              {STATUS_FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => updateFilters({ status: f.value })}
                  aria-pressed={currentStatus === f.value}
                  className={`min-h-9 flex-none rounded-md border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap transition-colors sm:px-3 ${
                    currentStatus === f.value
                      ? "border-primary bg-primary text-primary-foreground shadow-xs"
                      : "border-foreground/15 bg-background text-muted-foreground hover:border-primary/50 hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <div className="flex flex-none items-center rounded-md border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
                  viewMode === "grid"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Grid view"
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={`flex h-9 w-9 items-center justify-center rounded transition-colors ${
                  viewMode === "table"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-label="Table view"
              >
                <List className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Category Horizontal Filter Pills */}
        <div
          role="group"
          aria-label="Filter assets by category"
          className="no-scrollbar flex max-w-full min-w-0 flex-nowrap items-center gap-2 overflow-x-auto overscroll-x-contain pb-1 text-xs"
        >
          {CATEGORIES.map((cat) => {
            const isSelected = currentCategory === cat
            return (
              <button
                key={cat}
                type="button"
                onClick={() => updateFilters({ category: cat })}
                aria-pressed={isSelected}
                className={`min-h-8 flex-none rounded-full border px-2.5 py-1.5 whitespace-nowrap transition-colors ${
                  isSelected
                    ? "border-foreground bg-foreground font-medium text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                {cat === "ALL" ? "All Categories" : cat}
              </button>
            )
          })}
        </div>
      </div>

      {/* Catalog Items Listing */}
      {initialItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-16 text-center">
          <Layers className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <h3 className="font-medium text-foreground">No equipment found</h3>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">
            {currentSearch ||
            currentCategory !== "ALL" ||
            currentStatus !== "ALL"
              ? "No items match your active filters. Try resetting search criteria."
              : "No assets have been added to the studio catalog yet."}
          </p>
          {(currentSearch ||
            currentCategory !== "ALL" ||
            currentStatus !== "ALL") && (
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                updateFilters({ search: "", category: "ALL", status: "ALL" })
              }
              className="mt-4 text-xs"
            >
              Clear Filters
            </Button>
          )}
        </div>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {initialItems.map((item) => {
            const isAvailable = item.status === InventoryStatus.AVAILABLE
            const isInUse = item.status === InventoryStatus.IN_USE
            const isMaintenance = item.status === InventoryStatus.MAINTENANCE
            const isRetired = item.status === InventoryStatus.RETIRED

            const isUserBorrower =
              isInUse &&
              item.activeLoan &&
              item.activeLoan.borrowerId === currentUser.id
            const canReturn = isInUse && (isUserBorrower || isManager)

            return (
              <Card
                key={item.id}
                className="flex flex-col justify-between border border-border bg-card transition-shadow hover:shadow-xs"
              >
                <div className="space-y-3 p-4">
                  {/* Card Header: Asset tag + Status badge */}
                  <div className="flex items-start justify-between gap-2">
                    <span className="rounded bg-muted px-2 py-0.5 font-mono text-xs font-semibold text-muted-foreground">
                      {item.assetTag}
                    </span>

                    <div className="flex items-center gap-1.5">
                      {item.activeLoan?.isOverdue && (
                        <span className="rounded bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                          OVERDUE
                        </span>
                      )}
                      <span
                        className={`rounded px-2 py-0.5 text-xs font-medium ${
                          isAvailable
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isInUse
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : isMaintenance
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>

                      {isManager && (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
                            aria-label="Asset options"
                          >
                            <MoreVertical className="h-3.5 w-3.5" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="text-xs">
                            <DropdownMenuItem
                              onClick={() => setViewingItem(item)}
                            >
                              <Eye className="mr-2 h-3.5 w-3.5" />
                              View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Pencil className="mr-2 h-3.5 w-3.5" />
                              Edit Item
                            </DropdownMenuItem>
                            {(isAvailable || isMaintenance) && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() =>
                                  openRetireConfirmation([item.id])
                                }
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                Retire Item
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>

                  {/* Title & Category */}
                  <div>
                    <h3 className="line-clamp-1 text-sm leading-snug font-medium text-foreground">
                      {item.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.category} {item.model ? `• ${item.model}` : ""}
                    </p>
                  </div>

                  {/* Location & Condition */}
                  <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
                    {item.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {item.location}
                      </span>
                    )}
                    <span className="font-medium text-foreground/80">
                      Condition: {item.condition}
                    </span>
                  </div>

                  {/* In-Use Active Borrower Info */}
                  {isInUse &&
                    item.activeLoan &&
                    (() => {
                      const avatarSrc = getProfileImageSrc(
                        item.activeLoan.borrower.image,
                        item.activeLoan.borrower.id
                      )
                      return (
                        <div className="space-y-1 rounded-md bg-muted/50 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              Borrowed by:
                            </span>
                            <div className="flex items-center gap-1.5">
                              {avatarSrc ? (
                                <div className="relative h-4 w-4 overflow-hidden rounded-full">
                                  <Image
                                    src={avatarSrc}
                                    alt={
                                      item.activeLoan.borrower.name ||
                                      "Borrower"
                                    }
                                    fill
                                    className="object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
                                  {(item.activeLoan.borrower.name ||
                                    item.activeLoan.borrower
                                      .email)[0].toUpperCase()}
                                </div>
                              )}
                              <span className="font-medium text-foreground">
                                {item.activeLoan.borrower.name ||
                                  item.activeLoan.borrower.email}
                              </span>
                            </div>
                          </div>

                          {item.activeLoan.expectedReturnAt && (
                            <div className="flex items-center justify-between text-muted-foreground">
                              <span>Expected Return:</span>
                              <span
                                className={
                                  item.activeLoan.isOverdue
                                    ? "font-semibold text-rose-600 dark:text-rose-400"
                                    : ""
                                }
                              >
                                {formatDateTime(
                                  item.activeLoan.expectedReturnAt
                                )}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })()}

                  {/* Maintenance notice */}
                  {isMaintenance && (
                    <div className="flex items-center gap-2 rounded-md bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
                      <Wrench className="h-3.5 w-3.5 shrink-0" />
                      <span>Item is undergoing service or repair.</span>
                    </div>
                  )}
                </div>

                {/* Card Action Footer */}
                <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/20 p-3">
                  {isAvailable && (
                    <Button
                      size="sm"
                      onClick={() => setCheckoutItem(item)}
                      className="h-8 w-full text-xs"
                    >
                      Check Out Gear
                    </Button>
                  )}

                  {isInUse && canReturn && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setReturnLoan({
                          id: item.activeLoan!.id,
                          item: {
                            id: item.id,
                            name: item.name,
                            assetTag: item.assetTag,
                          },
                          checkedOutAt: item.activeLoan!.checkedOutAt,
                        })
                      }
                      className="h-8 w-full gap-1.5 text-xs"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Return Gear
                    </Button>
                  )}

                  {isInUse && !canReturn && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled
                      className="h-8 w-full text-xs opacity-60"
                    >
                      Currently In Use
                    </Button>
                  )}

                  {isMaintenance && isManager && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setMaintenanceDialogOpen(true)}
                      className="h-8 w-full gap-1.5 text-xs"
                    >
                      <Wrench className="h-3.5 w-3.5 text-amber-500" />
                      View Repair Ticket
                    </Button>
                  )}

                  {isRetired && (
                    <span className="w-full py-1 text-center text-xs text-muted-foreground">
                      Retired from service
                    </span>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      ) : (
        /* Table View */
        <div className="max-w-full min-w-0 rounded-lg border border-border bg-card">
          <p className="px-3 pt-3 text-xs text-muted-foreground sm:hidden">
            Swipe horizontally to view all columns.
          </p>
          {isManager && selectedRetireableIds.length > 0 && (
            <div className="flex flex-col gap-2 border-b border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                {selectedRetireableIds.length} asset
                {selectedRetireableIds.length === 1 ? "" : "s"} selected
              </p>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => openRetireConfirmation(selectedRetireableIds)}
                className="h-9 w-full gap-2 border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive sm:w-auto"
              >
                <Trash2 className="h-4 w-4" />
                Retire selected
              </Button>
            </div>
          )}
          <Table className="min-w-[950px] table-fixed">
            <colgroup>
              {isManager && <col className="w-10" />}
              <col className="w-[100px]" />
              <col className="w-[180px]" />
              <col className="w-[120px]" />
              <col className="w-[105px]" />
              <col className="w-[80px]" />
              <col className="w-[120px]" />
              <col className="w-[140px]" />
              <col className="w-16" />
            </colgroup>
            <TableHeader>
              <TableRow className="text-xs">
                {isManager && (
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allRetireableSelected}
                      disabled={retireableItems.length === 0}
                      onChange={(event) =>
                        setSelectedAssetIds(
                          event.target.checked
                            ? retireableItems.map((item) => item.id)
                            : []
                        )
                      }
                      aria-label="Select all assets that can be retired on this page"
                      className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed"
                    />
                  </TableHead>
                )}
                <TableHead className="whitespace-nowrap">Asset Tag</TableHead>
                <TableHead>Item Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="whitespace-nowrap">Status</TableHead>
                <TableHead className="whitespace-nowrap">Condition</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Borrower / Due Date</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {initialItems.map((item) => {
                const isAvailable = item.status === InventoryStatus.AVAILABLE
                const isInUse = item.status === InventoryStatus.IN_USE
                const isMaintenance =
                  item.status === InventoryStatus.MAINTENANCE

                const isUserBorrower =
                  isInUse &&
                  item.activeLoan &&
                  item.activeLoan.borrowerId === currentUser.id
                const canReturn = isInUse && (isUserBorrower || isManager)

                return (
                  <TableRow
                    key={item.id}
                    className={`text-xs ${selectedAssetIds.includes(item.id) ? "bg-primary/5" : ""}`}
                  >
                    {isManager && (
                      <TableCell className="w-10">
                        <input
                          type="checkbox"
                          checked={selectedAssetIds.includes(item.id)}
                          disabled={!isAvailable && !isMaintenance}
                          onChange={() => toggleAssetSelection(item.id)}
                          aria-label={`Select ${item.name} for retirement`}
                          className="size-4 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-40"
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-mono font-medium whitespace-nowrap">
                      {item.assetTag}
                    </TableCell>
                    <TableCell className="max-w-0">
                      <div
                        className="truncate font-medium text-foreground"
                        title={item.name}
                      >
                        {item.name}
                      </div>
                      {item.model ? (
                        <div
                          className="truncate text-xs text-muted-foreground"
                          title={item.model}
                        >
                          {item.model}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell
                      className="truncate text-muted-foreground"
                      title={item.category}
                    >
                      {item.category}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${
                          isAvailable
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            : isInUse
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                              : isMaintenance
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {item.status.replace("_", " ")}
                      </span>
                    </TableCell>
                    <TableCell>{item.condition}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.location || "—"}
                    </TableCell>
                    <TableCell>
                      {isInUse && item.activeLoan ? (
                        <div>
                          <div className="font-medium text-foreground">
                            {item.activeLoan.borrower.name ||
                              item.activeLoan.borrower.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {item.activeLoan.expectedReturnAt ? (
                              <span
                                className={
                                  item.activeLoan.isOverdue
                                    ? "font-semibold text-rose-600 dark:text-rose-400"
                                    : ""
                                }
                              >
                                Due:{" "}
                                {formatDate(item.activeLoan.expectedReturnAt)}
                              </span>
                            ) : (
                              "No due date"
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <TableRowActions label={`Actions for ${item.name}`}>
                        <DropdownMenuItem onClick={() => setViewingItem(item)}>
                          <Eye aria-hidden="true" />
                          View details
                        </DropdownMenuItem>
                        {isAvailable && (
                          <DropdownMenuItem
                            onClick={() => setCheckoutItem(item)}
                          >
                            Check out
                          </DropdownMenuItem>
                        )}
                        {isInUse && canReturn && (
                          <DropdownMenuItem
                            onClick={() =>
                              setReturnLoan({
                                id: item.activeLoan!.id,
                                item: {
                                  id: item.id,
                                  name: item.name,
                                  assetTag: item.assetTag,
                                },
                                checkedOutAt: item.activeLoan!.checkedOutAt,
                              })
                            }
                          >
                            <RotateCcw aria-hidden="true" />
                            Return
                          </DropdownMenuItem>
                        )}
                        {isManager && (
                          <>
                            <DropdownMenuItem
                              onClick={() => handleOpenEdit(item)}
                            >
                              <Pencil aria-hidden="true" />
                              Edit
                            </DropdownMenuItem>
                            {(isAvailable || isMaintenance) && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() =>
                                    openRetireConfirmation([item.id])
                                  }
                                >
                                  <Trash2 aria-hidden="true" />
                                  Retire asset
                                </DropdownMenuItem>
                              </>
                            )}
                          </>
                        )}
                      </TableRowActions>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Pagination Footer */}
      {pagination.totalPages > 1 && (
        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Showing Page {pagination.page} of {pagination.totalPages} (
            {pagination.total} total items)
          </p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() =>
                updateFilters({ page: String(pagination.page - 1) })
              }
              className="h-8 gap-1 text-xs"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                updateFilters({ page: String(pagination.page + 1) })
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
