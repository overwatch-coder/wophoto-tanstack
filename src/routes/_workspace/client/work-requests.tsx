import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import {
  getClientWorkRequestById,
  getClientWorkRequestOptions,
  getClientWorkRequests,
} from "@/lib/work-requests";
import { ClientWorkRequests } from "@/components/work-requests/client-work-requests";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { idSchema } from "@/lib/validation/common";

const getClientWorkRequestsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const client = await requireRole(UserRole.CLIENT);

    const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
    const requestId =
      typeof params.requestId === "string" && idSchema.safeParse(params.requestId).success
        ? params.requestId
        : null;

    const [data, options, focusRequest] = await Promise.all([
      getClientWorkRequests(client.id, { cursor }),
      getClientWorkRequestOptions(client.id),
      requestId ? getClientWorkRequestById(client.id, requestId) : null,
    ]);

    const url = (nextCursor?: string | null) => {
      const query = new URLSearchParams();
      if (nextCursor) query.set("cursor", nextCursor);
      return `/client/work-requests${query.size ? `?${query}` : ""}`;
    };

    return {
      data,
      options,
      nextHref: data.nextCursor ? url(data.nextCursor) : undefined,
      previousHref: cursor ? "/client/work-requests" : undefined,
      focusRequest,
      requestId,
    };
  });

export const Route = createFileRoute("/_workspace/client/work-requests")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getClientWorkRequestsData({ data: deps }),
  head: () => ({
    meta: [{ title: "Work Requests | WoPhoto" }],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading work requests" />,
  component: ClientWorkRequestsRouteComponent,
});

function ClientWorkRequestsRouteComponent() {
  const { data, options, nextHref, previousHref, focusRequest, requestId } =
    Route.useLoaderData();
  return (
    <ClientWorkRequests
      key={requestId ?? "work-requests"}
      data={data}
      options={options}
      nextHref={nextHref}
      previousHref={previousHref}
      focusRequest={focusRequest}
    />
  );
}
