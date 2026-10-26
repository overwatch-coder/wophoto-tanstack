import { z } from "zod"
import { InventoryCondition } from "@/generated/prisma/client"

const optionalDate = z
  .string()
  .optional()
  .nullable()
  .transform((value) => (value && value.trim() !== "" ? new Date(value) : null))
  .refine(
    (value) => value === null || Number.isFinite(value.getTime()),
    "Enter a valid date."
  )

const metadata = z
  .union([z.record(z.string(), z.unknown()), z.string()])
  .optional()
  .nullable()
  .transform((value, ctx) => {
    if (value === undefined) return undefined
    if (value === null || value === "") return {}
    let parsed: unknown = value
    if (typeof value === "string") {
      try {
        parsed = JSON.parse(value)
      } catch {
        ctx.addIssue({
          code: "custom",
          message: "Custom attributes must be valid JSON.",
        })
        return z.NEVER
      }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      ctx.addIssue({
        code: "custom",
        message: "Custom attributes must be an object.",
      })
      return z.NEVER
    }
    if (new TextEncoder().encode(JSON.stringify(parsed)).byteLength > 10_240) {
      ctx.addIssue({
        code: "custom",
        message: "Custom attributes must be 10 KB or smaller.",
      })
      return z.NEVER
    }
    return parsed as Record<string, unknown>
  })

export const createInventoryItemSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Asset name must be at least 2 characters.")
    .max(150),
  category: z.string().trim().max(50).default("General"),
  assetTag: z.string().trim().max(50).optional(),
  model: z.string().trim().max(100).optional().nullable(),
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  condition: z.enum(InventoryCondition).default(InventoryCondition.GOOD),
  location: z.string().trim().max(100).optional().nullable(),
  purchaseDate: optionalDate,
  metadata,
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const updateInventoryItemSchema = z.object({
  id: z.string().min(1),
  name: z
    .string()
    .trim()
    .min(2, "Asset name must be at least 2 characters.")
    .max(150)
    .optional(),
  category: z.string().trim().max(50).optional(),
  assetTag: z.string().trim().max(50).optional(),
  model: z.string().trim().max(100).optional().nullable(),
  serialNumber: z
    .string()
    .trim()
    .max(100)
    .optional()
    .nullable()
    .transform((val) => (val && val.trim() !== "" ? val.trim() : null)),
  condition: z.enum(InventoryCondition).optional(),
  location: z.string().trim().max(100).optional().nullable(),
  purchaseDate: optionalDate,
  metadata,
  notes: z.string().trim().max(2000).optional().nullable(),
})

export const retireInventoryItemSchema = z.object({
  id: z.string().min(1, "Item ID is required."),
  reason: z.string().trim().max(500).optional(),
})

export const retireInventoryItemsSchema = z
  .object({
    ids: z.array(z.string().min(1)).min(1).max(100),
    reason: z.string().trim().max(500).optional(),
  })
  .superRefine(({ ids }, ctx) => {
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({
        code: "custom",
        path: ["ids"],
        message: "Each selected asset must be unique.",
      })
    }
  })

export const checkoutInventoryItemSchema = z.object({
  itemId: z.string().min(1, "Item ID is required."),
  expectedReturnAt: optionalDate,
  notes: z.string().trim().max(500).optional().nullable(),
})

export const returnInventoryItemSchema = z
  .object({
    loanId: z.string().min(1, "Loan ID is required."),
    condition: z.enum(InventoryCondition).default(InventoryCondition.GOOD),
    notes: z.string().trim().max(1000).optional().nullable(),
    hasIssue: z.boolean().default(false),
    issueDetails: z.string().trim().max(2000).optional().nullable(),
  })
  .superRefine((value, ctx) => {
    if (
      value.condition === InventoryCondition.NEEDS_ATTENTION &&
      !value.hasIssue
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["hasIssue"],
        message:
          "Report the issue details before returning an item that needs attention.",
      })
    }
    if (value.hasIssue && !value.issueDetails?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["issueDetails"],
        message: "Describe the issue or damage.",
      })
    }
  })

export const resolveMaintenanceSchema = z.object({
  logId: z.string().min(1, "Maintenance ticket ID is required."),
  resolutionNotes: z
    .string()
    .trim()
    .min(3, "Resolution notes must be at least 3 characters.")
    .max(2000),
  restoredCondition: z
    .enum(InventoryCondition)
    .default(InventoryCondition.GOOD),
  cost: z
    .union([z.number(), z.string()])
    .optional()
    .nullable()
    .transform((val) => {
      if (val === undefined || val === null || val === "") return null
      const num = Number(val)
      return isNaN(num) || num < 0 ? null : num
    }),
})
