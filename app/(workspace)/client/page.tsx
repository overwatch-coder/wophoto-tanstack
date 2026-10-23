import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getClientAnalytics } from "@/lib/analytics";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";

export default function ClientWorkspacePage() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]" />}>
      <ClientWorkspaceContent />
    </Suspense>
  );
}

async function ClientWorkspaceContent() {
  await requireRole(UserRole.CLIENT);
  const data = await getClientAnalytics();

  return <ClientDashboard data={data} />;
}
