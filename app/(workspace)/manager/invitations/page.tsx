import { InvitationStatus, UserRole } from "@/generated/prisma/client"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/authz"
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination"
import { parseInvitationQuery } from "@/lib/validation/queries"
import {
  InvitationsView,
  type InvitationStats,
} from "@/components/invitations/invitations-view"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export default function ManagerInvitationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="invitations"
          label="Loading invitations"
        />
      }
    >
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
  const filters = parseInvitationQuery(params)
  const query = filters.query
  const now = new Date()
  const filter = filters.filter

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
  const page = Math.min(filters.page, totalPages)

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
