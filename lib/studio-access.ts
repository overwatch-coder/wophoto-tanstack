import "server-only";

import { redirect } from "next/navigation";

import { StudioAccessLevel, StudioArea, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const SUPERVISOR_ACCESS: Partial<Record<StudioArea, StudioAccessLevel>> = {
  [StudioArea.DASHBOARD]: StudioAccessLevel.VIEW,
  [StudioArea.PROJECTS]: StudioAccessLevel.MANAGE,
  [StudioArea.TASKS]: StudioAccessLevel.MANAGE,
  [StudioArea.SCHEDULE]: StudioAccessLevel.MANAGE,
  [StudioArea.BRIEFS]: StudioAccessLevel.MANAGE,
  [StudioArea.REVIEWS]: StudioAccessLevel.MANAGE,
  [StudioArea.WORK_REQUESTS]: StudioAccessLevel.MANAGE,
  [StudioArea.BRAND_ASSETS]: StudioAccessLevel.MANAGE,
  [StudioArea.INVENTORY]: StudioAccessLevel.MANAGE,
};

export type StudioAccessContext = {
  studioId: string;
  ownerUserId: string;
  isOwner: boolean;
  memberId: string | null;
  role: UserRole;
  grants: Partial<Record<StudioArea, StudioAccessLevel>>;
};

export async function getStudioAccessContext(
  userId: string,
  role: UserRole,
): Promise<StudioAccessContext | null> {
  if (role === UserRole.MANAGER) {
    const studio = await prisma.studio.findUnique({
      where: { ownerUserId: userId },
      select: { id: true, ownerUserId: true },
    });
    if (!studio) return null;
    return {
      studioId: studio.id,
      ownerUserId: studio.ownerUserId,
      isOwner: true,
      memberId: null,
      role,
      grants: {},
    };
  }

  if (role !== UserRole.SUPERVISOR && role !== UserRole.COLLABORATOR) return null;

  const membership = await prisma.studioMember.findFirst({
    where: { userId, revokedAt: null },
    select: {
      id: true,
      studio: { select: { id: true, ownerUserId: true } },
      permissions: { select: { area: true, accessLevel: true } },
    },
  });
  if (!membership) return null;

  const grants: Partial<Record<StudioArea, StudioAccessLevel>> =
    role === UserRole.SUPERVISOR
      ? { ...SUPERVISOR_ACCESS }
      : Object.fromEntries(membership.permissions.map(({ area, accessLevel }) => [area, accessLevel]));

  return {
    studioId: membership.studio.id,
    ownerUserId: membership.studio.ownerUserId,
    isOwner: false,
    memberId: membership.id,
    role,
    grants,
  };
}

export function hasStudioAccess(
  context: StudioAccessContext,
  area: StudioArea,
  required: StudioAccessLevel = StudioAccessLevel.VIEW,
) {
  if (context.isOwner) return true;
  const level = context.grants[area];
  return level === StudioAccessLevel.MANAGE || (required === StudioAccessLevel.VIEW && level === StudioAccessLevel.VIEW);
}

const STUDIO_MEMBER_LANDING_OPTIONS: Array<{ area: StudioArea; path: string }> = [
  { area: StudioArea.DASHBOARD, path: "/manager" },
  { area: StudioArea.PROJECTS, path: "/manager/projects" },
  { area: StudioArea.TASKS, path: "/manager/tasks" },
  { area: StudioArea.SCHEDULE, path: "/manager/schedule" },
  { area: StudioArea.BRIEFS, path: "/manager/brief-review" },
  { area: StudioArea.REVIEWS, path: "/manager/reviews" },
  { area: StudioArea.WORK_REQUESTS, path: "/manager/work-requests" },
  { area: StudioArea.BRAND_ASSETS, path: "/manager/brand-assets" },
  { area: StudioArea.INVENTORY, path: "/manager/inventory" },
  { area: StudioArea.DELETED_TASKS, path: "/manager/deleted-tasks" },
  { area: StudioArea.TEAM, path: "/manager/invitations" },
];

export function getStudioMemberLandingPath(context: StudioAccessContext, preferredPath?: string | null) {
  if (preferredPath === "/settings") return "/settings";

  const preferred = STUDIO_MEMBER_LANDING_OPTIONS.find((option) => option.path === preferredPath);
  if (preferred && hasStudioAccess(context, preferred.area)) return preferred.path;

  return STUDIO_MEMBER_LANDING_OPTIONS.find((option) => hasStudioAccess(context, option.area))?.path ?? "/settings";
}

export async function requireStudioArea(
  area: StudioArea,
  required: StudioAccessLevel = StudioAccessLevel.VIEW,
) {
  const { requireRole } = await import("@/lib/authz");
  const user = await requireRole(UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR);
  const context = await getStudioAccessContext(user.id, user.role);
  if (!context || !hasStudioAccess(context, area, required)) redirect("/forbidden");
  return { user, context };
}

export async function requireStudioManagerArea(
  area: StudioArea,
  required: StudioAccessLevel = StudioAccessLevel.MANAGE,
) {
  const { user, context } = await requireStudioArea(area, required);
  return {
    manager: { ...user, id: context.ownerUserId, actorId: user.id },
    actor: user,
    context,
  };
}

export async function requireStudioOwner() {
  const { requireUser } = await import("@/lib/authz");
  const user = await requireUser();
  if (user.role !== UserRole.MANAGER) redirect("/forbidden");
  const context = await getStudioAccessContext(user.id, user.role);
  if (!context?.isOwner) redirect("/forbidden");
  return { user, context };
}
