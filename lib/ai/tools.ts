import "server-only";

import { tool } from "ai";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";
import {
  createProjectForManager,
  createTaskBatchForManager,
  prepareTaskBatchForManager,
} from "@/lib/ai/actions";
import { createToolInputSchema } from "@/lib/ai/tool-schema";
import { queryStudioData, studioDataQuerySchema } from "@/lib/ai/query-data";
import { createClientInvitationProposalSchema } from "@/lib/validation/invitations";
import { WorkRequestType } from "@/generated/prisma/client";
import { inventoryActionPayloadSchema, prepareInventoryAction } from "@/lib/ai/inventory-proposals";

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
  const inventoryActionTool = role === UserRole.CLIENT ? null : defineStudioTool({
    description: "Prepare, but never automatically apply, an inventory change. First use query_studio_data to find the item or record ID and check its current state. Supported actions are CREATE_ITEM and UPDATE_ITEM and RETIRE_ITEM for managers, CHECKOUT_ITEM and RETURN_ITEM for managers or workers (workers can only return their own loans), and RESOLVE_MAINTENANCE for managers. Always return a confirmation proposal card. This explicit confirmation is required even if autonomous execution is enabled.",
    parameters: inventoryActionPayloadSchema,
    execute: async (input) => prepareInventoryAction(userId, role, input),
  });

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
        "Query records in the studio database when the user asks to get, list, count, or inspect data. Supports PROJECTS, TASKS, DELETED_TASKS, FEEDBACK, WORK_REQUESTS, NOTIFICATIONS, COMMENTS, RATINGS, INVITATIONS, TEAM, INVENTORY, INVENTORY_LOANS, and INVENTORY_MAINTENANCE, with LIST, GET, or COUNT operations. WORK_REQUESTS are available to managers for requests assigned to their studio and clients for their own requests; workers cannot read them. Inventory is available only to managers and workers; workers can read only their own loan records, while maintenance records are manager only. Use explicit filters for exact counts or criteria (for example INVENTORY with status EQUALS AVAILABLE). For LIST/GET, results include approved summaries and pages of at most 20 records. Filters support EQUALS, NOT_EQUALS, CONTAINS, BEFORE, AFTER, GTE, LTE on supported entity fields. This is the authoritative retrieval/count tool; do not use smart_search to infer whether a table or category has records. Access is restricted to the signed-in user's role and ownership scope.",
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

    // Prepare a client review draft without saving it. The client submits it from the form.
    prepare_client_feedback: defineStudioTool({
      description: "For a client who asks to draft or write a review, prepare a review card that opens the existing feedback form with its project, rating, and review text filled in. This tool never submits or saves feedback. Only use projects owned by the signed-in client.",
      parameters: z.object({
        projectName: z.string().trim().min(1).max(120).optional().describe("Project name mentioned by the client, if any"),
        details: z.string().trim().min(3).max(5000).describe("Review text drafted from the client's request, without inventing events or facts"),
        score: z.number().int().min(1).max(5).default(5).describe("Star rating selected or reasonably inferred from the client's stated sentiment; use 5 only if no sentiment or rating is specified"),
      }),
      execute: async ({ projectName, details, score }) => {
        if (role !== UserRole.CLIENT) {
          return { error: "Only clients can prepare a client review draft." };
        }

        const projects = await prisma.project.findMany({
          where: {
            clientId: userId,
            ...(projectName ? { name: { contains: projectName, mode: "insensitive" as const } } : {}),
          },
          select: { id: true, name: true },
          orderBy: { updatedAt: "desc" },
          take: 10,
        });
        const exactMatch = projectName
          ? projects.filter((project) => project.name.toLocaleLowerCase() === projectName.toLocaleLowerCase())
          : [];
        const project = exactMatch.length === 1 ? exactMatch[0] : projects.length === 1 ? projects[0] : null;

        if (!project) {
          return {
            needsInput: true,
            message: projects.length === 0
              ? "Which of your projects should this review be about?"
              : `Which project should this review be about? I found: ${projects.map((item) => item.name).join(", ")}.`,
          };
        }

        return {
          clientFeedbackDraft: {
            projectId: project.id,
            projectName: project.name,
            type: "REVIEW",
            score,
            details,
          },
          message: `Review draft ready for ${project.name}. Open the form to review it and submit when ready.`,
        };
      },
    }),

    prepare_work_request: defineStudioTool({
      description: "For a client who wants to request new work or a new project, prepare a request card for client review. Do not save or submit the request. Existing-project work requires a project owned by the signed-in client. New-project requests do not use an existing project. Ask which project when the client has more than one possible project and did not identify it.",
      parameters: z.object({
        type: z.enum([WorkRequestType.WORK, WorkRequestType.PROJECT]).describe("WORK for work on an existing project, PROJECT to request a new project"),
        projectName: z.string().trim().min(1).max(120).optional().describe("Existing client owned project name for a WORK request"),
        title: z.string().trim().min(2).max(160).describe("Request title or proposed project name"),
        details: z.string().trim().min(10).max(5000).describe("Request details drafted only from what the client said"),
        requestedDueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Optional requested date in YYYY-MM-DD form"),
      }).strict(),
      execute: async ({ type, projectName, title, details, requestedDueAt }) => {
        if (role !== UserRole.CLIENT) return { error: "Only clients can prepare work requests." };
        let project: { id: string; name: string } | null = null;
        if (type === WorkRequestType.WORK) {
          const projects = await prisma.project.findMany({ where: { clientId: userId, ...(projectName ? { name: { contains: projectName, mode: "insensitive" as const } } : {}) }, select: { id: true, name: true }, orderBy: { updatedAt: "desc" }, take: 100 });
          const exact = projectName ? projects.filter((item) => item.name.toLocaleLowerCase() === projectName.toLocaleLowerCase()) : [];
          project = exact.length === 1 ? exact[0] : projects.length === 1 ? projects[0] : null;
          if (!project) return { needsInput: true, message: projects.length === 0 ? "You do not have an existing project to attach this work request to. Should I prepare a new project request instead?" : `Which of your projects is this for? I found: ${projects.map((item) => item.name).slice(0, 10).join(", ")}.` };
        }
        return {
          workRequestDraft: { type, projectId: project?.id ?? null, projectName: project?.name ?? null, title, details, requestedDueAt: requestedDueAt ?? null },
          message: type === WorkRequestType.PROJECT ? "New project request prepared. Review the details and submit when ready." : `Work request prepared for ${project?.name}. Review the details and submit when ready.`,
        };
      },
    }),

    create_invitation: defineStudioTool({
      description: "Prepare a manager confirmation card for inviting a new client by email. Show the recipient email and Client role. Do not create the invitation or send email until the manager clicks Create invitation. If no email was supplied, ask for it. After confirmation, create a single-use seven-day link, email it to the recipient, and show the copyable link as a fallback.",
      parameters: z.object({
        email: z.string().trim().email().max(254).optional().describe("Email address of the client to invite"),
      }).strict(),
      execute: async ({ email }) => {
        if (role !== UserRole.MANAGER) {
          return { error: "Only managers can prepare client invitations." };
        }
        if (!email) {
          return { needsInput: true, message: "What email address should I prepare the client invitation for?" };
        }

        const parsed = createClientInvitationProposalSchema.safeParse({ email, role: UserRole.CLIENT });
        if (!parsed.success) {
          return { error: parsed.error.issues[0]?.message ?? "Enter a valid email address for the client invitation." };
        }

        return {
          requiresConfirmation: true,
          proposalType: "CREATE_INVITATION",
          title: "Invite Client",
          description: "After confirmation, this emails a single-use invitation link that expires in seven days. A copyable link is also provided. Creating a new invitation will revoke any unused invitation for this email.",
          invitationPreview: {
            email: parsed.data.email,
            role: parsed.data.role,
          },
          payload: parsed.data,
        };
      },
    }),

    // 4. CREATE PROJECT TOOL (State-mutating, Manager only)
    create_project: defineStudioTool({
      description: "Prepare a new production project. Include a concise description supplied by the user or draft one using only the context they provided. If they gave only a project name, use a neutral one-sentence description based on that name; do not invent clients, dates, deliverables, or other facts. Ask for the client's email if it was not supplied.",
      parameters: z.object({
        name: z.string().min(2).describe("Name of the project or campaign"),
        projectDescription: z.string().trim().max(1000).optional().describe("A concise project description, based only on details the user supplied. If there is no context beyond the name, use a neutral description such as 'Production project for [name].'"),
        clientEmail: z.string().email().optional().describe("Email of the active client account to associate with the project. If not supplied by the user, ask for it; never guess or use the manager's email."),
      }),
      execute: async ({ name, projectDescription, clientEmail }) => {
        if (role !== UserRole.MANAGER) {
          return { error: "Only managers are authorized to create projects." };
        }
        if (!clientEmail) {
          return {
            needsInput: true,
            message: "Which active client account should this project belong to? Please provide the client's email address.",
          };
        }

        const description = projectDescription?.trim() || `Production project for ${name}.`;

        // Check if confirmation is required (Safe Multi-Tier Mode)
        if (!autonomousExecution) {
          return {
            requiresConfirmation: true,
            proposalType: "CREATE_PROJECT",
            title: `Create Project: ${name}`,
            description: `Will create "${name}" for ${clientEmail} with this description: ${description}`,
            payload: { name, description, clientEmail },
          };
        }

        return createProjectForManager(userId, { name, description, clientEmail });
      },
    }),

    // 5. CREATE TASK BATCH TOOL (State-mutating, Manager only)
    create_task_batch: defineStudioTool({
      description: "Create and assign studio tasks. For a spreadsheet, pass one task object per data row, preserving each row's title, due date (YYYY-MM-DD), and assignee name or email. Never collapse distinct spreadsheet rows into one shared title or discard row details. For a general batch request, use taskCount and baseTitle instead. Leave assignee blank only when the sheet does not specify one; those tasks will be assigned by current workload.",
      parameters: z.object({
        projectId: z.string().optional().describe("Associated manager owned project ID"),
        tasks: z.array(z.object({
          title: z.string().trim().min(2).max(120).describe("Task title from this specific spreadsheet row"),
          dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("The row due date as YYYY-MM-DD"),
          assignee: z.string().trim().min(1).max(254).optional().describe("Worker name or email from the row; omit if the row has no assignee"),
          priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
        }).strict()).min(1).max(20).optional().describe("One entry per task row in an uploaded sheet"),
        taskCount: z.number().int().min(1).max(20).optional().describe("Number of generic tasks when no row data is provided"),
        baseTitle: z.string().trim().min(2).max(120).optional().describe("Shared base title for a generic task batch"),
        priority: z.enum(["LOW", "MEDIUM", "HIGH"]).default("MEDIUM"),
      }),
      execute: async (args) => {
        if (role !== UserRole.MANAGER) {
          return { error: "Only managers are authorized to create and assign tasks." };
        }
        const prepared = await prepareTaskBatchForManager(userId, args);
        if ("error" in prepared) return prepared;

        if (!autonomousExecution) {
          return {
            requiresConfirmation: true,
            proposalType: "CREATE_TASK_BATCH",
            title: `Create ${prepared.preview.length} Tasks`,
            description: `Will add these tasks to ${prepared.projectName}. Check each title, assignee, and due date before applying.`,
            preview: prepared.preview,
            payload: prepared.payload,
          };
        }

        return createTaskBatchForManager(userId, prepared.payload);
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
    ...(inventoryActionTool ? { prepare_inventory_action: inventoryActionTool } : {}),
  };
}
