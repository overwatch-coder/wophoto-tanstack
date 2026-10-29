import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { requireUser } from "@/lib/authz";
import { isWorkspaceRole } from "@/lib/navigation";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { WorkspaceShellLoading } from "@/components/workspace/workspace-shell-loading";
import { getStudioAccessContext } from "@/lib/studio-access";
import {
  WorkspaceCopilotSlot,
  WorkspaceNotificationSlot,
  WorkspacePreferencesSlot,
} from "@/components/workspace/workspace-shell-async";
import { SettingsDensity, UserRole } from "@/generated/prisma/client";

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

  const [studioAccess, cookieStore] = await Promise.all([
    getStudioAccessContext(user.id, user.role),
    cookies(),
  ]);
  if ((user.role === UserRole.SUPERVISOR || user.role === UserRole.COLLABORATOR) && !studioAccess) {
    redirect("/forbidden");
  }
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
      notificationBell={
        <WorkspaceNotificationSlot
          role={user.role}
          userId={user.id}
        />
      }
      copilotSlot={
        <WorkspaceCopilotSlot
          role={user.role}
          studioAccess={studioAccess}
          userId={user.id}
        />
      }
      preferencesSlot={<WorkspacePreferencesSlot userId={user.id} />}
      density={SettingsDensity.COZY}
      soundAlerts={false}
    >
      {children}
    </WorkspaceShell>
  );
}
