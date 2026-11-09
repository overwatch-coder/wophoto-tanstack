
import { HeaderNotificationBell } from "@/components/workspace/header-notification-bell";
import { useWorkspacePreferences } from "@/components/workspace/workspace-preferences-context";
import type { NotificationItemView } from "@/lib/notifications";
import type { WorkspaceRole } from "@/lib/navigation";

export function WorkspaceNotificationBell({
  role,
  initialNotifications,
  initialUnreadCount,
  initialUnreadActionCount,
  initialUnreadUpdateCount,
}: {
  role: WorkspaceRole;
  initialNotifications: NotificationItemView[];
  initialUnreadCount: number;
  initialUnreadActionCount: number;
  initialUnreadUpdateCount: number;
}) {
  const { soundAlerts } = useWorkspacePreferences();

  return (
    <HeaderNotificationBell
      role={role}
      initialNotifications={initialNotifications}
      initialUnreadCount={initialUnreadCount}
      initialUnreadActionCount={initialUnreadActionCount}
      initialUnreadUpdateCount={initialUnreadUpdateCount}
      soundAlerts={soundAlerts}
    />
  );
}
