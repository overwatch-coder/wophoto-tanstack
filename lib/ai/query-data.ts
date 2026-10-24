import "server-only";

import { z } from "zod";
import { Prisma, UserRole } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

const queryValueSchema = z.union([
  z.string().trim().min(1).max(200),
  z.number().finite(),
  z.boolean(),
]);

const queryFilterSchema = z.object({
  field: z.string().trim().min(1).max(40),
  operator: z.enum(["EQUALS", "NOT_EQUALS", "CONTAINS", "BEFORE", "AFTER", "GTE", "LTE"]),
  value: queryValueSchema,
}).strict();

export const studioDataQuerySchema = z.object({
  entity: z.enum([
    "PROJECTS",
    "TASKS",
    "DELETED_TASKS",
    "FEEDBACK",
    "NOTIFICATIONS",
    "COMMENTS",
    "RATINGS",
    "INVITATIONS",
    "TEAM",
  ]),
  operation: z.enum(["LIST", "GET", "COUNT"]),
  recordId: z.string().trim().min(1).max(100).optional(),
  filters: z.array(queryFilterSchema).max(10).default([]),
  limit: z.number().int().min(1).max(20).default(10),
  offset: z.number().int().min(0).max(500).default(0),
}).strict().superRefine((input, ctx) => {
  if (input.operation === "GET" && !input.recordId) {
    ctx.addIssue({ code: "custom", message: "GET requires a recordId.", path: ["recordId"] });
  }
});

export type StudioDataQuery = z.infer<typeof studioDataQuerySchema>;

type QueryContext = { userId: string; role: UserRole };
type QueryOperator = z.infer<typeof queryFilterSchema>["operator"];
type QueryFilter = z.infer<typeof queryFilterSchema>;

const denied = (message: string) => ({ error: message });

function asString(value: string | number | boolean, field: string): string {
  if (typeof value !== "string") throw new Error(`${field} expects text.`);
  return value;
}

function asDate(value: string | number | boolean, field: string): Date {
  const raw = asString(value, field);
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error(`${field} expects an ISO date.`);
  return date;
}

function asNumber(value: string | number | boolean, field: string): number {
  if (typeof value !== "number") throw new Error(`${field} expects a number.`);
  return value;
}

