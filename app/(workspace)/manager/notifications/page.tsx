import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireUser } from "@/lib/authz";
import { getStudioAccessContext } from "@/lib/studio-access";
import { redirect } from "next/navigation";
import { getNotificationCounts, getNotificationPage } from "@/lib/notifications";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

// This route requires a request session, so its auth redirect is not expected
// to pass Next's anonymous instant-navigation validation.
export const instant = false;

export default function ManagerNotificationsPage() {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="basic" label="Loading notifications" />}
    >
      <ManagerNotificationsContent />
    </Suspense>
  );
}

async function ManagerNotificationsContent() {
  await connection();
  const manager = await requireUser();
  const managerSideRoles: UserRole[] = [UserRole.MANAGER, UserRole.SUPERVISOR, UserRole.COLLABORATOR];
  if (!managerSideRoles.includes(manager.role)) redirect("/forbidden");
  const context = await getStudioAccessContext(manager.id, manager.role);
  if (!context) redirect("/forbidden");
  const [page, counts] = await Promise.all([
    getNotificationPage(manager.id),
    getNotificationCounts(manager.id),
  ]);
  return (
    <NotificationsWorkspace
      initialNotifications={page.items}
      initialHasMore={page.hasMore}
      initialCursor={page.nextCursor}
      initialCounts={counts}
    />
  );
}
