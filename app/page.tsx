import { auth } from "@/auth";
import { connection } from "next/server";
import { WorkspaceShellLoading } from "@/components/workspace/workspace-shell-loading";
import { getWorkspaceHome, isWorkspaceRole } from "@/lib/navigation";
import { getUserPreferences } from "@/lib/user-preferences";
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
  redirect(preferences.defaultLanding || getWorkspaceHome(session.user.role));
}
