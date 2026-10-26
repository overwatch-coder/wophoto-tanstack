import { auth } from "@/auth";
import { connection } from "next/server";
import { WorkspaceShellLoading } from "@/components/workspace/workspace-shell-loading";
import { getWorkspaceHome, isWorkspaceRole } from "@/lib/navigation";
import { getUserPreferences } from "@/lib/user-preferences";
import { getStudioAccessContext, getStudioMemberLandingPath } from "@/lib/studio-access";
import { UserRole } from "@/generated/prisma/client";
import { redirect } from "next/navigation";
import { Suspense } from "react";

export default function HomePage() {
  return (
    <Suspense fallback={<WorkspaceShellLoading />}>
      <RoleLanding />
    </Suspense>
  );
}

async function RoleLanding(): Promise<never> {
  await connection();
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (!isWorkspaceRole(session.user.role)) redirect("/forbidden");

  const preferences = await getUserPreferences(session.user.id, session.user.role);
  const preferredLanding = preferences.defaultLanding || getWorkspaceHome(session.user.role);

  if (session.user.role === UserRole.SUPERVISOR || session.user.role === UserRole.COLLABORATOR) {
    const context = await getStudioAccessContext(session.user.id, session.user.role);
    if (!context) redirect("/forbidden");
    redirect(getStudioMemberLandingPath(context, preferredLanding));
  }

  redirect(preferredLanding);
}
