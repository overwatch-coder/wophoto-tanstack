import { z } from "zod"
import { BriefTemplateCategory, BriefStatus } from "@/generated/prisma/browser"
import { shotItemSchema, type ShotItem } from "@/lib/validation/briefs"

const HTTP_URL_REGEX = /^https?:\/\/.+/i

export const linkItemSchema = z.object({
  label: z
    .string()
    .trim()
    .min(1, "Link label is required.")
    .max(80, "Link label must be 80 characters or fewer."),
  url: z
    .string()
    .trim()
    .regex(
      HTTP_URL_REGEX,
      "Must be a valid web address starting with http:// or https://"
    )
    .max(500, "URL must be 500 characters or fewer."),
})

export type LinkItem = z.infer<typeof linkItemSchema>

export const createBriefTemplateSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Template title is required.")
    .max(150, "Template title must be 150 characters or fewer."),
  summary: z
    .string()
    .trim()
    .max(1000, "Summary must be 1000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  category: z.enum(BriefTemplateCategory),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty.")
        .max(30, "Tag must be 30 characters or fewer.")
        .toLowerCase()
    )
    .max(20, "Maximum of 20 tags permitted.")
    .optional()
    .default([]),
  deliverables: z
    .string()
    .trim()
    .max(5000, "Deliverables must be 5000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  guidelines: z
    .string()
    .trim()
    .max(5000, "Guidelines must be 5000 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  externalLinks: z
    .array(linkItemSchema)
    .max(10, "Maximum of 10 external links permitted.")
    .optional()
    .nullable()
    .default([]),
  shotList: z
    .array(shotItemSchema)
    .max(100, "A template cannot exceed 100 shot items.")
    .optional()
    .nullable()
    .default([]),
  coverImageUrl: z
    .string()
    .trim()
    .regex(
      HTTP_URL_REGEX,
      "Cover image URL must be a valid http or https address."
    )
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  attachmentUrl: z
    .string()
    .trim()
    .regex(
      HTTP_URL_REGEX,
      "Attachment URL must be a valid http or https address."
    )
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  attachmentName: z
    .string()
    .trim()
    .max(150, "Attachment name must be 150 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
})

export const updateBriefTemplateSchema = createBriefTemplateSchema.extend({
  id: z.string().trim().min(1, "Template ID is required."),
})

export const archiveBriefTemplateSchema = z.object({
  id: z.string().trim().min(1, "Template ID is required."),
})

export const convertBriefToTemplateSchema = z.object({
  briefId: z.string().trim().min(1, "Brief ID is required."),
  title: z
    .string()
    .trim()
    .min(1, "Template title is required.")
    .max(150, "Template title must be 150 characters or fewer."),
  category: z.enum(BriefTemplateCategory),
  tags: z
    .array(
      z
        .string()
        .trim()
        .min(1, "Tag cannot be empty.")
        .max(30, "Tag must be 30 characters or fewer.")
        .toLowerCase()
    )
    .max(20, "Maximum of 20 tags permitted.")
    .optional()
    .default([]),
})

const existingProjectTargetSchema = z.object({
  type: z.literal("EXISTING_PROJECT"),
  projectId: z.string().trim().min(1, "Project selection is required."),
  isPrimary: z.boolean().optional().default(false),
  title: z
    .string()
    .trim()
    .min(1, "Brief title cannot be empty.")
    .max(150, "Brief title must be 150 characters or fewer.")
    .optional(),
})

const newProjectTargetSchema = z.object({
  type: z.literal("NEW_PROJECT"),
  projectName: z
    .string()
    .trim()
    .min(1, "Project name is required.")
    .max(100, "Project name must be 100 characters or fewer."),
  clientId: z.string().trim().min(1, "Client selection is required."),
  description: z
    .string()
    .trim()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  title: z
    .string()
    .trim()
    .min(1, "Brief title cannot be empty.")
    .max(150, "Brief title must be 150 characters or fewer.")
    .optional(),
})

export const instantiateBriefFromTemplateSchema = z.object({
  templateId: z.string().trim().min(1, "Template ID is required."),
  target: z.discriminatedUnion("type", [
    existingProjectTargetSchema,
    newProjectTargetSchema,
  ]),
})

export const getBriefTemplatesQuerySchema = z.object({
  category: z.enum(BriefTemplateCategory).optional(),
  search: z.string().trim().optional(),
  tag: z.string().trim().optional(),
  includeArchived: z.coerce.boolean().optional().default(false),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(12),
})

export const getStudioBriefArchiveQuerySchema = z.object({
  search: z.string().trim().optional(),
  project: z.string().trim().optional(),
  client: z.string().trim().optional(),
  status: z.enum(BriefStatus).optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(50).optional().default(12),
})

export type CreateBriefTemplateInput = z.infer<typeof createBriefTemplateSchema>
export type UpdateBriefTemplateInput = z.infer<typeof updateBriefTemplateSchema>
export type ConvertBriefToTemplateInput = z.infer<
  typeof convertBriefToTemplateSchema
>
export type InstantiateBriefFromTemplateInput = z.infer<
  typeof instantiateBriefFromTemplateSchema
>
export type GetBriefTemplatesQuery = z.infer<
  typeof getBriefTemplatesQuerySchema
>
export type GetStudioBriefArchiveQuery = z.infer<
  typeof getStudioBriefArchiveQuerySchema
>
export { type ShotItem }
