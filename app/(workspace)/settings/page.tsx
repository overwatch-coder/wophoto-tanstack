import { Suspense } from "react";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { requireUser } from "@/lib/authz";
import { getUserPreferences } from "@/lib/user-preferences";
import { getCopilotStudioSettings } from "@/lib/ai/copilot-access";
import { UserRole } from "@/generated/prisma/client";
import { DelayedLoadingFallback } from "@/components/workspace/delayed-loading-fallback";

export default function SettingsPage() {
  return (
    <Suspense fallback={<DelayedLoadingFallback><SettingsLoading /></DelayedLoadingFallback>}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  // Authentication resolves a session using crypto values that must be read
  // only after Next has moved this nested settings segment to request time.
  await connection();
  const user = await requireUser();
  const [preferences, studioCopilotSettings] = await Promise.all([
    getUserPreferences(user.id, user.role),
    user.role === UserRole.MANAGER
      ? getCopilotStudioSettings(user.id)
      : Promise.resolve(undefined),
  ]);

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

function SettingsLoading() {
  return (
    <div
      role="status"
      aria-label="Loading account settings"
      className="mx-auto w-full max-w-5xl space-y-7"
    >
      <span className="sr-only">Loading account settings</span>
      <div className="space-y-3 border-b pb-6" aria-hidden="true">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-5 w-3/5" />
      </div>
      <div className="space-y-3 border-b pb-7" aria-hidden="true">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="space-y-3 border-b pb-7" aria-hidden="true">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-11 w-full" />
      </div>
    </div>
  );
}
