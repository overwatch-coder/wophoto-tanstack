import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  InvitationStatus,
  StudioAccessLevel,
  StudioArea,
  UserRole,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireStudioArea, hasStudioAccess } from "@/lib/studio-access";
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination";
import { parseInvitationQuery } from "@/lib/validation/queries";
import {
  InvitationsView,
  type InvitationStats,
} from "@/components/invitations/invitations-view";
import { StudioAccessPanel } from "@/components/invitations/studio-access-panel";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerInvitationsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const { user: actor, context } = await requireStudioArea(StudioArea.TEAM);
    const manager = { ...actor, id: context.ownerUserId };
    const isOwner = context.isOwner;
    const canManageTeam = hasStudioAccess(
      context,
      StudioArea.TEAM,
      StudioAccessLevel.MANAGE
    );
    const filters = parseInvitationQuery(params);
    const query = filters.query;
    const now = new Date();
    const filter = filters.filter;

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
    };

    const [total, matchingTotal, pendingCount, acceptedCount, expiredCount, studioMembers] =
      await Promise.all([
        prisma.invitation.count({
          where: { invitedById: manager.id, studioId: context.studioId },
        }),
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
          where: {
            studioId: context.studioId,
            revokedAt: null,
            user: { role: { in: [UserRole.SUPERVISOR, UserRole.COLLABORATOR] } },
          },
          select: {
            id: true,
            user: { select: { name: true, email: true, role: true } },
            permissions: { select: { area: true, accessLevel: true } },
          },
          orderBy: { createdAt: "desc" },
        }),
      ]);

    const totalPages = getPageCount(matchingTotal);
    const page = Math.min(filters.page, totalPages);

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
    });

    const stats: InvitationStats = {
      total,
      pendingCount,
      acceptedCount,
      expiredCount,
    };

    return {
      isOwner,
      studioMembers: studioMembers.map((member) => ({
        id: member.id,
        role: member.user.role,
        name: member.user.name,
        email: member.user.email,
        permissions: member.permissions,
      })),
      invitations,
      stats,
      page,
      totalPages,
      totalItems: matchingTotal,
      searchParams: params,
      searchQuery: query,
      selectedFilter: filter,
      canManage: canManageTeam,
    };
  });

export const Route = createFileRoute("/_workspace/manager/invitations")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerInvitationsData({ data: deps }),
  head: () => ({
    meta: [{ title: "Team Invitations | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="invitations" label="Loading team invitations" />,
  component: ManagerInvitationsRouteComponent,
});

function ManagerInvitationsRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {data.isOwner ? <StudioAccessPanel members={data.studioMembers} /> : null}
      <InvitationsView
        invitations={data.invitations}
        stats={data.stats}
        page={data.page}
        totalPages={data.totalPages}
        totalItems={data.totalItems}
        searchParams={data.searchParams}
        searchQuery={data.searchQuery}
        selectedFilter={data.selectedFilter}
        canManage={data.canManage}
        canRevokeManagementMembers={data.isOwner}
      />
    </div>
  );
}

