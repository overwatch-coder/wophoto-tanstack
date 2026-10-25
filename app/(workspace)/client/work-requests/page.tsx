import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { getClientWorkRequestById, getClientWorkRequestOptions, getClientWorkRequests } from "@/lib/work-requests";
import { ClientWorkRequests } from "@/components/work-requests/client-work-requests";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { idSchema } from "@/lib/validation/common";

export const metadata = { title: "Work Requests | WoPhoto" };

export default function ClientWorkRequestsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <Suspense fallback={<PageLoadingSkeleton variant="basic" label="Loading work requests" />}><ClientWorkRequestsContent searchParams={searchParams} /></Suspense>;
}

async function ClientWorkRequestsContent({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const client = await requireRole(UserRole.CLIENT);
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? params.cursor : undefined;
  const requestId = typeof params.requestId === "string" && idSchema.safeParse(params.requestId).success ? params.requestId : null;
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
  return <ClientWorkRequests data={data} options={options} nextHref={data.nextCursor ? url(data.nextCursor) : undefined} previousHref={cursor ? "/client/work-requests" : undefined} focusRequest={focusRequest} />;
}
