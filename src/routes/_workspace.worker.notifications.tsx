import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getNotificationCounts, getNotificationPage } from "@/lib/notifications";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerNotificationsData = createServerFn({ method: "GET" }).handler(async () => {
  const worker = await requireRole(UserRole.WORKER);
  const [page, counts] = await Promise.all([
    getNotificationPage(worker.id),
    getNotificationCounts(worker.id),
  ]);
  return { page, counts };
});

export const Route = createFileRoute("/_workspace/worker/notifications")({
  loader: () => getWorkerNotificationsData(),
  head: () => ({
    meta: [{ title: "Notifications | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading notifications" />,
  component: WorkerNotificationsRouteComponent,
});

function WorkerNotificationsRouteComponent() {
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

