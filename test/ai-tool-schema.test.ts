import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createToolInputSchema } from "@/lib/ai/tool-schema";

describe("AI tool input schemas", () => {
  it("builds a provider-ready JSON object schema from Zod v4", () => {
    const schema = createToolInputSchema(z.object({
      query: z.string().trim().min(1),
      category: z.enum(["ALL", "REVIEWS"]).default("ALL"),
    }));

    expect(schema.jsonSchema).toMatchObject({
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string", enum: ["ALL", "REVIEWS"] },
      },
      additionalProperties: false,
    });
    expect(schema.jsonSchema).not.toHaveProperty("$schema");
  });

  it("validates and transforms tool input with the original Zod schema", async () => {
    const schema = createToolInputSchema(z.object({ query: z.string().trim().min(1) }));

    expect(schema.validate?.({ query: "  feedback  " })).toEqual({
      success: true,
      value: { query: "feedback" },
    });
    expect(schema.validate?.({ query: " " })).toMatchObject({ success: false });
  });
});
