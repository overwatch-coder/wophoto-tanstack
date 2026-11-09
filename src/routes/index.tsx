import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { auth } from "@/auth";
import { isWorkspaceRole, getWorkspaceHome } from "@/lib/navigation";
import { getUserPreferences } from "@/lib/user-preferences";
import { getStudioAccessContext, getStudioMemberLandingPath } from "@/lib/studio-access";
import { UserRole } from "@/generated/prisma/client";

const resolveHomeLanding = createServerFn({ method: "GET" }).handler(async () => {
  const session = await auth();

  if (!session?.user?.id) {
    throw redirect({ href: "/login" });
  }

  if (!isWorkspaceRole(session.user.role)) {
    throw redirect({ href: "/forbidden" });
  }

  const preferences = await getUserPreferences(session.user.id, session.user.role);
  const preferredLanding = preferences.defaultLanding || getWorkspaceHome(session.user.role);

  if (session.user.role === UserRole.SUPERVISOR || session.user.role === UserRole.COLLABORATOR) {
    const context = await getStudioAccessContext(session.user.id, session.user.role);
    if (!context) throw redirect({ href: "/forbidden" });
    throw redirect({ href: getStudioMemberLandingPath(context, preferredLanding) });
  }

  throw redirect({ href: preferredLanding });
});

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    await resolveHomeLanding();
  },
  component: () => null,
});
