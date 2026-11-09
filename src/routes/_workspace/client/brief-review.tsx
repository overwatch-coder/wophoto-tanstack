import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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

const getClientBriefReviewData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const user = await requireRole(UserRole.CLIENT);

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

    return {
      serializedBriefs,
      totalBriefs: result.total,
      page: result.page,
      pageSize: result.pageSize,
      projects,
      currentUserId: user.id,
    };
  });

export const Route = createFileRoute("/_workspace/client/brief-review")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getClientBriefReviewData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Project Creative Briefs | WoPhoto" },
      {
        name: "description",
        content:
          "View project guidelines, deliverable specifications, and shot lists for your projects.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading brief review" />,
  component: ClientBriefReviewRouteComponent,
});

function ClientBriefReviewRouteComponent() {
  const data = Route.useLoaderData();
  return (
    <BriefWorkspace
      initialBriefs={data.serializedBriefs}
      totalBriefs={data.totalBriefs}
      page={data.page}
      pageSize={data.pageSize}
      projects={data.projects}
      workers={[]}
      currentUserId={data.currentUserId}
      role={UserRole.CLIENT}
    />
  );
}
