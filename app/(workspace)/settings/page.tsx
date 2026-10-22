import { Suspense } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { requireUser } from "@/lib/authz";

export default function SettingsPage() {
  return (
    <Suspense fallback={<SettingsLoading />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const user = await requireUser();

  return (
    <ProfileSettings
      name={user.name ?? null}
      email={user.email ?? ""}
      image={user.image ?? null}
      userId={user.id}
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
