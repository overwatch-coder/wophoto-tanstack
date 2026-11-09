import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getWorkerAnalytics } from "@/lib/analytics";
import { WorkerDashboard } from "@/components/dashboard/worker-dashboard";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole(UserRole.WORKER);
  return await getWorkerAnalytics();
});

export const Route = createFileRoute("/_workspace/worker/")({
  loader: () => getWorkerDashboardData(),
  head: () => ({
    meta: [{ title: "Worker Dashboard | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="dashboard" label="Loading dashboard" />,
  component: WorkerDashboardRouteComponent,
});

function WorkerDashboardRouteComponent() {
  const data = Route.useLoaderData();
  return <WorkerDashboard data={data} />;
}

