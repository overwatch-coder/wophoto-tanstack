import { z } from "zod";
import { Specialization, TaskPriority, TaskStatus } from "@/generated/prisma/client";
import { idSchema } from "./common";

const prioritySchema = z.nativeEnum(TaskPriority);
const specializationSchema = z.nativeEnum(Specialization);
const workerIdsSchema = z.array(idSchema).min(1, "Choose at least one worker.").max(50, "Choose no more than 50 workers.");
const specializationsSchema = z.array(specializationSchema).max(5, "Choose valid specializations.").transform((items) => [...new Set(items)]);

function isCalendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const dateSchema = z.string().trim().refine((value) => !value || isCalendarDate(value), "Enter a valid date.")
  .transform((value) => value ? new Date(`${value}T00:00:00.000Z`) : null);

const taskFieldShape = {
  title: z.string().trim().min(1, "Title must be between 1 and 160 characters.").max(160, "Title must be between 1 and 160 characters."),
  description: z.string().trim().max(5000, "Description must be 5,000 characters or fewer.").transform((value) => value || null),
  priority: z.union([z.literal(""), prioritySchema]).optional().transform((value) => value || TaskPriority.MEDIUM),
  startAt: dateSchema,
  dueAt: dateSchema,
};

export const taskFieldsSchema = z.object(taskFieldShape).superRefine((value, context) => {
  if (value.startAt && value.dueAt && value.dueAt < value.startAt) {
    context.addIssue({ code: "custom", path: ["dueAt"], message: "The due date cannot be before the start date." });
  }
});

const taskFieldsRefinement = <T extends { startAt: Date | null; dueAt: Date | null }>(value: T, context: z.RefinementCtx) => {
  if (value.startAt && value.dueAt && value.dueAt < value.startAt) {
    context.addIssue({ code: "custom", path: ["dueAt"], message: "The due date cannot be before the start date." });
  }
};

export const createAssignedTaskSchema = z.object({
  projectId: idSchema,
  ...taskFieldShape,
  workerIds: workerIdsSchema,
  specializations: specializationsSchema,
}).superRefine(taskFieldsRefinement);

export const updateAssignedTaskSchema = z.object({
  taskId: idSchema,
  ...taskFieldShape,
  workerIds: workerIdsSchema,
  specializations: specializationsSchema,
}).superRefine(taskFieldsRefinement);

export const dailyEntrySchema = z.object({
  projectId: idSchema,
  ...taskFieldShape,
  workDate: dateSchema,
}).superRefine(taskFieldsRefinement);

export const updateDailyEntrySchema = z.object({
  taskId: idSchema,
  ...taskFieldShape,
  workDate: dateSchema.refine((value) => value !== null, "Choose today or a past work date."),
}).superRefine(taskFieldsRefinement);

export const assignmentStatusSchema = z.enum([
  TaskStatus.TODO,
  TaskStatus.IN_PROGRESS,
  TaskStatus.IN_REVIEW,
]);

export const taskStatusSchema = z.nativeEnum(TaskStatus);

export const reviewTaskSchema = z.object({
  taskId: idSchema,
  decision: z.enum(["approve", "return"]),
  returnUserIds: z.array(idSchema).max(50, "Select no more than 50 workers."),
  managerNote: z.string().trim().max(3000, "Add a note of up to 3,000 characters."),
}).superRefine((value, context) => {
  if (value.decision === "return") {
    if (!value.managerNote) context.addIssue({ code: "custom", path: ["managerNote"], message: "Add a note of up to 3,000 characters for the selected workers." });
    if (!value.returnUserIds.length) context.addIssue({ code: "custom", path: ["returnUserIds"], message: "Select at least one assigned worker to resubmit." });
  }
});

export const taskIdSchema = idSchema;
export const restoreTaskIdsSchema = z.array(idSchema).min(1, "Select at least one valid task to restore.").max(100, "Restore up to 100 tasks at a time.");
