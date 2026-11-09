import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireUser } from "@/lib/authz";
import { getStudioAccessContext } from "@/lib/studio-access";
import { getNotificationCounts, getNotificationPage } from "@/lib/notifications";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerNotificationsData = createServerFn({ method: "GET" }).handler(async () => {
  const manager = await requireUser();
  const managerSideRoles: UserRole[] = [
    UserRole.MANAGER,
    UserRole.SUPERVISOR,
    UserRole.COLLABORATOR,
  ];
  if (!managerSideRoles.includes(manager.role)) {
    throw redirect({ href: "/forbidden" });
  }
  const context = await getStudioAccessContext(manager.id, manager.role);
  if (!context) {
    throw redirect({ href: "/forbidden" });
  }
  const [page, counts] = await Promise.all([
    getNotificationPage(manager.id),
    getNotificationCounts(manager.id),
  ]);
  return { page, counts };
});

export const Route = createFileRoute("/_workspace/manager/notifications")({
  loader: () => getManagerNotificationsData(),
  head: () => ({
    meta: [{ title: "Notifications | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading notifications" />,
  component: ManagerNotificationsRouteComponent,
});

function ManagerNotificationsRouteComponent() {
  const { page, counts } = Route.useLoaderData();
  return (
    <NotificationsWorkspace
      initialNotifications={page.items}
      initialHasMore={page.hasMore}
      initialCursor={page.nextCursor}
      initialCounts={counts}
    />
  );
}

