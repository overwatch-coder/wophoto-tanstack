import { Suspense } from "react";
import { connection } from "next/server";
import { UserRole, UserStatus } from "@/generated/prisma/client";
import { StudioArea } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getProjectBriefs } from "@/lib/briefs";
import {
  BriefWorkspace,
  type SerializedCreativeBrief,
} from "@/components/briefs/brief-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { type ShotItem } from "@/lib/validation/briefs";

export const metadata = {
  title: "Creative Brief Review | WoPhoto",
  description:
    "Author, manage, and verify crew sign-offs on creative briefs and session shot lists.",
};

export default function ManagerBriefReviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton
          variant="basic"
          label="Loading creative brief workspace"
        />
      }
    >
      <ManagerBriefReviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function ManagerBriefReviewContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const { user, context } = await requireStudioArea(StudioArea.BRIEFS);
  const params = await searchParams;

  const search = typeof params.search === "string" ? params.search : "";
  const projectName = typeof params.project === "string" ? params.project : undefined;
  const page = typeof params.page === "string" ? Number(params.page) : 1;
  const status = typeof params.status === "string" ? params.status : undefined;

  const [result, projects, workers] = await Promise.all([
    getProjectBriefs({
      search,
      projectName,
      status,
      page,
    }),
    prisma.project.findMany({
      where: { studioId: context.studioId },
      select: { id: true, name: true, clientId: true },
      orderBy: { name: "asc" },
    }),
    prisma.user.findMany({
      where: { role: UserRole.WORKER, status: UserStatus.ACTIVE },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const serializedBriefs: SerializedCreativeBrief[] = result.briefs.map((b) => ({
    ...b,
    shotList: Array.isArray(b.shotList) ? (b.shotList as unknown as ShotItem[]) : null,
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
    signOffs: b.signOffs.map((s) => ({
      ...s,
      signedAt: s.signedAt ? s.signedAt.toISOString() : null,
      waivedAt: s.waivedAt ? s.waivedAt.toISOString() : null,
    })),
    questions: b.questions
      ? b.questions.map((q) => ({
          ...q,
          createdAt: q.createdAt.toISOString(),
          replies: q.replies?.map((r) => ({
            ...r,
            createdAt: r.createdAt.toISOString(),
          })),
        }))
      : [],
    userSignOff: b.userSignOff
      ? {
          ...b.userSignOff,
          signedAt: b.userSignOff.signedAt
            ? b.userSignOff.signedAt.toISOString()
            : null,
          waivedAt: b.userSignOff.waivedAt
            ? b.userSignOff.waivedAt.toISOString()
            : null,
        }
      : null,
  }));

  return (
    <BriefWorkspace
      initialBriefs={serializedBriefs}
      totalBriefs={result.total}
      page={result.page}
      pageSize={result.pageSize}
      projects={projects}
      workers={workers}
      currentUserId={user.id}
      role={UserRole.MANAGER}
    />
  );
}
