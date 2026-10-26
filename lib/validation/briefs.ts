import { z } from "zod";
import { BriefStatus } from "@/generated/prisma/browser";

const HTTP_URL_REGEX = /^https?:\/\/.+/i;

export const SHOT_FRAMING_OPTIONS = [
  "WIDE",
  "MEDIUM",
  "CLOSE_UP",
  "EXTREME_CLOSE_UP",
  "TOP_DOWN",
  "DETAIL",
] as const;

export const SHOT_STATUS_OPTIONS = [
  "PLANNED",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
] as const;

export type ShotFraming = (typeof SHOT_FRAMING_OPTIONS)[number];
export type ShotStatus = (typeof SHOT_STATUS_OPTIONS)[number];

export const shotItemSchema = z.object({
  id: z.string().trim().min(1, "Shot ID is required."),
  title: z
    .string()
    .trim()
    .min(1, "Shot title is required.")
    .max(150, "Shot title must be 150 characters or fewer."),
  description: z
    .string()
    .trim()
    .max(1000, "Description must be 1000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  props: z
    .array(z.string().trim().min(1))
    .optional()
    .default([]),
  framing: z.enum(SHOT_FRAMING_OPTIONS).optional().default("MEDIUM"),
  status: z.enum(SHOT_STATUS_OPTIONS).default("PLANNED"),
  order: z.number().int().nonnegative().default(0),
});

export type ShotItem = z.infer<typeof shotItemSchema>;

export const createCreativeBriefSchema = z.object({
  projectId: z.string().trim().min(1, "Project selection is required."),
  title: z
    .string()
    .trim()
    .min(1, "Brief title is required.")
    .max(150, "Brief title must be 150 characters or fewer."),
  summary: z
    .string()
    .trim()
    .max(2000, "Summary must be 2000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  deliverables: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  guidelines: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  shotList: z
    .array(shotItemSchema)
    .optional()
    .nullable()
    .transform((val) => (val && val.length > 0 ? val : null)),
  externalUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null))
    .refine(
      (val) => val === null || HTTP_URL_REGEX.test(val),
      "External URL must start with http:// or https://"
    ),
  fileUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  fileKey: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  fileMime: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  isPrimary: z.boolean().default(false),
  tags: z
    .array(z.string().trim())
    .optional()
    .default([])
    .transform((tags) =>
      tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
    ),
});

export const updateCreativeBriefSchema = z.object({
  id: z.string().trim().min(1, "Brief ID is required."),
  title: z
    .string()
    .trim()
    .min(1, "Brief title is required.")
    .max(150, "Brief title must be 150 characters or fewer.")
    .optional(),
  summary: z
    .string()
    .trim()
    .max(2000, "Summary must be 2000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  deliverables: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  guidelines: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  shotList: z
    .array(shotItemSchema)
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.length > 0 ? val : null) : undefined
    ),
  externalUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    )
    .refine(
      (val) => val === undefined || val === null || HTTP_URL_REGEX.test(val),
      "External URL must start with http:// or https://"
    ),
  fileUrl: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  fileKey: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  fileMime: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
  isPrimary: z.boolean().optional(),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((tags) =>
      tags !== undefined
        ? tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
        : undefined
    ),
  majorRevision: z.boolean().optional().default(false),
  revisionSummary: z
    .string()
    .trim()
    .max(1000, "Revision summary must be 1000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.trim() !== "" ? val.trim() : null) : undefined
    ),
});

export const setBriefStatusSchema = z.object({
  id: z.string().trim().min(1, "Brief ID is required."),
  status: z.nativeEnum(BriefStatus),
  reason: z
    .string()
    .trim()
    .max(500, "Reason must be 500 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
});

export const submitBriefSignOffSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  version: z.number().int().min(1, "Valid brief version is required."),
  note: z
    .string()
    .trim()
    .max(1000, "Sign-off note must be 1000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
});

export const waiveBriefSignOffSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  userId: z.string().trim().min(1, "User ID is required."),
  reason: z
    .string()
    .trim()
    .min(1, "Waive reason is required.")
    .max(500, "Waive reason must be 500 characters or fewer."),
});

export const addBriefReviewerSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  userId: z.string().trim().min(1, "User ID is required."),
});

export const removeBriefReviewerSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  userId: z.string().trim().min(1, "User ID is required."),
});

export const updateShotItemStatusSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  shotId: z.string().trim().min(1, "Shot ID is required."),
  status: z.enum(SHOT_STATUS_OPTIONS),
});

export const postBriefQuestionSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  content: z
    .string()
    .trim()
    .min(1, "Question or comment cannot be empty.")
    .max(2000, "Message must be 2000 characters or fewer."),
  isBlocker: z.boolean().optional().default(false),
  parentId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
});

export const resolveBriefQuestionSchema = z.object({
  questionId: z.string().trim().min(1, "Question ID is required."),
  isResolved: z.boolean().default(true),
});

export const getProjectBriefsQuerySchema = z.object({
  projectName: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  page: z.coerce.number().int().min(1).max(10000).optional().default(1),
  status: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  search: z
    .string()
    .trim()
    .max(100)
    .optional()
    .default(""),
});

export type CreateCreativeBriefInput = z.infer<typeof createCreativeBriefSchema>;
export type UpdateCreativeBriefInput = z.infer<typeof updateCreativeBriefSchema>;
export type SetBriefStatusInput = z.infer<typeof setBriefStatusSchema>;
export type SubmitBriefSignOffInput = z.infer<typeof submitBriefSignOffSchema>;
export type WaiveBriefSignOffInput = z.infer<typeof waiveBriefSignOffSchema>;
export type AddBriefReviewerInput = z.infer<typeof addBriefReviewerSchema>;
export type RemoveBriefReviewerInput = z.infer<typeof removeBriefReviewerSchema>;
export type UpdateShotItemStatusInput = z.infer<typeof updateShotItemStatusSchema>;
export type PostBriefQuestionInput = z.infer<typeof postBriefQuestionSchema>;
export type ResolveBriefQuestionInput = z.infer<typeof resolveBriefQuestionSchema>;
export type GetProjectBriefsQueryInput = z.infer<typeof getProjectBriefsQuerySchema>;
