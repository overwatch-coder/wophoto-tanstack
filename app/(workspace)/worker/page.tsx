import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getWorkerAnalytics } from "@/lib/analytics";
import { WorkerDashboard } from "@/components/dashboard/worker-dashboard";

export default function WorkerWorkspacePage() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]" />}>
      <WorkerWorkspaceContent />
    </Suspense>
  );
}

async function WorkerWorkspaceContent() {
  await requireRole(UserRole.WORKER);
  const data = await getWorkerAnalytics();

  return <WorkerDashboard data={data} />;
}
