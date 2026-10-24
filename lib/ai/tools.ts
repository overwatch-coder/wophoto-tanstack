import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";
import { createProjectForManager, createTaskBatchForManager } from "@/lib/ai/actions";
import { createToolInputSchema } from "@/lib/ai/tool-schema";
import { queryStudioData, studioDataQuerySchema } from "@/lib/ai/query-data";

export interface ToolContext {
  userId: string;
  role: UserRole;
  userEmail: string;
  autonomousExecution: boolean;
}

// Type-safe tool definition helper bridging Zod schemas with Vercel AI SDK
function defineStudioTool<TArgs, TResult>(config: {
  description: string;
  parameters: z.ZodType<TArgs>;
  execute: (args: TArgs) => Promise<TResult>;
}) {
  return tool({
    description: config.description,
    parameters: createToolInputSchema(config.parameters),
    execute: config.execute,
  } as unknown as Parameters<typeof tool>[0]);
}

export function createStudioTools(ctx: ToolContext) {
  const { userId, role, autonomousExecution } = ctx;

  return {
    // 1. SMART SEARCH TOOL (Read-only, Role-enforced)
    smart_search: defineStudioTool({
      description:
        "Perform a cross-studio search across client and worker reviews, revision pins, tasks, and projects.",
      parameters: z.object({
        query: z.string().trim().min(1).max(200).describe("Search term, client name, scene, or deliverable keyword"),
        category: z
          .enum(["ALL", "REVIEWS", "TASKS", "PROJECTS"])
          .default("ALL")
          .describe("Filter results by category"),
      }),
      execute: async ({ query, category = "ALL" }) => {
        const lowerQuery = query.toLowerCase().trim();

        // Query reviews / feedback
        let reviewsMatch: Array<{
          id: string;
          title: string;
          type: string;
          status: string;
          details: string;
          projectName?: string;
          clientName?: string;
          href: string;
        }> = [];

        if (category === "ALL" || category === "REVIEWS") {
          const feedbackWhere: Record<string, unknown> = {
            OR: [
              { title: { contains: lowerQuery, mode: "insensitive" } },
              { details: { contains: lowerQuery, mode: "insensitive" } },
              { project: { name: { contains: lowerQuery, mode: "insensitive" } } },
            ],
          };

          if (role === UserRole.CLIENT) {
            feedbackWhere.clientId = userId;
          } else if (role === UserRole.WORKER) {
            feedbackWhere.assignedWorkerId = userId;
          } else {
            feedbackWhere.project = { managerId: userId };
          }

          const rawReviews = await prisma.clientFeedback.findMany({
            where: feedbackWhere,
            include: {
              project: { select: { name: true } },
              client: { select: { name: true } },
            },
            take: 4,
            orderBy: { createdAt: "desc" },
          });

          reviewsMatch = rawReviews.map((r) => ({
            id: r.id,
            title: r.title,
            type: r.type,
            status: r.status,
            details: r.details,
            projectName: r.project?.name,
            clientName: r.client?.name ?? "Client",
            href: role === UserRole.CLIENT
              ? `/client/project-feedback?feedbackId=${encodeURIComponent(r.id)}`
              : role === UserRole.WORKER
                ? `/worker/reviews?feedbackId=${encodeURIComponent(r.id)}`
                : `/manager/reviews?feedbackId=${encodeURIComponent(r.id)}`,
          }));
        }

        // Query tasks
        let tasksMatch: Array<{
          id: string;
          title: string;
          status: string;
          priority: string;
          assigneeName?: string;
          href: string;
        }> = [];

        if ((category === "ALL" || category === "TASKS") && role !== UserRole.CLIENT) {
          const taskWhere: Record<string, unknown> = {
            deletedAt: null,
            OR: [
              { title: { contains: lowerQuery, mode: "insensitive" } },
              { description: { contains: lowerQuery, mode: "insensitive" } },
            ],
          };

          if (role === UserRole.WORKER) {
            taskWhere.assignees = { some: { userId } };
          } else {
            taskWhere.project = { managerId: userId };
          }

          const rawTasks = await prisma.task.findMany({
            where: taskWhere,
            include: {
              assignees: { include: { user: { select: { name: true } } } },
            },
            take: 4,
            orderBy: { createdAt: "desc" },
          });

          tasksMatch = rawTasks.map((t) => ({
            id: t.id,
            title: t.title,
            status: t.status,
            priority: t.priority,
            assigneeName: t.assignees[0]?.user?.name ?? "Unassigned",
            href: role === UserRole.WORKER ? `/worker/tasks?taskId=${encodeURIComponent(t.id)}` : `/manager/tasks?taskId=${encodeURIComponent(t.id)}`,
          }));
        }

        // Query projects
        let projectsMatch: Array<{
          id: string;
          name: string;
          clientName?: string;
          href: string;
        }> = [];

        if (category === "ALL" || category === "PROJECTS") {
          const projectWhere: Record<string, unknown> = {
            name: { contains: lowerQuery, mode: "insensitive" },
          };
          if (role === UserRole.CLIENT) {
            projectWhere.clientId = userId;
          } else if (role === UserRole.WORKER) {
            projectWhere.tasks = { some: { deletedAt: null, assignees: { some: { userId } } } };
          } else {
            projectWhere.managerId = userId;
          }

          const rawProjects = await prisma.project.findMany({
            where: projectWhere,
            include: { client: { select: { name: true } } },
            take: 3,
            orderBy: { createdAt: "desc" },
          });

          projectsMatch = rawProjects.map((p) => ({
            id: p.id,
            name: p.name,
            clientName: p.client?.name ?? undefined,
            href: role === UserRole.CLIENT ? "/client" : "/manager/projects",
          }));
        }

        const totalFound = reviewsMatch.length + tasksMatch.length + projectsMatch.length;

        return {
          totalFound,
          reviews: reviewsMatch,
          tasks: tasksMatch,
          projects: projectsMatch,
          message:
            totalFound > 0
              ? `Found ${totalFound} items matching "${query}".`
              : `No studio records matched "${query}".`,
        };
      },
    }),

    // 2. GENERAL DATABASE QUERY TOOL (Read-only, allowlisted and role-scoped)
    query_studio_data: defineStudioTool({
      description:
        "Query records in the studio database when the user asks to get, list, count, or inspect data. Supports PROJECTS, TASKS, DELETED_TASKS, FEEDBACK, NOTIFICATIONS, COMMENTS, RATINGS, INVITATIONS, and TEAM, with LIST, GET, or COUNT operations. Use explicit filters for exact counts or criteria (for example PROJECTS with deadline EQUALS UPCOMING). For LIST/GET, results include approved summaries and pages of at most 20 records. Filters support EQUALS, NOT_EQUALS, CONTAINS, BEFORE, AFTER, GTE, LTE on supported entity fields. This is the authoritative retrieval/count tool; do not use smart_search to infer whether a table or category has records. Access is restricted to the signed-in user's role and ownership scope.",
      parameters: studioDataQuerySchema,
      execute: async (input) => queryStudioData({ userId, role }, input),
    }),

    // 3. QUERY TEAM CAPACITY TOOL (Read-only, Manager & Worker)
    query_team_capacity: defineStudioTool({
      description: "Inspect retoucher availability, active queue count, and specializations.",
      parameters: z.object({
        specialization: z.string().optional().describe("Optional specialization filter"),
      }),
      execute: async ({ specialization }) => {
        if (role === UserRole.CLIENT) {
          return { error: "Client accounts do not have permission to inspect internal retoucher capacity." };
        }

        const workers = await prisma.user.findMany({
          where: {
            role: UserRole.WORKER,
            status: "ACTIVE",
            ...(role === UserRole.WORKER
              ? { id: userId }
              : { acceptedInvitation: { is: { invitedById: userId } } }),
            ...(specialization
              ? {
                  specializations: {
                    some: { specialization: specialization as never },
                  },
                }
              : {}),
          },
          select: {
            id: true,
            name: true,
            email: true,
            preferences: {
              select: {
                workerAvailability: true,
                location: true,
              },
            },
            taskAssignments: {
              where: {
                task: {
                  deletedAt: null,
                  status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
                },
              },
              select: { taskId: true },
            },
          },
          take: 10,
        });

        const capacityList = workers.map((w) => ({
          name: w.name || w.email,
          status: w.preferences?.workerAvailability || "AVAILABLE",
          activeTasks: w.taskAssignments.length,
          location: w.preferences?.location || "London Suite",
        }));

        return {
          retouchersCount: workers.length,
          capacity: capacityList,
        };
      },
    }),

    // 3. QUERY SLA RISKS TOOL (Read-only, Manager)
    query_sla_risks: defineStudioTool({
      description: "Scan active deliverables approaching their SLA deadline cutoff.",
      parameters: z.object({
        cutoffHours: z.number().int().min(1).max(720).default(24).describe("Hours window before cutoff"),
      }),
      execute: async ({ cutoffHours = 24 }) => {
        if (role !== UserRole.MANAGER) {
          return { error: "SLA triage is restricted to studio managers." };
        }

        const cutoffDate = new Date();
        cutoffDate.setHours(cutoffDate.getHours() + cutoffHours);

        const [urgentCount, urgentTasks] = await Promise.all([
          prisma.task.count({
            where: {
              deletedAt: null,
              status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
              dueAt: { lte: cutoffDate, not: null },
              project: { managerId: userId },
            },
          }),
          prisma.task.findMany({
          where: {
            deletedAt: null,
            status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] },
            dueAt: { lte: cutoffDate, not: null },
            project: { managerId: userId },
          },
          include: {
            assignees: { include: { user: { select: { name: true, email: true } } } },
            project: { select: { name: true } },
          },
          take: 5,
          orderBy: { dueAt: "asc" },
          }),
        ]);

        return {
          urgentCount,
          shownCount: urgentTasks.length,
          deliverables: urgentTasks.map((t) => ({
            id: t.id,
            title: t.title,
            projectName: t.project?.name ?? "General",
            assignee: t.assignees[0]?.user?.name || "Unassigned",
            deadline: t.dueAt?.toISOString(),
            status: t.status,
            href: `/manager/tasks?taskId=${encodeURIComponent(t.id)}&taskAction=review`,
          })),
        };
      },
    }),

    // 4. CREATE PROJECT TOOL (State-mutating, Manager only)
    create_project: defineStudioTool({
      description: "Create a new production project container in the studio database.",
      parameters: z.object({
        name: z.string().min(2).describe("Name of the project or campaign"),
        clientEmail: z.string().email().describe("Email of the active client account to associate with the project"),
      }),
      execute: async ({ name, clientEmail }) => {
        if (role !== UserRole.MANAGER) {
          return { error: "Only managers are authorized to create projects." };
        }

        // Check if confirmation is required (Safe Multi-Tier Mode)
        if (!autonomousExecution) {
          return {
            requiresConfirmation: true,
            proposalType: "CREATE_PROJECT",
            title: `Create Project: ${name}`,
            description: `Will create a new project container named "${name}"${clientEmail ? ` for client ${clientEmail}` : ""}.`,
            payload: { name, clientEmail },
          };
        }

        return createProjectForManager(userId, { name, clientEmail });
      },
    }),

    // 5. CREATE TASK BATCH TOOL (State-mutating, Manager only)
    create_task_batch: defineStudioTool({
      description: "Generate and assign batch retouching or photography tasks.",
      parameters: z.object({
        projectId: z.string().optional().describe("Associated manager owned project ID"),
        taskCount: z.number().int().min(1).max(20).describe("Number of tasks to generate"),
        baseTitle: z.string().trim().min(2).max(120).describe("Base title for the tasks"),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      }),
      execute: async ({
        projectId,
        taskCount,
        baseTitle,
        priority = "MEDIUM",
      }) => {
        if (role !== UserRole.MANAGER) {
          return { error: "Only managers are authorized to create and assign tasks." };
        }

        let targetProjectId = projectId;
        if (!targetProjectId) {
          const defaultProject = await prisma.project.findFirst({
            where: { managerId: userId },
            orderBy: { createdAt: "desc" },
            select: { id: true },
          });
          targetProjectId = defaultProject?.id;
        }
        if (!targetProjectId) return { error: "Create or select one of your projects first." };

        if (!autonomousExecution) {
          return {
            requiresConfirmation: true,
            proposalType: "CREATE_TASK_BATCH",
            title: `Generate Batch of ${taskCount} Tasks`,
            description: `Will create ${taskCount} tasks with title base "${baseTitle}" at ${priority} priority.`,
            payload: { projectId: targetProjectId, taskCount, baseTitle, priority },
          };
        }

        return createTaskBatchForManager(userId, { projectId: targetProjectId, taskCount, baseTitle, priority });
      },
    }),

    // 6. GENERATE WRAPUP REPORT TOOL (Read-only, Manager only)
    generate_wrapup_report: defineStudioTool({
      description: "Compile final delivery metrics and executive summary for a completed campaign.",
      parameters: z.object({
        projectId: z.string().describe("Project ID to summarize"),
      }),
      execute: async ({ projectId }) => {
        if (role !== UserRole.MANAGER) return { error: "Only managers can compile delivery wrap-up reports." };

        const project = await prisma.project.findFirst({
          where: { id: projectId, managerId: userId },
          select: { id: true, name: true, client: { select: { name: true } } },
        });

        if (!project) {
          return { error: `Project ID "${projectId}" was not found.` };
        }

        const [total, completed] = await Promise.all([
          prisma.task.count({ where: { projectId: project.id, deletedAt: null } }),
          prisma.task.count({ where: { projectId: project.id, deletedAt: null, status: "COMPLETED" } }),
        ]);

        return {
          projectName: project.name,
          client: project.client?.name || "Client",
          totalAssets: total,
          completedAssets: completed,
          completionRate: total > 0 ? `${Math.round((completed / total) * 100)}%` : "N/A",
          href: `/manager/projects`,
          message: `Compiled executive report for "${project.name}". ${completed}/${total} assets delivered.`,
        };
      },
    }),

    // 7. NAVIGATE TO DEEP LINK TOOL (Constructs deep routes)
    navigate_to: defineStudioTool({
      description: "Construct a direct deep navigation link to reviews, tasks, or settings.",
      parameters: z.object({
        target: z.enum(["REVIEWS", "TASKS", "PROJECTS", "SETTINGS", "DASHBOARD"]),
        queryParam: z.string().optional().describe("Optional search or filter query to append"),
      }),
      execute: async ({ target, queryParam }) => {
        let route = "/";
        const queryPart = queryParam ? `?query=${encodeURIComponent(queryParam)}` : "";

        switch (target) {
          case "REVIEWS":
            route =
              role === UserRole.CLIENT
                ? "/client/project-feedback"
                : role === UserRole.WORKER
                  ? "/worker/reviews"
                  : `/manager/reviews${queryPart}`;
            break;
          case "TASKS":
            route = role === UserRole.WORKER ? `/worker/tasks${queryPart}` : `/manager/tasks${queryPart}`;
            break;
          case "PROJECTS":
            route = role === UserRole.CLIENT ? "/client" : "/manager/projects";
            break;
          case "SETTINGS":
            route = "/settings";
            break;
          case "DASHBOARD":
          default:
            route = role === UserRole.CLIENT ? "/client" : role === UserRole.WORKER ? "/worker" : "/manager";
            break;
        }

        return {
          href: route,
          target,
          message: `Constructed navigation link to ${route}`,
        };
      },
    }),
  };
}
