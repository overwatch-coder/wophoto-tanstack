import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { requireUser } from "@/lib/authz";
import { isDemoAccessEnabled, isDemoUserId } from "@/lib/demo";
import { isWorkspaceRole } from "@/lib/navigation";
import { getStudioAccessContext } from "@/lib/studio-access";
import { getCookie } from "@tanstack/react-start/server";
import { getWorkspacePreferences, getUserPreferences } from "@/lib/user-preferences";
import { getNotifications, getUnreadNotificationCounts } from "@/lib/notifications";
import { isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspacePreferencesHydrator } from "@/components/workspace/workspace-preferences-hydrator";
import { WorkspaceNotificationBell } from "@/components/workspace/workspace-notification-bell";
import { StudioCopilot } from "@/components/ai/studio-copilot";
import { SettingsDensity, UserRole } from "@/generated/prisma/client";

const getWorkspaceShellData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  if (!isWorkspaceRole(user.role)) {
    throw redirect({ href: "/forbidden" });
  }

  const studioAccess = await getStudioAccessContext(user.id, user.role);

  if ((user.role === UserRole.SUPERVISOR || user.role === UserRole.COLLABORATOR) && !studioAccess) {
    throw redirect({ href: "/forbidden" });
  }

  let defaultSidebarOpen = true;
  try {
    defaultSidebarOpen = getCookie("sidebar_state") !== "false";
  } catch {
    // outside server context
  }

  const [preferences, notifications, unreadCounts, copilotEnabled, userPref] = await Promise.all([
    getWorkspacePreferences(user.id),
    getNotifications(user.id),
    getUnreadNotificationCounts(user.id),
    isCopilotEnabledForUser(user.id, user.role, studioAccess),
    getUserPreferences(user.id, user.role),
  ]);

  return {
    user,
    studioAccess,
    defaultSidebarOpen,
    preferences,
    notifications,
    unreadCounts,
    copilot: {
      enabled: copilotEnabled,
      copilotName: userPref.aiPreferences.aiCopilotName,
    },
    isDemoSession: isDemoAccessEnabled() && isDemoUserId(user.id),
  };
});

export const Route = createFileRoute("/_workspace")({
  loader: () => getWorkspaceShellData(),
  component: WorkspaceLayoutComponent,
});

function WorkspaceLayoutComponent() {
  const data = Route.useLoaderData();

  return (
    <WorkspaceShell
      role={data.user.role}
      allowedAreas={data.studioAccess?.isOwner ? null : Object.keys(data.studioAccess?.grants ?? {})}
      userId={data.user.id}
      name={data.user.name}
      email={data.user.email}
      image={data.user.image}
      defaultSidebarOpen={data.defaultSidebarOpen}
      notificationBell={
        <WorkspaceNotificationBell
          role={data.user.role}
          initialNotifications={data.notifications}
          initialUnreadCount={data.unreadCounts.unread}
          initialUnreadActionCount={data.unreadCounts.actionRequired}
          initialUnreadUpdateCount={data.unreadCounts.updates}
        />
      }
      copilotSlot={
        data.copilot.enabled ? (
          <StudioCopilot copilotName={data.copilot.copilotName} />
        ) : null
      }
      preferencesSlot={
        <WorkspacePreferencesHydrator
          density={data.preferences.density}
          soundAlerts={data.preferences.soundAlerts}
        />
      }
      density={SettingsDensity.COZY}
      soundAlerts={false}
      isDemoSession={data.isDemoSession}
    >
      <Outlet />
    </WorkspaceShell>
  );
}
