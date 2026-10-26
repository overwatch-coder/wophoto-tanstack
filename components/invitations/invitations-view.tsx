"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  Briefcase,
  Shield,
  CheckCircle2,
  XCircle,
  Ban,
} from "lucide-react"
import { UserRole, InvitationStatus } from "@/generated/prisma/browser"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"
import { InvitationTableActions, RevokeStudioAccountButton } from "@/components/invitations/invitation-link-actions"
import { CreateInvitationDialog } from "@/components/invitations/create-invitation-dialog"
import { Pagination } from "@/components/ui/pagination"
import { useDebounce } from "@uidotdev/usehooks"
import type { SearchParamsRecord } from "@/lib/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

export type InvitationRecord = {
  id: string
  email: string
  role: UserRole
  status: InvitationStatus
  expiresAt: Date
  usedAt: Date | null
  acceptedAt: Date | null
  createdAt: Date
  tokenEncrypted: string | null
  acceptedUser?: {
    id: string
    name: string | null
    image: string | null
  } | null
}

export type InvitationStats = {
  total: number
  pendingCount: number
  acceptedCount: number
  expiredCount: number
}

export function InvitationsView({
  invitations,
  stats,
  page,
  totalPages,
  totalItems,
  searchParams,
  searchQuery,
  selectedFilter,
  canManage,
  canRevokeManagementMembers,
}: {
  invitations: InvitationRecord[]
  stats: InvitationStats
  page: number
  totalPages: number
  totalItems: number
  searchParams: SearchParamsRecord
  searchQuery: string
  selectedFilter: string
  canManage: boolean
  canRevokeManagementMembers: boolean
}) {
  const router = useRouter()
  const [searchTerm, setSearchTerm] = useState(searchQuery)
  const debouncedSearchTerm = useDebounce(searchTerm, 350)
  const [prevQuery, setPrevQuery] = useState(searchQuery)
  if (prevQuery !== searchQuery) {
    setPrevQuery(searchQuery)
    setSearchTerm(searchQuery)
  }
  const now = new Date()

  useEffect(() => {
    if (
      debouncedSearchTerm.trim() !== searchTerm.trim() ||
      debouncedSearchTerm.trim() === searchQuery.trim()
    )
      return
    const params = new URLSearchParams(window.location.search)
    const query = debouncedSearchTerm.trim()
    if (query) params.set("q", query)
    else params.delete("q")
    params.delete("page")
    const next = params.toString()
    router.replace(
      next ? `/manager/invitations?${next}` : "/manager/invitations",
      { scroll: false }
    )
  }, [debouncedSearchTerm, router, searchQuery, searchTerm])

  function updateFilter(nextFilter: string) {
    const params = new URLSearchParams(window.location.search)
    if (nextFilter === "ALL") params.delete("filter")
    else params.set("filter", nextFilter)
    params.delete("page")
    const next = params.toString()
    router.replace(
      next ? `/manager/invitations?${next}` : "/manager/invitations",
      { scroll: false }
    )
  }

  const filtered = invitations

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* Top Header & Action */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Team & Client Invitations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate one-time invite tokens for studio photographers, editors,
            and clients.
          </p>
        </div>
        {canManage ? <CreateInvitationDialog /> : null}
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">
            Total Dispatched
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
            {stats.total}
          </p>
        </div>
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 shadow-xs">
          <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
            Pending Acceptance
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-amber-700 dark:text-amber-300">
            {stats.pendingCount}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4 shadow-xs">
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
            Accepted
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-emerald-700 dark:text-emerald-300">
            {stats.acceptedCount}
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4 shadow-xs">
          <p className="text-xs font-medium text-muted-foreground">Expired</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-muted-foreground">
            {stats.expiredCount}
          </p>
        </div>
      </div>

      {/* Search and Filter Row */}
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
        <div className="relative w-full sm:max-w-sm sm:flex-1">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Search invitations by email or recipient"
            placeholder="Search email or recipient..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 rounded-lg pl-9 text-sm"
          />
        </div>
        <div className="flex w-full min-w-0 items-center gap-2 overflow-x-auto overscroll-x-contain scrollbar-none sm:w-auto sm:max-w-full">
          {[
            { id: "ALL", label: "All" },
            { id: "PENDING", label: `Pending (${stats.pendingCount})` },
            { id: "ACCEPTED", label: `Accepted (${stats.acceptedCount})` },
            { id: "WORKER", label: "Workers" },
            { id: "CLIENT", label: "Clients" },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              aria-pressed={selectedFilter === pill.id}
              onClick={() => updateFilter(pill.id)}
              className={`min-h-9 shrink-0 whitespace-nowrap rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${
                selectedFilter === pill.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* High-Density Roster Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-xs">
        <Table containerClassName="overflow-x-auto">
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              <TableHead className="h-11 min-w-64 px-4 text-[11px] tracking-wide uppercase sm:px-6">
                Invitee
              </TableHead>
              <TableHead className="min-w-28 text-[11px] tracking-wide uppercase">
                Role
              </TableHead>
              <TableHead className="min-w-32 text-[11px] tracking-wide uppercase">
                Status
              </TableHead>
              <TableHead className="min-w-44 text-[11px] tracking-wide uppercase">
                Link expiry / accepted
              </TableHead>
              <TableHead className="w-32 px-3 text-right text-[11px] tracking-wide uppercase sm:px-4">
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="h-28 text-center text-sm text-muted-foreground"
                >
                  {searchQuery || selectedFilter !== "ALL"
                    ? "No invitations match these filters."
                    : "No invitations yet."}
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((invitation) => {
                const isUnused =
                  !invitation.usedAt &&
                  (invitation.status === InvitationStatus.PENDING ||
                    invitation.status === InvitationStatus.ACCEPTED)
                const isExpired =
                  isUnused && new Date(invitation.expiresAt) <= now
                const isPending = isUnused && !isExpired
                const isRevoked = invitation.status === InvitationStatus.REVOKED
                const isAccepted = !isRevoked && Boolean(
                  invitation.usedAt || invitation.acceptedAt
                )

                const displayName =
                  invitation.acceptedUser?.name || invitation.email
                const initials = (displayName || "?")
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase()

                const avatarSrc = invitation.acceptedUser?.image
                  ? getProfileImageSrc(
                      invitation.acceptedUser.image,
                      invitation.acceptedUser.id
                    )
                  : undefined

                return (
                  <TableRow key={invitation.id} className="hover:bg-muted/30">
                    {/* Invitee */}
                    <TableCell className="px-4 py-3.5 sm:px-6">
                      <div className="flex items-center gap-3">
                        <Avatar size="sm" className="ring-1 ring-border">
                          {avatarSrc ? (
                            <AvatarImage src={avatarSrc} alt={displayName} />
                          ) : null}
                          <AvatarFallback className="text-[11px] font-bold">
                            {initials}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {invitation.acceptedUser?.name || invitation.email}
                          </p>
                          {invitation.acceptedUser?.name ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {invitation.email}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>

                    {/* Role */}
                    <TableCell className="py-3.5">
                      <Badge
                        variant="secondary"
                        className={`rounded-full border text-xs font-medium capitalize ${
                          invitation.role === UserRole.WORKER
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        }`}
                      >
                        {invitation.role === UserRole.WORKER ? (
                          <Briefcase className="mr-1 inline size-3" />
                        ) : (
                          <Shield className="mr-1 inline size-3" />
                        )}
                        {invitation.role.toLowerCase()}
                      </Badge>
                    </TableCell>

                    {/* Status */}
                    <TableCell className="py-3.5">
                      {isPending && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                          <span className="size-1.5 animate-pulse rounded-full bg-amber-500" />
                          Pending
                        </span>
                      )}
                      {isAccepted && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                          Accepted
                        </span>
                      )}
                      {isExpired && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                          <XCircle className="size-3" />
                          Expired
                        </span>
                      )}
                      {isRevoked && (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive">
                          <Ban className="size-3" />
                          Revoked
                        </span>
                      )}
                    </TableCell>

                    {/* Date / Expiry */}
                    <TableCell className="py-3.5 text-xs text-muted-foreground">
                      {isAccepted ? (
                        <span className="font-medium text-emerald-600 dark:text-emerald-400">
                          Joined{" "}
                          {new Date(
                            invitation.acceptedAt ||
                              invitation.usedAt ||
                              invitation.createdAt
                          ).toLocaleDateString()}
                        </span>
                      ) : (
                        <span>
                          {isExpired ? "Expired" : "Expires"}{" "}
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                    </TableCell>

                    {/* Actions */}
                    <TableCell className="px-3 py-3.5 text-right sm:px-4">
                      {isAccepted && Boolean(invitation.usedAt && invitation.acceptedUser) && ((canManage && (invitation.role === UserRole.WORKER || invitation.role === UserRole.CLIENT)) || (canRevokeManagementMembers && (invitation.role === UserRole.SUPERVISOR || invitation.role === UserRole.COLLABORATOR))) ? (
                        <RevokeStudioAccountButton
                          id={invitation.id}
                          role={invitation.role === UserRole.WORKER ? "Worker" : invitation.role === UserRole.CLIENT ? "Client" : invitation.role === UserRole.SUPERVISOR ? "Supervisor" : "Collaborator"}
                          name={displayName}
                        />
                      ) : isPending || (!isAccepted && !isRevoked) || (isAccepted && !invitation.usedAt) ? (
                        <InvitationTableActions
                          id={invitation.id}
                          email={invitation.email}
                          recoverable={Boolean(invitation.tokenEncrypted)}
                          canManageLink={canManage && isPending}
                          canRevoke={canManage && !isAccepted && !isRevoked}
                        />
                      ) : null}
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>

        {/* Pagination Footer */}
        <div className="px-4 pb-4 sm:px-6">
          <Pagination
            pathname="/manager/invitations"
            searchParams={searchParams}
            page={page}
            totalPages={totalPages}
            totalItems={totalItems}
          />
        </div>
      </div>
    </div>
  )
}
