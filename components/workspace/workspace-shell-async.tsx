import { Suspense } from "react";

import { WorkspaceNotificationBell } from "@/components/workspace/workspace-notification-bell";
import { StudioCopilot } from "@/components/ai/studio-copilot";
import { getNotifications, getUnreadNotificationCounts } from "@/lib/notifications";
import { isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import type { StudioAccessContext } from "@/lib/studio-access";
import type { WorkspaceRole } from "@/lib/navigation";
import { getUserPreferences, getWorkspacePreferences } from "@/lib/user-preferences";
import { WorkspacePreferencesHydrator } from "@/components/workspace/workspace-preferences-hydrator";

export function WorkspacePreferencesSlot({ userId }: { userId: string }) {
  return (
    <Suspense fallback={null}>
      <WorkspacePreferencesData userId={userId} />
    </Suspense>
  );
}

async function WorkspacePreferencesData({ userId }: { userId: string }) {
  const preferences = await getWorkspacePreferences(userId);
  return (
    <WorkspacePreferencesHydrator
      density={preferences.density}
      soundAlerts={preferences.soundAlerts}
    />
  );
}

export function WorkspaceNotificationSlot({
  role,
  userId,
}: {
  role: WorkspaceRole;
  userId: string;
}) {
  return (
    <Suspense fallback={<div aria-hidden="true" className="size-10 shrink-0" />}>
      <WorkspaceNotificationData role={role} userId={userId} />
    </Suspense>
  );
}

async function WorkspaceNotificationData({
  role,
  userId,
}: {
  role: WorkspaceRole;
  userId: string;
}) {
  const [notifications, unreadCounts] = await Promise.all([
    getNotifications(userId),
    getUnreadNotificationCounts(userId),
  ]);

  return (
    <WorkspaceNotificationBell
      role={role}
      initialNotifications={notifications}
      initialUnreadCount={unreadCounts.unread}
      initialUnreadActionCount={unreadCounts.actionRequired}
      initialUnreadUpdateCount={unreadCounts.updates}
    />
  );
}

export function WorkspaceCopilotSlot({
  role,
  studioAccess,
  userId,
}: {
  role: WorkspaceRole;
  studioAccess: StudioAccessContext | null;
  userId: string;
}) {
  return (
    <Suspense fallback={null}>
      <WorkspaceCopilotData role={role} studioAccess={studioAccess} userId={userId} />
    </Suspense>
  );
}

async function WorkspaceCopilotData({
  role,
  studioAccess,
  userId,
}: {
  role: WorkspaceRole;
  studioAccess: StudioAccessContext | null;
  userId: string;
}) {
  const [enabled, preference] = await Promise.all([
    isCopilotEnabledForUser(userId, role, studioAccess),
    getUserPreferences(userId, role),
  ]);

  if (!enabled) return null;

  return <StudioCopilot copilotName={preference.aiPreferences.aiCopilotName} />;
}
