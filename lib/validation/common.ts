import { z, type ZodType } from "zod";

export class InputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InputValidationError";
  }
}

export const idSchema = z
  .string({ error: "Enter a valid ID." })
  .trim()
  .min(1, "This ID is required.")
  .max(191, "This ID is too long.");

export const optionalIdSchema = z
  .union([z.literal(""), idSchema])
  .transform((value) => (value === "" ? null : value));

export function parseInput<TSchema extends ZodType>(schema: TSchema, input: unknown): z.output<TSchema> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw new InputValidationError(result.error.issues[0]?.message ?? "Check the submitted information.");
  }
  return result.data;
}

export function firstSearchParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
