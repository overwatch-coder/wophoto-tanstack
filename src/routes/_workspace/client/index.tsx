import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getClientAnalytics } from "@/lib/analytics";
import { ClientDashboard } from "@/components/dashboard/client-dashboard";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getClientDashboardData = createServerFn({ method: "GET" }).handler(async () => {
  await requireRole(UserRole.CLIENT);
  return await getClientAnalytics();
});

export const Route = createFileRoute("/_workspace/client/")({
  loader: () => getClientDashboardData(),
  head: () => ({
    meta: [{ title: "Client Dashboard | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="dashboard" label="Loading dashboard" />,
  component: ClientDashboardRouteComponent,
});

function ClientDashboardRouteComponent() {
  const data = Route.useLoaderData();
  return <ClientDashboard data={data} />;
}
