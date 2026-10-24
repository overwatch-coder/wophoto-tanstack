import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getNotificationCounts, getNotificationPage } from "@/lib/notifications";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const instant = false;

export default function WorkerNotificationsPage() {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="basic" label="Loading notifications" />}
    >
      <WorkerNotificationsContent />
    </Suspense>
  );
}

async function WorkerNotificationsContent() {
  await connection();
  const worker = await requireRole(UserRole.WORKER);
  const [page, counts] = await Promise.all([
    getNotificationPage(worker.id),
    getNotificationCounts(worker.id),
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
