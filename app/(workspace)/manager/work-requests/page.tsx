import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { getManagerWorkRequestById, getManagerWorkRequestOptions, getManagerWorkRequests } from "@/lib/work-requests";
import { ManagerWorkRequests } from "@/components/work-requests/manager-work-requests";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { idSchema } from "@/lib/validation/common";

export const metadata = { title: "Client Work Requests | WoPhoto" };

export default function ManagerWorkRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageLoadingSkeleton variant="basic" label="Loading client work requests" />}><ManagerWorkRequestsContent searchParams={searchParams} /></Suspense>;
}

async function ManagerWorkRequestsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { context } = await requireStudioArea(StudioArea.WORK_REQUESTS);
  const managerId = context.ownerUserId;
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "ALL";
  const query = typeof params.q === "string" ? params.q.trim().slice(0, 120) : "";
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const requestId = typeof params.requestId === "string" && idSchema.safeParse(params.requestId).success ? params.requestId : null;
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
  return <ManagerWorkRequests data={data} options={options} status={status} query={query} nextHref={data.nextCursor ? url(data.nextCursor) : undefined} previousHref={cursor ? url() : undefined} focusRequest={focusRequest} />;
}
