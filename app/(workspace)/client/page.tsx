import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getClientAnalytics } from "@/lib/analytics";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";

export default async function ClientWorkspacePage() {
  await requireRole(UserRole.CLIENT);
  const data = await getClientAnalytics();

  return <ClientDashboard data={data} />;
}
