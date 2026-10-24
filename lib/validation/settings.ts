import { z } from "zod";

export const settingNotificationTypeSchema = z.enum([
  "FEEDBACK_RECEIVED",
  "FEEDBACK_RESOLVED",
  "REVISION_DELEGATED",
  "REVISION_SUBMITTED",
  "TASK_ASSIGNED",
  "TASK_REVIEW_READY",
  "TASK_APPROVED",
  "TASK_RETURNED",
  "DEADLINE_APPROACHING",
  "SYSTEM_ALERT",
]);

export const userPreferencePatchSchema = z.object({
  location: z.string().trim().max(120).nullable().optional(),
  notificationChannel: z.object({
    type: settingNotificationTypeSchema,
    channel: z.enum(["inApp", "email"]),
    enabled: z.boolean(),
  }).strict().optional(),
  density: z.enum(["COZY", "COMPACT"]).optional(),
  soundAlerts: z.boolean().optional(),
  defaultLanding: z.string().trim().max(120).optional(),
  workerAvailability: z.enum(["AVAILABLE", "IN_SHOOT", "FOCUS_MODE", "OFF_SHIFT"]).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Choose a setting to update.");

export type UserPreferencePatch = z.infer<typeof userPreferencePatchSchema>;
