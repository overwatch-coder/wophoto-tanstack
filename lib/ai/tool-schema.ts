import { jsonSchema } from "ai";
import { z } from "zod";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ZodType } from "zod";

/** Converts Zod schemas to provider JSON Schema and validates tool input. */
export function createToolInputSchema<TOutput, TInput = TOutput>(
  schema: ZodType<TOutput, TInput>,
) {
  // Tool arguments arrive in the schema's input form. Serializing that side
  // preserves input types for fields that Zod transforms before validation
  // returns (for example, an ISO date string converted to a Date).
  const providerSchema = z.toJSONSchema(schema, { target: "draft-7", io: "input" });
  const providerObjectSchema = providerSchema as unknown as {
    $schema?: string;
    type?: string;
    additionalProperties?: boolean;
  };
  delete providerObjectSchema.$schema;
  // Keep the provider-facing object closed, as it was before serializing the
  // input side of transform schemas.
  if (providerObjectSchema.type === "object" && providerObjectSchema.additionalProperties === undefined) {
    providerObjectSchema.additionalProperties = false;
  }

  return jsonSchema<TOutput>(providerSchema as unknown as JSONSchema7, {
    validate(value) {
      const parsed = schema.safeParse(value);
      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: parsed.error };
    },
  });
}
