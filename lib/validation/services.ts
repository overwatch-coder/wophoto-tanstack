import { z } from "zod";
import { idSchema } from "@/lib/validation/common";

const nameSchema = z.string().trim().min(2, "Service name must have at least 2 characters.").max(80, "Service name must be 80 characters or fewer.");
const descriptionSchema = z.string().trim().max(500, "Description must be 500 characters or fewer.").transform((value) => value || null);

export const createStudioServiceSchema = z.object({ name: nameSchema, description: descriptionSchema });
export const updateStudioServiceSchema = z.object({ id: idSchema, name: nameSchema, description: descriptionSchema });
export const setStudioServiceActiveSchema = z.object({ id: idSchema, isActive: z.boolean() });
