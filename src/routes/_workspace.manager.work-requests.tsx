import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import {
  getManagerWorkRequestById,
  getManagerWorkRequestOptions,
  getManagerWorkRequests,
} from "@/lib/work-requests";
import { ManagerWorkRequests } from "@/components/work-requests/manager-work-requests";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { idSchema } from "@/lib/validation/common";

const getManagerWorkRequestsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const { context } = await requireStudioArea(StudioArea.WORK_REQUESTS);
    const managerId = context.ownerUserId;

    const status = typeof params.status === "string" ? params.status : "ALL";
    const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
    const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
    const requestId =
      typeof params.requestId === "string" && idSchema.safeParse(params.requestId).success
        ? params.requestId
        : null;

    const filters = { status, query, cursor };
    const [data, options, focusRequest] = await Promise.all([
      getManagerWorkRequests(managerId, filters),
      getManagerWorkRequestOptions(managerId),
      requestId ? getManagerWorkRequestById(managerId, requestId) : null,
    ]);

    const url = (nextCursor?: string | null) => {
      const search = new URLSearchParams();
      if (status !== "ALL") search.set("status", status);
      if (query) search.set("q", query);
      if (nextCursor) search.set("cursor", nextCursor);
      return `/manager/work-requests${search.size ? `?${search}` : ""}`;
    };

    return {
      data,
      options,
      status,
      query,
      nextHref: data.nextCursor ? url(data.nextCursor) : undefined,
      previousHref: cursor ? url() : undefined,
      focusRequest,
    };
  });

export const Route = createFileRoute("/_workspace/manager/work-requests")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerWorkRequestsData({ data: deps }),
  head: () => ({
    meta: [{ title: "Client Work Requests | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading work requests" />,
  component: ManagerWorkRequestsRouteComponent,
});

function ManagerWorkRequestsRouteComponent() {
  const props = Route.useLoaderData();
  return <ManagerWorkRequests {...props} />;
}

