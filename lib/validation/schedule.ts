import { z } from "zod"
import { ScheduleEventType } from "@/generated/prisma/client"

const parseDateInput = (value: unknown, ctx: z.RefinementCtx) => {
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." })
      return z.NEVER
    }
    return value
  }
  if (typeof value === "string" && value.trim() !== "") {
    const d = new Date(value)
    if (!Number.isFinite(d.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date string." })
      return z.NEVER
    }
    return d
  }
  ctx.addIssue({ code: "custom", message: "Date is required." })
  return z.NEVER
}

export const createScheduleEventSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Event title is required.")
      .max(120, "Title must be 120 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    eventType: z.nativeEnum(ScheduleEventType).default(ScheduleEventType.SHOOT),
    startAt: z.unknown().transform(parseDateInput),
    endAt: z.unknown().transform(parseDateInput),
    allDay: z.boolean().default(false),
    location: z
      .string()
      .trim()
      .max(100, "Location must be 100 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    projectId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    assigneeIds: z.array(z.string().trim()).optional().default([]),
  })
  .refine((data) => data.endAt.getTime() >= data.startAt.getTime(), {
    message: "End time must be equal to or later than start time.",
    path: ["endAt"],
  })

export const updateScheduleEventSchema = z
  .object({
    id: z.string().trim().min(1, "Event ID is required."),
    title: z
      .string()
      .trim()
      .min(1, "Event title is required.")
      .max(120, "Title must be 120 characters or fewer.")
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) =>
        val !== undefined
          ? val && val.trim() !== ""
            ? val.trim()
            : null
          : undefined
      ),
  eventType: z.nativeEnum(ScheduleEventType).optional(),
    startAt: z
      .unknown()
      .optional()
      .transform((val, ctx) =>
        val !== undefined ? parseDateInput(val, ctx) : undefined
      ),
    endAt: z
      .unknown()
      .optional()
      .transform((val, ctx) =>
        val !== undefined ? parseDateInput(val, ctx) : undefined
      ),
    allDay: z.boolean().optional(),
    location: z
      .string()
      .trim()
      .max(100, "Location must be 100 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) =>
        val !== undefined
          ? val && val.trim() !== ""
            ? val.trim()
            : null
          : undefined
      ),
    projectId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) =>
        val !== undefined
          ? val && val.trim() !== ""
            ? val.trim()
            : null
          : undefined
      ),
    assigneeIds: z.array(z.string().trim()).optional(),
  })
  .refine(
    (data) => {
      if (data.startAt && data.endAt) {
        return data.endAt.getTime() >= data.startAt.getTime()
      }
      return true
    },
    {
      message: "End time must be equal to or later than start time.",
      path: ["endAt"],
    }
  )

export const deleteScheduleEventSchema = z.object({
  id: z.string().trim().min(1, "Event ID is required."),
})

export const checkScheduleConflictsSchema = z
  .object({
    startAt: z.unknown().transform(parseDateInput),
    endAt: z.unknown().transform(parseDateInput),
    location: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    assigneeIds: z.array(z.string().trim()).optional().default([]),
    excludeEventId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  })
  .refine((data) => data.endAt.getTime() >= data.startAt.getTime(), {
    message: "End time must be equal to or later than start time.",
    path: ["endAt"],
  })

export const getScheduleEventsQuerySchema = z
  .object({
    startDate: z.unknown().transform(parseDateInput),
    endDate: z.unknown().transform(parseDateInput),
    projectId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    eventType: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  })
  .refine((data) => data.endDate.getTime() >= data.startDate.getTime(), {
    message: "End date must be equal to or later than start date.",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      data.endDate.getTime() - data.startDate.getTime() <=
      62 * 24 * 60 * 60 * 1000,
    {
      message: "Date range cannot exceed 62 days.",
      path: ["endDate"],
    }
  )

export type CreateScheduleEventInput = z.infer<typeof createScheduleEventSchema>
export type UpdateScheduleEventInput = z.infer<typeof updateScheduleEventSchema>
export type CheckScheduleConflictsInput = z.infer<
  typeof checkScheduleConflictsSchema
>
export type GetScheduleEventsQueryInput = z.infer<
  typeof getScheduleEventsQuerySchema
>
