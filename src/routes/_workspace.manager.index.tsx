import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getManagerAnalytics } from "@/lib/analytics";
import { ManagerDashboard } from "@/components/dashboard/manager-dashboard";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { parsePage } from "@/lib/pagination";

const getManagerDashboardData = createServerFn({ method: "GET" })
  .validator((search: { page?: number }) => search)
  .handler(async ({ data }) => {
    await requireStudioArea(StudioArea.DASHBOARD);
    return await getManagerAnalytics(data.page ?? 1);
  });

export const Route = createFileRoute("/_workspace/manager/")({
  validateSearch: (search: Record<string, unknown>): { page?: number } => ({
    page: parsePage(typeof search.page === "string" ? search.page : undefined),
  }),
  loaderDeps: ({ search: { page } }) => ({ page }),
  loader: ({ deps }) => getManagerDashboardData({ data: deps }),
  head: () => ({
    meta: [{ title: "Manager Dashboard | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="dashboard" label="Loading dashboard" />,
  component: ManagerDashboardRouteComponent,
});

function ManagerDashboardRouteComponent() {
  const data = Route.useLoaderData();
  return <ManagerDashboard data={data} />;
}

