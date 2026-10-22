import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getWorkerAnalytics } from "@/lib/analytics";
import { WorkerDashboard } from "@/components/dashboard/worker-dashboard";

export default async function WorkerWorkspacePage() {
  await requireRole(UserRole.WORKER);
  const data = await getWorkerAnalytics();

  return <WorkerDashboard data={data} />;
}
