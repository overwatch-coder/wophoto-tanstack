import { Suspense } from "react"
import { redirect } from "next/navigation"
import {
  InvitationStatus,
  Prisma,
  UserRole,
  UserStatus,
} from "@/generated/prisma/client"
import { ProjectManagement } from "@/components/projects/project-management"
import { prisma } from "@/lib/prisma"
import { requireRole } from "@/lib/authz"
import { DEFAULT_PAGE_SIZE, getPageCount } from "@/lib/pagination"
import { parseProjectQuery } from "@/lib/validation/queries"
import { cleanClientName } from "@/lib/format"
import { PageLoadingSkeleton } from "@/components/workspace/page-loading-skeleton"

export default function ManagerProjectsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  return (
    <Suspense
      fallback={
        <PageLoadingSkeleton variant="projects" label="Loading projects" />
      }
    >
      <ManagerProjectsContent searchParams={searchParams} />
    </Suspense>
  )
}

async function ManagerProjectsContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const manager = await requireRole(UserRole.MANAGER)
  const params = await searchParams
  const filters = parseProjectQuery(params)
  const q = filters.query
  const clientParam = filters.client
  const clients = await prisma.user.findMany({
    where: {
      role: UserRole.CLIENT,
      status: UserStatus.ACTIVE,
      acceptedInvitation: {
        is: { invitedById: manager.id, status: InvitationStatus.USED },
      },
    },
    select: { id: true, name: true },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: 100,
  })
  const legacyClient = clients.find((client) => client.id === clientParam)
  if (legacyClient) {
    const canonicalParams = new URLSearchParams()
    for (const [key, value] of Object.entries(params)) {
      if (key === "client" || value === undefined) continue
      for (const item of Array.isArray(value) ? value : [value])
        canonicalParams.append(key, item)
    }
    canonicalParams.set(
      "client",
      cleanClientName(legacyClient.name) || "Unnamed client"
    )
    redirect(`/manager/projects?${canonicalParams.toString()}`)
  }
  const clientName = clientParam
  const selectedClientIds =
    clientName && clientName !== "ALL"
      ? clients
          .filter(
            (client) =>
              (cleanClientName(client.name) || "Unnamed client") === clientName
          )
          .map((client) => client.id)
      : []
  const where = {
    managerId: manager.id,
    ...(clientName && clientName !== "ALL"
      ? { clientId: { in: selectedClientIds } }
      : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }
  const [totalProjects, totalTasks, completedTasks, projectStatuses] =
    await Promise.all([
      prisma.project.count({ where }),
      prisma.task.count({
        where: { project: { managerId: manager.id }, deletedAt: null },
      }),
      prisma.task.count({
        where: {
          project: { managerId: manager.id },
          deletedAt: null,
          status: "COMPLETED",
        },
      }),
      prisma.$queryRaw<Array<{ status: string; count: number }>>(Prisma.sql`
      WITH task_summary AS (
        SELECT p."id", COUNT(t."id") FILTER (WHERE t."deletedAt" IS NULL) AS total,
          COUNT(t."id") FILTER (WHERE t."deletedAt" IS NULL AND t."status" = 'COMPLETED') AS completed,
          BOOL_OR(t."status" = 'IN_REVIEW' AND t."deletedAt" IS NULL) AS has_review
        FROM "Project" p LEFT JOIN "Task" t ON t."projectId" = p."id"
        WHERE p."managerId" = ${manager.id} GROUP BY p."id"
      )
      SELECT CASE WHEN total = 0 THEN 'PLANNING' WHEN completed = total THEN 'COMPLETED'
        WHEN has_review THEN 'IN_REVIEW' ELSE 'IN_PROGRESS' END AS status, COUNT(*)::int AS count
      FROM task_summary GROUP BY status
    `),
    ])
  const totalPages = getPageCount(totalProjects)
  const page = Math.min(filters.page, totalPages)
  const projects = await prisma.project.findMany({
    where,
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      client: { select: { id: true, name: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
    take: DEFAULT_PAGE_SIZE,
    skip: (page - 1) * DEFAULT_PAGE_SIZE,
  })
  const projectIds = projects.map((project) => project.id)
  const [taskStates, latestDue] = projectIds.length
    ? await Promise.all([
        prisma.task.groupBy({
          by: ["projectId", "status"],
          where: { projectId: { in: projectIds }, deletedAt: null },
          _count: { _all: true },
        }),
        prisma.task.groupBy({
          by: ["projectId"],
          where: {
            projectId: { in: projectIds },
            deletedAt: null,
            dueAt: { not: null },
          },
          _max: { dueAt: true },
        }),
      ])
    : [[], []]
  const summaries = new Map<
    string,
    {
      total: number
      completed: number
      review: boolean
      latestDueAt: Date | null
    }
  >()
  for (const row of taskStates) {
    const summary = summaries.get(row.projectId) ?? {
      total: 0,
      completed: 0,
      review: false,
      latestDueAt: null,
    }
    summary.total += row._count._all
    if (row.status === "COMPLETED") summary.completed = row._count._all
    if (row.status === "IN_REVIEW") summary.review = true
    summaries.set(row.projectId, summary)
  }
  for (const row of latestDue) {
    const summary = summaries.get(row.projectId) ?? {
      total: 0,
      completed: 0,
      review: false,
      latestDueAt: null,
    }
    summary.latestDueAt = row._max.dueAt
    summaries.set(row.projectId, summary)
  }
  const projectData = projects.map((project) => {
    const taskSummary = summaries.get(project.id) ?? {
      total: 0,
      completed: 0,
      review: false,
      latestDueAt: null,
    }
    const status =
      taskSummary.total === 0
        ? ("PLANNING" as const)
        : taskSummary.completed === taskSummary.total
          ? ("COMPLETED" as const)
          : taskSummary.review
            ? ("IN_REVIEW" as const)
            : ("IN_PROGRESS" as const)
    return { ...project, taskSummary, status }
  })
  const statusCounts = Object.fromEntries(
    projectStatuses.map(({ status, count }) => [status, count])
  )
  return (
    <ProjectManagement
      projects={projectData}
      clients={clients}
      summary={{
        active: statusCounts.IN_PROGRESS ?? 0,
        inReview: statusCounts.IN_REVIEW ?? 0,
        completed: statusCounts.COMPLETED ?? 0,
        totalTasks,
        completedTasks,
      }}
      page={page}
      totalPages={totalPages}
      totalProjects={totalProjects}
      searchParams={params}
    />
  )
}
