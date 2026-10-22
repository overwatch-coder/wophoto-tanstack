import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { requireUser } from "@/lib/authz";
import { isWorkspaceRole } from "@/lib/navigation";
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
  const user = await requireUser();
  if (!isWorkspaceRole(user.role)) redirect("/forbidden");

  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <WorkspaceShell
      role={user.role}
      name={user.name}
      email={user.email}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </WorkspaceShell>
  );
}
