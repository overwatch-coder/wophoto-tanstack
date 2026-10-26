import { z } from "zod";
import { FeedbackType, Specialization, TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { parsePage } from "@/lib/pagination";
import type { SearchParamsRecord } from "@/lib/pagination";
import { firstSearchParam, idSchema } from "./common";

const taskStatus = z.nativeEnum(TaskStatus).optional().catch(undefined);
const priority = z.nativeEnum(TaskPriority).optional().catch(undefined);
const specialization = z.nativeEnum(Specialization).optional().catch(undefined);
const feedbackType = z.nativeEnum(FeedbackType).optional().catch(undefined);

export function parsePageQuery(value: string | string[] | undefined) {
  return parsePage(value);
}

export function parseSearchText(value: string | string[] | undefined, max = 120) {
  return z.string().trim().max(max).catch("").parse(firstSearchParam(value));
}

export function parseTaskQuery(params: SearchParamsRecord) {
  return {
    page: parsePageQuery(params.page),
    query: parseSearchText(params.q),
    status: taskStatus.parse(firstSearchParam(params.status)),
    priority: priority.parse(firstSearchParam(params.priority)),
    specialization: specialization.parse(firstSearchParam(params.specialization)),
    taskId: idSchema.optional().catch(undefined).parse(firstSearchParam(params.taskId)),
    taskAction: z.enum(["view", "review"]).catch("view").parse(firstSearchParam(params.taskAction)),
  };
}

export function parseFeedbackQuery(params: SearchParamsRecord) {
  return {
    page: parsePageQuery(params.page),
    query: parseSearchText(params.q),
    type: feedbackType.parse(firstSearchParam(params.type)),
    status: z.enum(["ALL", "OPEN", "DELEGATED", "RESOLVED"]).catch("ALL").parse(firstSearchParam(params.status)),
    projectId: z.string().trim().max(100).catch("").parse(firstSearchParam(params.project)),
  };
}

export function parseProjectQuery(params: SearchParamsRecord) {
  return {
    page: parsePageQuery(params.page),
    query: parseSearchText(params.q),
    client: z.string().trim().max(120).catch("").parse(firstSearchParam(params.client)),
  };
}

export function parseInvitationQuery(params: SearchParamsRecord) {
  return {
    page: parsePageQuery(params.page),
    query: parseSearchText(params.q),
    filter: z.enum(["PENDING", "ACCEPTED", "WORKER", "CLIENT", "ALL"]).catch("ALL").parse(firstSearchParam(params.filter)),
  };
}

export function parseDeletedTaskQuery(params: SearchParamsRecord) {
  return {
    page: parsePageQuery(params.page),
    query: parseSearchText(params.q),
    project: z.string().trim().max(191).catch("").parse(firstSearchParam(params.project)),
    priority: priority.parse(firstSearchParam(params.priority)),
  };
}

export function parseLoginQuery(params: SearchParamsRecord) {
  return {
    error: z.enum([
      "InvitationRequired",
      "AccountMismatch",
      "OAuthAccountNotLinked",
      "AccountSuspended",
    ]).optional().catch(undefined).parse(firstSearchParam(params.error)),
    invite: z.enum(["accepted", "invalid"]).optional().catch(undefined).parse(firstSearchParam(params.invite)),
  };
}
