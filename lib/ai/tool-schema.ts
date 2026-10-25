import { jsonSchema } from "ai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ZodType } from "zod";

/** Converts Zod v4 schemas to provider JSON Schema and validates tool input. */
export function createToolInputSchema<T>(schema: ZodType<T>) {
  // Tool arguments arrive in the schema's input form. Serializing that side
  // preserves input types for fields that Zod transforms before validation
  // returns (for example, an ISO date string converted to a Date).
  const providerSchema = schema.toJSONSchema({
    target: "draft-7",
    io: "input",
  });
  delete providerSchema.$schema;
  // Keep the provider-facing object closed, as it was before serializing the
  // input side of transform schemas.
  if (providerSchema.type === "object" && providerSchema.additionalProperties === undefined) {
    providerSchema.additionalProperties = false;
  }

  return jsonSchema<T>(providerSchema as unknown as JSONSchema7, {
    validate(value) {
      const parsed = schema.safeParse(value);
      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: parsed.error };
    },
  });
}
