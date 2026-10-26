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
  title: "Creative Brief Review | WoPhoto",
  description:
    "Review shoot guidelines, track shot lists, and confirm creative sign-offs.",
};

export default function WorkerBriefReviewPage({
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
      <WorkerBriefReviewContent searchParams={searchParams} />
    </Suspense>
  );
}

async function WorkerBriefReviewContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const user = await requireRole(UserRole.WORKER);
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
      where: {
        OR: [
          { tasks: { some: { assignees: { some: { userId: user.id } } } } },
          { creativeBriefs: { some: { signOffs: { some: { userId: user.id } } } } },
        ],
      },
      select: { id: true, name: true, clientId: true },
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
      workers={[]}
      currentUserId={user.id}
      role={UserRole.WORKER}
    />
  );
}
