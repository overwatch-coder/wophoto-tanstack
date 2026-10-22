import { auth } from "@/auth";
import { WorkspaceShellLoading } from "@/components/workspace/workspace-shell-loading";
import { getWorkspaceHome, isWorkspaceRole } from "@/lib/navigation";
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
  const session = await auth();

  if (!session?.user?.id) redirect("/login");
  if (!isWorkspaceRole(session.user.role)) redirect("/forbidden");

  redirect(getWorkspaceHome(session.user.role));
}
