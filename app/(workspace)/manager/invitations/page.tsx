import { InvitationStatus, UserRole } from "@/generated/prisma/client"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/authz"
import { DEFAULT_PAGE_SIZE, getPageCount, parsePage } from "@/lib/pagination"
import {
  InvitationsView,
  type InvitationStats,
} from "@/components/invitations/invitations-view"

export default function ManagerInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense fallback={<main className="min-h-svh bg-background" />}>
      <ManagerInvitationsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerInvitationsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const manager = await requireRole(UserRole.MANAGER)
  const params = await searchParams
  const query =
    (Array.isArray(params.q) ? params.q[0] : params.q)?.trim().slice(0, 120) ??
    ""
  const now = new Date()
  const rawFilter = Array.isArray(params.filter)
    ? params.filter[0]
    : params.filter
  const filter = ["PENDING", "ACCEPTED", "WORKER", "CLIENT"].includes(
    rawFilter ?? ""
  )
    ? rawFilter!
    : "ALL"

  const invitationWhere = {
    invitedById: manager.id,
    ...(filter === "PENDING"
      ? {
          usedAt: null,
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
          expiresAt: { gt: now },
        }
      : {}),
    ...(filter === "ACCEPTED"
      ? { OR: [{ usedAt: { not: null } }, { acceptedAt: { not: null } }] }
      : {}),
    ...(filter === "WORKER" ? { role: UserRole.WORKER } : {}),
    ...(filter === "CLIENT" ? { role: UserRole.CLIENT } : {}),
    ...(query
      ? {
          AND: [
            {
              OR: [
                { email: { contains: query, mode: "insensitive" as const } },
                {
                  acceptedUser: {
                    is: {
                      name: { contains: query, mode: "insensitive" as const },
                    },
                  },
                },
              ],
            },
          ],
        }
      : {}),
  }

  const [total, matchingTotal, pendingCount, acceptedCount, expiredCount] =
    await Promise.all([
      prisma.invitation.count({ where: { invitedById: manager.id } }),
      prisma.invitation.count({ where: invitationWhere }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          usedAt: null,
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
          expiresAt: { gt: now },
        },
      }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          OR: [{ usedAt: { not: null } }, { acceptedAt: { not: null } }],
        },
      }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          usedAt: null,
          expiresAt: { lte: now },
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
        },
      }),
    ])

  const totalPages = getPageCount(matchingTotal)
  const page = Math.min(parsePage(params.page), totalPages)

  const invitations = await prisma.invitation.findMany({
    where: invitationWhere,
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      expiresAt: true,
      usedAt: true,
      acceptedAt: true,
      createdAt: true,
      tokenEncrypted: true,
      acceptedUser: {
        select: {
          id: true,
          name: true,
          image: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: DEFAULT_PAGE_SIZE,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
  })

  const stats: InvitationStats = {
    total,
    pendingCount,
    acceptedCount,
    expiredCount,
  }

  return (
    <InvitationsView
      invitations={invitations}
      stats={stats}
      page={page}
      totalPages={totalPages}
      totalItems={matchingTotal}
      searchParams={params}
      searchQuery={query}
      selectedFilter={filter}
    />
  )
}
