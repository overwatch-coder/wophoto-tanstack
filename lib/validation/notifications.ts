import { z } from "zod";
import { idSchema } from "./common";

export const notificationFilterSchema = z.enum(["ALL", "UNREAD", "ACTION_REQUIRED"]);
export const notificationPageInputSchema = z.object({
  cursor: z.union([z.literal(""), idSchema]).optional().transform((value) => value || undefined),
  query: z.string().trim().max(160, "Search text is too long.").optional(),
  filterMode: notificationFilterSchema.optional().default("ALL"),
});

export const notificationIdSchema = idSchema;
