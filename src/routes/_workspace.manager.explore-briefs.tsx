import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import {
  UserRole,
  UserStatus,
  BriefTemplateCategory,
  BriefStatus,
  StudioArea,
} from "@/generated/prisma/client";
import { requireStudioArea } from "@/lib/studio-access";
import { prisma } from "@/lib/prisma";
import {
  getBriefTemplates,
  getStudioBriefArchive,
} from "@/lib/brief-templates";
import { ExploreBriefsWorkspace } from "@/components/brief-templates/explore-briefs-workspace";
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton";

const getManagerExploreBriefsData = createServerFn({ method: "GET" })
  .validator((params: Record<string, string | string[] | undefined>) => params)
  .handler(async ({ data: params }) => {
    const { user, context } = await requireStudioArea(StudioArea.BRIEFS);

    const search = typeof params.search === "string" ? params.search : "";
    const category =
      typeof params.category === "string" &&
      Object.values(BriefTemplateCategory).includes(
        params.category as BriefTemplateCategory
      )
        ? (params.category as BriefTemplateCategory)
        : undefined;
    const tag = typeof params.tag === "string" ? params.tag : undefined;
    const includeArchived = params.archived === "true";
    const project = typeof params.project === "string" ? params.project : undefined;
    const client = typeof params.client === "string" ? params.client : undefined;
    const status =
      typeof params.status === "string" &&
      Object.values(BriefStatus).includes(params.status as BriefStatus)
        ? (params.status as BriefStatus)
        : undefined;
    const page = typeof params.page === "string" ? parseInt(params.page, 10) || 1 : 1;

    const [templatesResult, archiveResult, managedProjects, invitedClients] =
      await Promise.all([
        getBriefTemplates({
          search,
          category,
          tag,
          includeArchived,
          page,
          pageSize: 12,
        }),
        getStudioBriefArchive({
          search,
          project,
          client,
          status,
          page,
          pageSize: 12,
        }),
        prisma.project.findMany({
          where: { studioId: context.studioId },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        }),
        prisma.user.findMany({
          where: {
            role: UserRole.CLIENT,
            status: UserStatus.ACTIVE,
            acceptedInvitation: { invitedById: user.id },
          },
          select: { id: true, name: true, email: true },
          orderBy: { name: "asc" },
        }),
      ]);

    return {
      initialTemplates: templatesResult.templates,
      totalTemplates: templatesResult.total,
      availableTags: templatesResult.availableTags,
      initialArchiveBriefs: archiveResult.briefs,
      totalArchiveBriefs: archiveResult.total,
      projects: managedProjects,
      clients: invitedClients,
    };
  });

export const Route = createFileRoute("/_workspace/manager/explore-briefs")({
  validateSearch: (search: Record<string, unknown>) => search as Record<string, string | undefined>,
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => getManagerExploreBriefsData({ data: deps }),
  head: () => ({
    meta: [
      { title: "Explore Briefs & Templates | WoPhoto" },
      {
        name: "description",
        content:
          "Discover reusable creative brief templates, explore past studio briefs, and instantiate new shoot plans.",
      },
    ],
  }),
  pendingComponent: () => <PageLoadingSkeleton variant="basic" label="Loading explore briefs" />,
  component: ManagerExploreBriefsRouteComponent,
});

function ManagerExploreBriefsRouteComponent() {
  const data = Route.useLoaderData();
  return <ExploreBriefsWorkspace {...data} role={UserRole.MANAGER} />;
}
