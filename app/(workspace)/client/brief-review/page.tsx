import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getProjectBriefs } from "@/lib/briefs";
import {
  BriefWorkspace,
  type SerializedCreativeBrief,
} from "@/components/briefs/brief-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { type ShotItem } from "@/lib/validation/briefs";

export const metadata = {
  title: "Project Creative Briefs | WoPhoto",
  description:
    "View project guidelines, deliverable specifications, and shot lists for your projects.",
};

export default function ClientBriefReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading project creative briefs"
        />
      }
    >
      <ClientBriefReviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ClientBriefReviewContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireRole(UserRole.CLIENT);
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : "";
  const projectName = typeof params.project === "string" ? params.project : undefined;
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const status = typeof params.status === "string" ? params.status : undefined;

  const [result, projects] = await Promise.all([
    getProjectBriefs({
      search,
      projectName,
      status,
      page,
    }),
    prisma.project.findMany({
      where: { clientId: user.id },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedBriefs: SerializedCreativeBrief[] = result.briefs.map((b) => ({
    ...b,
    shotList: Array.isArray(b.shotList) ? (b.shotList as unknown as ShotItem[]) : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    signOffs: [],
    questions: [],
    userSignOff: null,
  }));

  return (
    <BriefWorkspace
      initialBriefs={serializedBriefs}
      totalBriefs={result.total}
      page={result.page}
      pageSize={result.pageSize}
      projects={projects}
      workers={[]}
      currentUserId={user.id}
      role={UserRole.CLIENT}
    />
  );
}
