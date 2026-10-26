import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireUser } from "@/lib/authz";
import { isWorkspaceRole } from "@/lib/navigation";
import { getNotifications, getUnreadNotificationCounts } from "@/lib/notifications";
import { getUserPreferences } from "@/lib/user-preferences";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceShellLoading } from "@/components/workspace/workspace-shell-loading";
import { isCopilotEnabledForUser } from "@/lib/ai/copilot-access";
import { getStudioAccessContext } from "@/lib/studio-access";
import { UserRole } from "@/generated/prisma/client";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<WorkspaceShellLoading />}>
      <AuthenticatedWorkspace>{children}</AuthenticatedWorkspace>
    </Suspense>
  );
}

async function AuthenticatedWorkspace({ children }: { children: React.ReactNode }) {
  // NextAuth uses crypto.getRandomValues() while resolving a session. Ensure
  // that request-specific work starts after prerendering has stopped.
  await connection();

  const user = await requireUser();
  if (!isWorkspaceRole(user.role)) redirect("/forbidden");

  const studioAccess = await getStudioAccessContext(user.id, user.role);
  if ((user.role === UserRole.SUPERVISOR || user.role === UserRole.COLLABORATOR) && !studioAccess) {
    redirect("/forbidden");
  }

  const [cookieStore, initialNotifications, initialUnreadCounts, preferences, copilotEnabled] = await Promise.all([
    cookies(),
    getNotifications(user.id),
    getUnreadNotificationCounts(user.id),
    getUserPreferences(user.id, user.role),
    isCopilotEnabledForUser(user.id, user.role),
  ]);
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <WorkspaceShell
      role={user.role}
      allowedAreas={studioAccess?.isOwner ? null : Object.keys(studioAccess?.grants ?? {})}
      userId={user.id}
      name={user.name}
      email={user.email}
      image={user.image}
      defaultSidebarOpen={defaultSidebarOpen}
      initialNotifications={initialNotifications}
      initialUnreadCount={initialUnreadCounts.unread}
      initialUnreadActionCount={initialUnreadCounts.actionRequired}
      initialUnreadUpdateCount={initialUnreadCounts.updates}
      density={preferences.density}
      soundAlerts={preferences.soundAlerts}
      copilotName={preferences.aiPreferences.aiCopilotName}
      copilotEnabled={copilotEnabled}
    >
      {children}
    </WorkspaceShell>
  );
}
