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

  const [cookieStore, initialNotifications, initialUnreadCounts, preferences] = await Promise.all([
    cookies(),
    getNotifications(user.id),
    getUnreadNotificationCounts(user.id),
    getUserPreferences(user.id, user.role),
  ]);
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <WorkspaceShell
      role={user.role}
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
    >
      {children}
    </WorkspaceShell>
  );
}
