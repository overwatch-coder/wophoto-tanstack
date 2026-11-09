import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { requireUser } from "@/lib/authz";
import { getUserPreferences } from "@/lib/user-preferences";
import { getCopilotStudioSettings } from "@/lib/ai/copilot-access";
import { UserRole } from "@/generated/prisma/client";

const getSettingsData = createServerFn({ method: "GET" }).handler(async () => {
  const user = await requireUser();
  const [preferences, studioCopilotSettings] = await Promise.all([
    getUserPreferences(user.id, user.role),
    user.role === UserRole.MANAGER
      ? getCopilotStudioSettings(user.id)
      : Promise.resolve(undefined),
  ]);

  return {
    user,
    preferences,
    studioCopilotSettings,
  };
});

export const Route = createFileRoute("/_workspace/settings")({
  loader: () => getSettingsData(),
  head: () => ({
    meta: [{ title: "Settings | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading settings" />,
  component: SettingsRouteComponent,
});

function SettingsRouteComponent() {
  const { user, preferences, studioCopilotSettings } = Route.useLoaderData();

  return (
    <ProfileSettings
      name={user.name ?? null}
      email={user.email ?? ""}
      image={user.image ?? null}
      userId={user.id}
      role={user.role}
      preferences={preferences}
      studioCopilotSettings={studioCopilotSettings}
    />
  );
}

