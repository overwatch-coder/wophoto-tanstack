import { InvitationStatus, StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client"
import { Suspense } from "react"
import { prisma } from "@/lib/prisma"
import { requireStudioArea } from "@/lib/studio-access"
import { hasStudioAccess } from "@/lib/studio-access"
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination"
import { parseInvitationQuery } from "@/lib/validation/queries"
import {
  InvitationsView,
  type InvitationStats,
} from "@/components/invitations/invitations-view"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"
import { StudioAccessPanel } from "@/components/invitations/studio-access-panel"

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
  const { user: actor, context } = await requireStudioArea(StudioArea.TEAM)
  const manager = { ...actor, id: context.ownerUserId }
  const isOwner = context.isOwner
  const canManageTeam = hasStudioAccess(context, StudioArea.TEAM, StudioAccessLevel.MANAGE)
  const params = await searchParams
  const filters = parseInvitationQuery(params)
  const query = filters.query
  const now = new Date()
  const filter = filters.filter

  const invitationWhere = {
    invitedById: manager.id,
    studioId: context.studioId,
    ...(filter === "PENDING"
      ? {
          usedAt: null,
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
          expiresAt: { gt: now },
        }
      : {}),
    ...(filter === "ACCEPTED"
      ? { status: InvitationStatus.USED, usedAt: { not: null } }
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

  const [total, matchingTotal, pendingCount, acceptedCount, expiredCount, studioMembers] =
    await Promise.all([
      prisma.invitation.count({ where: { invitedById: manager.id, studioId: context.studioId } }),
      prisma.invitation.count({ where: invitationWhere }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          studioId: context.studioId,
          usedAt: null,
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
          expiresAt: { gt: now },
        },
      }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          studioId: context.studioId,
          status: InvitationStatus.USED,
          usedAt: { not: null },
        },
      }),
      prisma.invitation.count({
        where: {
          invitedById: manager.id,
          studioId: context.studioId,
          usedAt: null,
          expiresAt: { lte: now },
          status: { in: [InvitationStatus.PENDING, InvitationStatus.ACCEPTED] },
        },
      }),
      prisma.studioMember.findMany({
        where: { studioId: context.studioId, revokedAt: null, user: { role: { in: [UserRole.SUPERVISOR, UserRole.COLLABORATOR] } } },
        select: { id: true, user: { select: { name: true, email: true, role: true } }, permissions: { select: { area: true, accessLevel: true } } },
        orderBy: { createdAt: "desc" },
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
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {isOwner ? <StudioAccessPanel members={studioMembers.map((member) => ({ id: member.id, role: member.user.role, name: member.user.name, email: member.user.email, permissions: member.permissions }))} /> : null}
    <InvitationsView
      invitations={invitations}
      stats={stats}
      page={page}
      totalPages={totalPages}
      totalItems={matchingTotal}
      searchParams={params}
      searchQuery={query}
      selectedFilter={filter}
      canManage={canManageTeam}
      canRevokeManagementMembers={isOwner}
    />
    </div>
  )
}
