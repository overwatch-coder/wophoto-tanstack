import { z } from "zod";
import { TaskPriority, WorkRequestStatus, WorkRequestType } from "@/generated/prisma/client";
import { idSchema } from "@/lib/validation/common";

const dateSchema = z.string().trim().refine((value) => {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, "Enter a valid date.").transform((value) => value ? new Date(`${value}T00:00:00.000Z`) : null);

export const createWorkRequestSchema = z.object({
  type: z.nativeEnum(WorkRequestType),
  projectId: z.union([z.literal(""), idSchema]).optional().transform((value) => value || null),
  title: z.string().trim().min(2, "Title must be at least 2 characters.").max(160),
  details: z.string().trim().min(10, "Add at least 10 characters of detail.").max(5000),
  requestedDueAt: dateSchema.optional().transform((value) => value ?? null),
}).superRefine((value, context) => {
  if (value.type === WorkRequestType.WORK && !value.projectId) {
    context.addIssue({ code: "custom", path: ["projectId"], message: "Choose a project for this work request." });
  }
  if (value.type === WorkRequestType.PROJECT && value.projectId) {
    context.addIssue({ code: "custom", path: ["projectId"], message: "A new project request cannot reference an existing project." });
  }
});

export const respondToWorkRequestSchema = z.object({
  requestId: idSchema,
  title: z.string().trim().min(2).max(160),
  details: z.string().trim().min(10).max(5000),
  requestedDueAt: dateSchema.optional().transform((value) => value ?? null),
});

export const reviewWorkRequestSchema = z.object({
  requestId: idSchema,
  nextStatus: z.enum([WorkRequestStatus.NEEDS_INFO, WorkRequestStatus.DECLINED]),
  managerNote: z.string().trim().min(2, "Add a short note for the client.").max(3000),
});

export const acceptWorkRequestSchema = z.object({
  requestId: idSchema,
  workerIds: z.array(idSchema).min(1, "Choose at least one worker.").max(50),
  taskTitle: z.string().trim().min(2).max(160),
  priority: z.nativeEnum(TaskPriority).default(TaskPriority.MEDIUM),
  dueAt: dateSchema.optional().transform((value) => value ?? null),
});

export const workRequestQuerySchema = z.object({
  status: z.union([z.literal("ALL"), z.nativeEnum(WorkRequestStatus)]).default("ALL"),
  query: z.string().trim().max(120).default(""),
  cursor: z.union([z.literal(""), idSchema]).optional().transform((value) => value || null),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
