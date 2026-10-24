import { jsonSchema } from "ai";
import type { JSONSchema7 } from "@ai-sdk/provider";
import type { ZodType } from "zod";

/** Converts Zod v4 schemas to provider JSON Schema and validates tool input. */
export function createToolInputSchema<T>(schema: ZodType<T>) {
  const providerSchema = schema.toJSONSchema({ target: "draft-7" });
  delete providerSchema.$schema;

  return jsonSchema<T>(providerSchema as unknown as JSONSchema7, {
    validate(value) {
      const parsed = schema.safeParse(value);
      return parsed.success
        ? { success: true, value: parsed.data }
        : { success: false, error: parsed.error };
    },
  });
}
