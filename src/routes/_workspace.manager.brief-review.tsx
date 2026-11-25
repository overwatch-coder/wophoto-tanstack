import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { StudioArea, UserRole, UserStatus } from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import { getProjectBriefs } from "@/lib/briefs";
import {
  BriefWorkspace,
  type SerializedCreativeBrief,
} from "@/components/briefs/brief-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";
import { type ShotItem } from "@/lib/validation/briefs";

const getManagerBriefReviewData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const { user, context } = await requireStudioArea(StudioArea.BRIEFS);

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
        where: {
          role: UserRole.WORKER,
          status: UserStatus.ACTIVE,
          acceptedInvitation: { is: { studioId: context.studioId } },
        },
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

    return {
      serializedBriefs,
      totalBriefs: result.total,
      page: result.page,
      pageSize: result.pageSize,
      projects,
      workers,
      currentUserId: user.id,
    };
  });

export const Route = createFileRoute("/_workspace/manager/brief-review")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerBriefReviewData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Creative Brief Review | WoPhoto" },
      {
        name: "description",
        content:
          "Author, manage, and verify crew sign-offs on creative briefs and session shot lists.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading brief review" />,
  component: ManagerBriefReviewRouteComponent,
});

function ManagerBriefReviewRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <BriefWorkspace
      initialBriefs={data.serializedBriefs}
      totalBriefs={data.totalBriefs}
      page={data.page}
      pageSize={data.pageSize}
      projects={data.projects}
      workers={data.workers}
      currentUserId={data.currentUserId}
      role={UserRole.MANAGER}
    />
  );
}

