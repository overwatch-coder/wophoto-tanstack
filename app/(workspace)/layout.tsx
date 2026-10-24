import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
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
  // NextAuth uses crypto.getRandomValues() while resolving a session. Ensure
  // that request-specific work starts after prerendering has stopped.
  await connection();

  const user = await requireUser();
  if (!isWorkspaceRole(user.role)) redirect("/forbidden");

  const cookieStore = await cookies();
  const defaultSidebarOpen = cookieStore.get("sidebar_state")?.value !== "false";

  return (
    <WorkspaceShell
      role={user.role}
      userId={user.id}
      name={user.name}
      email={user.email}
      image={user.image}
      defaultSidebarOpen={defaultSidebarOpen}
    >
      {children}
    </WorkspaceShell>
  );
}
