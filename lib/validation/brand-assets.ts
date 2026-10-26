import { z } from "zod"
import { BrandAssetType } from "@/generated/prisma/client"

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/
const isHttpUrl = (value: string | null | undefined) => {
  if (!value) return true
  try {
    const url = new URL(value)
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      Boolean(url.hostname)
    )
  } catch {
    return false
  }
}

export const colorSwatchSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Color name is required.")
    .max(50, "Color name must be 50 characters or fewer."),
  hex: z
    .string()
    .trim()
    .regex(HEX_COLOR_REGEX, "Enter a valid hex color code (e.g. #FF6B00).")
    .transform((val) => val.toUpperCase()),
  rgb: z.string().trim().max(30).optional().nullable(),
  pantone: z.string().trim().max(30).optional().nullable(),
})

export type ColorSwatch = z.infer<typeof colorSwatchSchema>

export const createBrandAssetSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Asset title is required.")
      .max(120, "Title must be 120 characters or fewer."),
    description: z
      .string()
      .trim()
      .max(2000, "Description must be 2000 characters or fewer.")
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    assetType: z.nativeEnum(BrandAssetType).default(BrandAssetType.LOGO),
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
    externalUrl: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null))
      .refine(isHttpUrl, "External URL must start with http:// or https://"),
    colorPalette: z
      .array(colorSwatchSchema)
      .max(20, "Maximum of 20 color swatches allowed.")
      .optional()
      .nullable()
      .transform((val) => (val && val.length > 0 ? val : null)),
    tags: z
      .array(z.string().trim())
      .optional()
      .default([])
      .transform((tags) =>
        tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
      ),
    clientId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
    projectId: z
      .string()
      .trim()
      .optional()
      .nullable()
      .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  })
  .refine(
    (data) =>
      Boolean(
        data.fileUrl ||
        data.externalUrl ||
        (data.colorPalette && data.colorPalette.length > 0)
      ),
    {
      message:
        "Asset must include an uploaded file, an external link, or at least one color swatch.",
      path: ["fileUrl"],
    }
  )

export const createBrandAssetsSchema = z
  .array(createBrandAssetSchema)
  .min(1, "Choose at least one asset to create.")
  .max(20, "You can add up to 20 brand assets at a time.")

export const updateBrandAssetSchema = z.object({
  id: z.string().trim().min(1, "Asset ID is required."),
  title: z
    .string()
    .trim()
    .min(1, "Asset title is required.")
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
  assetType: z.nativeEnum(BrandAssetType).optional(),
  fileUrl: z
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
  fileKey: z
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
  fileName: z
    .string()
    .trim()
    .max(255)
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined
        ? val && val.trim() !== ""
          ? val.trim()
          : null
        : undefined
    ),
  fileSize: z.number().int().nonnegative().optional().nullable(),
  fileMime: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined
        ? val && val.trim() !== ""
          ? val.trim()
          : null
        : undefined
    ),
  externalUrl: z
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
    )
    .refine(isHttpUrl, "External URL must start with http:// or https://"),
  colorPalette: z
    .array(colorSwatchSchema)
    .max(20, "Maximum of 20 color swatches allowed.")
    .optional()
    .nullable()
    .transform((val) =>
      val !== undefined ? (val && val.length > 0 ? val : null) : undefined
    ),
  tags: z
    .array(z.string().trim())
    .optional()
    .transform((tags) =>
      tags !== undefined
        ? tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0)
        : undefined
    ),
  clientId: z
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
})

export const deleteBrandAssetSchema = z.object({
  id: z.string().trim().min(1, "Asset ID is required."),
})

export const getBrandAssetsQuerySchema = z.object({
  clientId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  projectId: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  assetType: z
    .string()
    .trim()
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  scope: z
    .enum(["ALL", "STUDIO", "CLIENT", "PROJECT"])
    .optional()
    .default("ALL"),
  search: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(24),
})

export type CreateBrandAssetInput = z.infer<typeof createBrandAssetSchema>
export type UpdateBrandAssetInput = z.infer<typeof updateBrandAssetSchema>
export type GetBrandAssetsQueryInput = z.infer<typeof getBrandAssetsQuerySchema>
