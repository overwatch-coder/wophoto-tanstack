import { Suspense } from "react";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getManagerAnalytics } from "@/lib/analytics";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";

export default function ManagerDashboardPage() {
  return (
    <Suspense fallback={<main className="min-h-[60vh]" />}>
      <ManagerDashboardContent />
    </Suspense>
  );
}

async function ManagerDashboardContent() {
  await requireRole(UserRole.MANAGER);
  const data = await getManagerAnalytics();

  return <ManagerDashboard data={data} />;
}
