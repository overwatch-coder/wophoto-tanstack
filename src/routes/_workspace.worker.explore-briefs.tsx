import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { UserRole, BriefTemplateCategory, BriefStatus } from "@/generated/prisma/client";
import { requireRole } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import {
  getBriefTemplates,
  getStudioBriefArchive,
} from "@/lib/brief-templates";
import { ExploreBriefsWorkspace } from "@/components/brief-templates/explore-briefs-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getWorkerExploreBriefsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    await requireRole(UserRole.WORKER);

    const search = typeof params.search === "string" ? params.search : "";
    const category =
      typeof params.category === "string" &&
      Object.values(BriefTemplateCategory).includes(
        params.category as BriefTemplateCategory
      )
        ? (params.category as BriefTemplateCategory)
        : undefined;
    const tag = typeof params.tag === "string" ? params.tag : undefined;
    const project = typeof params.project === "string" ? params.project : undefined;
    const status =
      typeof params.status === "string" &&
      Object.values(BriefStatus).includes(params.status as BriefStatus)
        ? (params.status as BriefStatus)
        : undefined;
    const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

    const [templatesResult, archiveResult, allProjects] = await Promise.all([
      getBriefTemplates({
        search,
        category,
        tag,
        includeArchived: false,
        page,
        pageSize: 12,
      }),
      getStudioBriefArchive({
        search,
        project,
        status,
        page,
        pageSize: 12,
      }),
      prisma.project.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    return {
      initialTemplates: templatesResult.templates,
      totalTemplates: templatesResult.total,
      availableTags: templatesResult.availableTags,
      initialArchiveBriefs: archiveResult.briefs,
      totalArchiveBriefs: archiveResult.total,
      projects: allProjects,
    } as any;
  });

export const Route = createFileRoute("/_workspace/worker/explore-briefs")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getWorkerExploreBriefsData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Explore Studio Briefs & Templates | WoPhoto" },
      {
        name: "description",
        content:
          "Explore studio creative brief templates and past shoot references for lighting setups and deliverable guidelines.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading explore briefs" />,
  component: WorkerExploreBriefsRouteComponent,
});

function WorkerExploreBriefsRouteComponent() {
  const data = Route.useLoaderData() as any;
  return (
    <ExploreBriefsWorkspace
      {...data}
      clients={[]}
      role={UserRole.WORKER}
    />
  );
}
