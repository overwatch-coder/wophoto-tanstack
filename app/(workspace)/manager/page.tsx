import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getManagerAnalytics } from "@/lib/analytics";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";

export default async function ManagerDashboardPage() {
  await requireRole(UserRole.MANAGER);
  const data = await getManagerAnalytics();

  return <ManagerDashboard data={data} />;
}