function asBoolean(value: string | number | boolean, field: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${field} expects true or false.`);
  return value;
}

function stringCondition(filter: QueryFilter, field: string) {
  const value = asString(filter.value, field);
  if (filter.operator === "EQUALS") return { equals: value, mode: "insensitive" as const };
  if (filter.operator === "NOT_EQUALS") return { not: value };
  if (filter.operator === "CONTAINS") return { contains: value, mode: "insensitive" as const };
  throw new Error(`${filter.operator} is not supported for ${field}.`);
}

function enumCondition(filter: QueryFilter, field: string, allowed: readonly string[]) {
  const value = asString(filter.value, field).toUpperCase();
  if (!allowed.includes(value)) throw new Error(`${field} must be one of: ${allowed.join(", ")}.`);
  if (filter.operator === "EQUALS") return value;
  if (filter.operator === "NOT_EQUALS") return { not: value };
  throw new Error(`${filter.operator} is not supported for ${field}.`);
}

function dateCondition(filter: QueryFilter, field: string) {
  const value = asDate(filter.value, field);
  const operatorMap: Partial<Record<QueryOperator, string>> = {
    EQUALS: "equals",
    BEFORE: "lt",
    AFTER: "gt",
    GTE: "gte",
    LTE: "lte",
  };
  const operator = operatorMap[filter.operator];
  if (!operator) throw new Error(`${filter.operator} is not supported for ${field}.`);
  return { [operator]: value };
}

function numberCondition(filter: QueryFilter, field: string) {
  const value = asNumber(filter.value, field);
  const operatorMap: Partial<Record<QueryOperator, string>> = {
    EQUALS: "equals",
    NOT_EQUALS: "not",
    GTE: "gte",
    LTE: "lte",
  };
  const operator = operatorMap[filter.operator];
  if (!operator) throw new Error(`${filter.operator} is not supported for ${field}.`);
  return { [operator]: value };
}

function booleanCondition(filter: QueryFilter, field: string) {
  const value = asBoolean(filter.value, field);
  if (filter.operator === "EQUALS") return value;
  if (filter.operator === "NOT_EQUALS") return { not: value };
  throw new Error(`${filter.operator} is not supported for ${field}.`);
}

function getProjectScope(ctx: QueryContext): Prisma.ProjectWhereInput {
  if (ctx.role === UserRole.MANAGER) return { managerId: ctx.userId };
  if (ctx.role === UserRole.CLIENT) return { clientId: ctx.userId };
  return {
    tasks: { some: { deletedAt: null, assignees: { some: { userId: ctx.userId } } } },
  };
}

function getTaskScope(ctx: QueryContext, includeDeleted: boolean): Prisma.TaskWhereInput {
  const clauses: Prisma.TaskWhereInput[] = [
    includeDeleted ? { deletedAt: { not: null } } : { deletedAt: null },
  ];
  if (ctx.role === UserRole.MANAGER) clauses.push({ project: { managerId: ctx.userId } });
  else if (ctx.role === UserRole.WORKER) clauses.push({ assignees: { some: { userId: ctx.userId } } });
  else clauses.push({ id: "__client_tasks_are_not_available__" });
  return { AND: clauses };
}

function getFeedbackScope(ctx: QueryContext): Prisma.ClientFeedbackWhereInput {
  if (ctx.role === UserRole.MANAGER) return { project: { managerId: ctx.userId } };
  if (ctx.role === UserRole.WORKER) return { assignedWorkerId: ctx.userId };
  return { clientId: ctx.userId };
}

function getCommentScope(ctx: QueryContext): Prisma.CommentWhereInput {
  if (ctx.role === UserRole.MANAGER) return { project: { managerId: ctx.userId } };
  if (ctx.role === UserRole.CLIENT) {
    return { project: { clientId: ctx.userId }, visibility: "CLIENT_VISIBLE" };
  }
  return {
    task: { is: { assignees: { some: { userId: ctx.userId } } } },
  };
}

function getRatingScope(ctx: QueryContext): Prisma.RatingWhereInput {
  if (ctx.role === UserRole.MANAGER) return { project: { managerId: ctx.userId } };
  if (ctx.role === UserRole.CLIENT) return { clientId: ctx.userId };
  return { task: { is: { assignees: { some: { userId: ctx.userId } } } } };
}

function getInvitationScope(ctx: QueryContext): Prisma.InvitationWhereInput {
  if (ctx.role === UserRole.MANAGER) return { invitedById: ctx.userId };
  return { acceptedUserId: ctx.userId };
}

function projectTaskScope(ctx: QueryContext): Prisma.TaskWhereInput {
  return {
    deletedAt: null,
    ...(ctx.role === UserRole.WORKER ? { assignees: { some: { userId: ctx.userId } } } : {}),
  };
}

function deadlineWhere(value: string, ctx: QueryContext): Prisma.ProjectWhereInput {
  const now = new Date();
  const visibleTasks = projectTaskScope(ctx);
  if (value === "UPCOMING") {
    return { tasks: { some: { AND: [visibleTasks, { dueAt: { not: null, gte: now } }] } } };
  }
  if (value === "OVERDUE") {
    return {
      AND: [
        { tasks: { some: { AND: [visibleTasks, { dueAt: { not: null, lt: now } }] } } },
        { tasks: { none: { AND: [visibleTasks, { dueAt: { not: null, gte: now } }] } } },
      ],
    };
  }
  if (value === "NONE") {
    return { tasks: { none: { AND: [visibleTasks, { dueAt: { not: null } }] } } };
  }
  throw new Error("deadline must be UPCOMING, OVERDUE, or NONE.");
}

function projectStatusWhere(value: string, ctx: QueryContext): Prisma.ProjectWhereInput {
  const visibleTasks = projectTaskScope(ctx);
  if (value === "PLANNING") return { tasks: { none: visibleTasks } };
  if (value === "IN_REVIEW") return { tasks: { some: { AND: [visibleTasks, { status: "IN_REVIEW" }] } } };
  if (value === "IN_PROGRESS") {
    return {
      AND: [
        { tasks: { some: { AND: [visibleTasks, { status: { in: ["TODO", "IN_PROGRESS"] } }] } } },
        { tasks: { none: { AND: [visibleTasks, { status: "IN_REVIEW" }] } } },
      ],
    };
  }
  if (value === "COMPLETED") {
    return {
      AND: [
        { tasks: { some: visibleTasks } },
        { tasks: { none: { AND: [visibleTasks, { status: { not: "COMPLETED" } }] } } },
      ],
    };
  }
  throw new Error("status must be PLANNING, IN_PROGRESS, IN_REVIEW, or COMPLETED.");
}

function addFilterClause(entity: StudioDataQuery["entity"], filter: QueryFilter, ctx: QueryContext): Record<string, unknown> {
  const { field, operator } = filter;
  if (entity === "PROJECTS") {
    if (field === "name") return { name: stringCondition(filter, field) };
    if (field === "clientName") return { client: { name: stringCondition(filter, field) } };
    if (field === "description") return { description: stringCondition(filter, field) };
    if (field === "createdAt" || field === "updatedAt") return { [field]: dateCondition(filter, field) };
    if (field === "status" && operator === "EQUALS") return projectStatusWhere(asString(filter.value, field).toUpperCase(), ctx);
    if (field === "deadline" && operator === "EQUALS") return deadlineWhere(asString(filter.value, field).toUpperCase(), ctx);
  }

  if (entity === "TASKS" || entity === "DELETED_TASKS") {
    if (field === "title") return { title: stringCondition(filter, field) };
    if (field === "description") return { description: stringCondition(filter, field) };
    if (field === "projectName") return { project: { name: stringCondition(filter, field) } };
    if (field === "status") return { status: enumCondition(filter, field, ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]) };
    if (field === "priority") return { priority: enumCondition(filter, field, ["LOW", "MEDIUM", "HIGH"]) };
    if (field === "type") return { type: enumCondition(filter, field, ["ASSIGNED", "DAILY_ENTRY"]) };
    if (field === "dueAt" || field === "createdAt" || field === "updatedAt" || field === "deletedAt") {
      return { [field]: dateCondition(filter, field) };
    }
  }

  if (entity === "FEEDBACK") {
    if (field === "title" || field === "details" || field === "projectName") {
      return field === "projectName"
        ? { project: { name: stringCondition(filter, field) } }
        : { [field]: stringCondition(filter, field) };
    }
    if (field === "status") return { status: enumCondition(filter, field, ["NEW", "ASSIGNED_TO_WORKER", "IN_REVIEW", "RESOLVED"]) };
    if (field === "type") return { type: enumCondition(filter, field, ["REVISION", "REVIEW", "COMPLAINT"]) };
    if (field === "score") return { score: numberCondition(filter, field) };
    if (field === "createdAt" || field === "updatedAt") return { [field]: dateCondition(filter, field) };
  }

  if (entity === "NOTIFICATIONS") {
    if (field === "title" || field === "message") return { [field]: stringCondition(filter, field) };
    if (field === "type") return { type: enumCondition(filter, field, [
      "FEEDBACK_RECEIVED", "FEEDBACK_RESOLVED", "REVISION_DELEGATED", "REVISION_SUBMITTED",
      "TASK_ASSIGNED", "TASK_REVIEW_READY", "TASK_APPROVED", "TASK_RETURNED", "DEADLINE_APPROACHING", "SYSTEM_ALERT",
    ]) };
    if (field === "category") return { category: enumCondition(filter, field, ["ACTION_REQUIRED", "UPDATE", "SYSTEM"]) };
    if (field === "read" || field === "emailSent") return { [field]: booleanCondition(filter, field) };
    if (field === "createdAt") return { createdAt: dateCondition(filter, field) };
  }

  if (entity === "COMMENTS") {
    if (field === "body" || field === "projectName" || field === "taskTitle") {
      if (field === "projectName") return { project: { name: stringCondition(filter, field) } };
      if (field === "taskTitle") return { task: { is: { title: stringCondition(filter, field) } } };
      return { body: stringCondition(filter, field) };
    }
    if (field === "visibility") return { visibility: enumCondition(filter, field, ["INTERNAL", "CLIENT_VISIBLE"]) };
    if (field === "createdAt") return { createdAt: dateCondition(filter, field) };
  }

  if (entity === "RATINGS") {
    if (field === "feedback" || field === "projectName" || field === "taskTitle") {
      if (field === "projectName") return { project: { name: stringCondition(filter, field) } };
      if (field === "taskTitle") return { task: { is: { title: stringCondition(filter, field) } } };
      return { feedback: stringCondition(filter, field) };
    }
    if (field === "score") return { score: numberCondition(filter, field) };
    if (field === "createdAt") return { createdAt: dateCondition(filter, field) };
  }

  if (entity === "INVITATIONS") {
    if (field === "email") return { email: stringCondition(filter, field) };
    if (field === "status") return { status: enumCondition(filter, field, ["PENDING", "ACCEPTED", "REVOKED", "USED"]) };
    if (field === "role") return { role: enumCondition(filter, field, ["MANAGER", "WORKER", "CLIENT"]) };
    if (field === "createdAt" || field === "expiresAt" || field === "acceptedAt") return { [field]: dateCondition(filter, field) };
  }

  if (entity === "TEAM") {
    if (field === "name") return { name: stringCondition(filter, field) };
    if (field === "status") return { status: enumCondition(filter, field, ["ACTIVE", "SUSPENDED"]) };
    if (field === "specialization") return {
      specializations: { some: { specialization: enumCondition(filter, field, [
        "PHOTOGRAPHY", "VIDEOGRAPHY", "CONTENT_CREATION", "GRAPHIC_DESIGN", "WEB_CREATION",
      ]) } },
    };
  }

  throw new Error(`Field '${field}' does not support ${operator} for ${entity}.`);
}

function getEntityWhere(ctx: QueryContext, input: StudioDataQuery) {
  const clauses: Record<string, unknown>[] = [];
  if (input.entity === "PROJECTS") clauses.push(getProjectScope(ctx));
  else if (input.entity === "TASKS") clauses.push(getTaskScope(ctx, false));
  else if (input.entity === "DELETED_TASKS") {
    if (ctx.role !== UserRole.MANAGER) throw new Error("Deleted tasks can only be queried by a manager.");
    clauses.push(getTaskScope(ctx, true));
  } else if (input.entity === "FEEDBACK") clauses.push(getFeedbackScope(ctx));
  else if (input.entity === "NOTIFICATIONS") clauses.push({ userId: ctx.userId, inAppVisible: true });
  else if (input.entity === "COMMENTS") clauses.push(getCommentScope(ctx));
  else if (input.entity === "RATINGS") clauses.push(getRatingScope(ctx));
  else if (input.entity === "INVITATIONS") clauses.push(getInvitationScope(ctx));
  else if (input.entity === "TEAM") {
    if (ctx.role === UserRole.MANAGER) {
      clauses.push({ role: UserRole.WORKER, acceptedInvitation: { is: { invitedById: ctx.userId } } });
    } else if (ctx.role === UserRole.WORKER) {
      clauses.push({ id: ctx.userId, role: UserRole.WORKER });
    } else {
      throw new Error("Client accounts cannot query internal team records.");
    }
  }

  if (input.operation === "GET" && input.recordId) clauses.push({ id: input.recordId });
  for (const filter of input.filters) clauses.push(addFilterClause(input.entity, filter, ctx));
  return { AND: clauses };
}

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { name: string | null };
};

async function projectSummaries(rows: ProjectRow[], ctx: QueryContext) {
  const ids = rows.map((project) => project.id);
  if (!ids.length) return new Map<string, { status: string; totalTasks: number; completedTasks: number; deadline: Date | null }>();
  const [taskStates, deadlines] = await Promise.all([
    prisma.task.groupBy({
      by: ["projectId", "status"],
      where: { projectId: { in: ids }, ...projectTaskScope(ctx) },
      _count: { _all: true },
    }),
    prisma.task.groupBy({
      by: ["projectId"],
      where: { projectId: { in: ids }, ...projectTaskScope(ctx), dueAt: { not: null } },
      _max: { dueAt: true },
    }),
  ]);
  const summaries = new Map<string, { totalTasks: number; completedTasks: number; inReview: boolean; deadline: Date | null }>();
  for (const row of taskStates) {
    const summary = summaries.get(row.projectId) ?? { totalTasks: 0, completedTasks: 0, inReview: false, deadline: null };
    summary.totalTasks += row._count._all;
    if (row.status === "COMPLETED") summary.completedTasks += row._count._all;
    if (row.status === "IN_REVIEW") summary.inReview = true;
    summaries.set(row.projectId, summary);
  }
  for (const row of deadlines) {
    const summary = summaries.get(row.projectId) ?? { totalTasks: 0, completedTasks: 0, inReview: false, deadline: null };
    summary.deadline = row._max.dueAt;
    summaries.set(row.projectId, summary);
  }
  return new Map([...summaries.entries()].map(([projectId, value]) => [projectId, {
    ...value,
    status: value.totalTasks === 0
      ? "PLANNING"
      : value.completedTasks === value.totalTasks
        ? "COMPLETED"
        : value.inReview
          ? "IN_REVIEW"
          : "IN_PROGRESS",
  }]));
}

async function countEntity(entity: StudioDataQuery["entity"], where: Record<string, unknown>) {
  switch (entity) {
    case "PROJECTS": return prisma.project.count({ where: where as Prisma.ProjectWhereInput });
    case "TASKS":
    case "DELETED_TASKS": return prisma.task.count({ where: where as Prisma.TaskWhereInput });
    case "FEEDBACK": return prisma.clientFeedback.count({ where: where as Prisma.ClientFeedbackWhereInput });
    case "NOTIFICATIONS": return prisma.notification.count({ where: where as Prisma.NotificationWhereInput });
    case "COMMENTS": return prisma.comment.count({ where: where as Prisma.CommentWhereInput });
    case "RATINGS": return prisma.rating.count({ where: where as Prisma.RatingWhereInput });
    case "INVITATIONS": return prisma.invitation.count({ where: where as Prisma.InvitationWhereInput });
    case "TEAM": return prisma.user.count({ where: where as Prisma.UserWhereInput });
  }
}

async function listEntity(entity: StudioDataQuery["entity"], where: Record<string, unknown>, take: number, skip: number, role: UserRole) {
  switch (entity) {
    case "PROJECTS":
      return prisma.project.findMany({
        where: where as Prisma.ProjectWhereInput,
        select: { id: true, name: true, description: true, createdAt: true, updatedAt: true, client: { select: { name: true } } },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "TASKS":
    case "DELETED_TASKS":
      return prisma.task.findMany({
        where: where as Prisma.TaskWhereInput,
        select: {
          id: true, title: true, description: true, type: true, status: true, priority: true,
          dueAt: true, deletedAt: true, createdAt: true, updatedAt: true,
          project: { select: { name: true } },
          assignees: { select: { user: { select: { name: true } } } },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "FEEDBACK":
      return prisma.clientFeedback.findMany({
        where: where as Prisma.ClientFeedbackWhereInput,
        select: {
          id: true, type: true, status: true, score: true, title: true, details: true,
          responseNote: role === UserRole.CLIENT || role === UserRole.MANAGER,
          delegationNote: role === UserRole.WORKER || role === UserRole.MANAGER,
          workerNote: role === UserRole.WORKER || role === UserRole.MANAGER,
          createdAt: true, updatedAt: true,
          project: { select: { name: true } }, task: { select: { title: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "NOTIFICATIONS":
      return prisma.notification.findMany({
        where: where as Prisma.NotificationWhereInput,
        select: {
          id: true, type: true, category: true, title: true, message: true, read: true,
          createdAt: true, project: { select: { name: true } },
          task: { select: { title: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "COMMENTS":
      return prisma.comment.findMany({
        where: where as Prisma.CommentWhereInput,
        select: {
          id: true, body: true, visibility: true, createdAt: true,
          project: { select: { name: true } }, task: { select: { title: true } },
          author: { select: { name: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "RATINGS":
      return prisma.rating.findMany({
        where: where as Prisma.RatingWhereInput,
        select: {
          id: true, score: true, feedback: true, createdAt: true,
          project: { select: { name: true } }, task: { select: { title: true } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "INVITATIONS":
      return prisma.invitation.findMany({
        where: where as Prisma.InvitationWhereInput,
        select: { id: true, email: true, role: true, status: true, createdAt: true, expiresAt: true, acceptedAt: true },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }], take, skip,
      });
    case "TEAM":
      return prisma.user.findMany({
        where: where as Prisma.UserWhereInput,
        select: {
          id: true, name: true, role: true, status: true,
          specializations: { select: { specialization: true } },
          preferences: { select: { workerAvailability: true } },
          taskAssignments: {
            where: { task: { deletedAt: null, status: { in: ["TODO", "IN_PROGRESS", "IN_REVIEW"] } } },
            select: { taskId: true },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }], take, skip,
      });
  }
}

function projectRecordRows(
  rows: Array<{ id: string; name: string; description: string | null; createdAt: Date; updatedAt: Date; client: { name: string | null } }>,
  summaries: Awaited<ReturnType<typeof projectSummaries>>,
) {
  return rows.map((project) => {
    const summary = summaries.get(project.id) ?? { status: "PLANNING", totalTasks: 0, completedTasks: 0, inReview: false, deadline: null };
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      clientName: project.client.name,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      status: summary.status,
      taskCount: summary.totalTasks,
      completedTaskCount: summary.completedTasks,
      deadline: summary.deadline?.toISOString() ?? null,
    };
  });
}

function serializeRows(entity: StudioDataQuery["entity"], rows: unknown[]) {
  if (entity === "TASKS" || entity === "DELETED_TASKS") {
    return (rows as Array<Record<string, unknown>>).map((row) => ({
      ...row,
      dueAt: row.dueAt instanceof Date ? row.dueAt.toISOString() : null,
      deletedAt: row.deletedAt instanceof Date ? row.deletedAt.toISOString() : null,
      createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : undefined,
      updatedAt: row.updatedAt instanceof Date ? row.updatedAt.toISOString() : undefined,
    }));
  }
  return rows;
}

export async function queryStudioData(ctx: QueryContext, input: StudioDataQuery) {
  try {
    if (input.entity === "TASKS" && ctx.role === UserRole.CLIENT) {
      return denied("Client accounts cannot query internal task records.");
    }
    const where = getEntityWhere(ctx, input);
    if (input.operation === "COUNT") {
      const count = await countEntity(input.entity, where);
      return {
        entity: input.entity,
        operation: "COUNT",
        count,
        message: `${count} ${input.entity.toLowerCase().replaceAll("_", " ")} records match the requested filters.`,
      };
    }

    const skip = input.operation === "GET" ? 0 : input.offset;
    const take = input.operation === "GET" ? 1 : input.limit + 1;
    const totalMatching = await countEntity(input.entity, where);
    const rawRows = await listEntity(input.entity, where, take, skip, ctx.role) as unknown[];
    const hasMore = input.operation === "LIST" && rawRows.length > input.limit;
    const rows = hasMore ? rawRows.slice(0, input.limit) : rawRows;
    let records: unknown[];

    if (input.entity === "PROJECTS") {
      const projectRows = rows as ProjectRow[];
      records = projectRecordRows(projectRows, await projectSummaries(projectRows, { userId: ctx.userId, role: ctx.role }));
    } else {
      records = serializeRows(input.entity, rows);
    }

    return {
      entity: input.entity,
      operation: input.operation,
      totalMatching,
      returned: records.length,
      records,
      ...(input.operation === "LIST" ? {
        page: { limit: input.limit, offset: input.offset, hasMore, nextOffset: hasMore ? input.offset + input.limit : null },
      } : {}),
    };
  } catch (error) {
    return denied(error instanceof Error ? error.message : "The database query could not be completed.");
  }
}
