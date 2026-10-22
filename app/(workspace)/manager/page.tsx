import { UserRole } from "@/generated/prisma/client";
import { ConstructionPage } from "@/components/workspace/construction-page";
import { requireRole } from "@/lib/authz";

export default async function ManagerDashboardPage() {
  await requireRole(UserRole.MANAGER);

  return <ConstructionPage title="Dashboard" />;
}
