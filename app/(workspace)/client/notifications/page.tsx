import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getNotificationCounts, getNotificationPage } from "@/lib/notifications";
import { NotificationsWorkspace } from "@/components/notifications/notifications-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

export const instant = false;

export default function ClientNotificationsPage() {
  return (
    <Suspense
      fallback={<PageLoadingSkeleton variant="basic" label="Loading notifications" />}
    >
      <ClientNotificationsContent />
    </Suspense>
  );
}

async function ClientNotificationsContent() {
  await connection();
  const client = await requireRole(UserRole.CLIENT);
  const [page, counts] = await Promise.all([
    getNotificationPage(client.id),
    getNotificationCounts(client.id),
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
