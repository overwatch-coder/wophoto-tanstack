import { z } from "zod";
import { idSchema } from "./common";

export const createProjectSchema = z.object({
  name: z.string().trim().transform((value) => value.replace(/\s+/g, " ")).refine((value) => value.length >= 1 && value.length <= 120, "Project name must be between 1 and 120 characters."),
  description: z.string().trim().max(5000, "Description must be 5,000 characters or fewer.").transform((value) => value || null),
  clientId: idSchema,
});

export const addProjectClientSchema = z.object({
  projectId: idSchema,
  clientId: idSchema,
});
