import { z } from "zod";

export const copilotStudioPolicySchema = z.object({
  enabled: z.boolean(),
  workersEnabled: z.boolean(),
  clientsEnabled: z.boolean(),
  provider: z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "GROK", "GROQ", "CUSTOM"]),
  model: z.string().trim().min(1).max(100),
  apiKey: z.string().trim().max(500).optional(),
  clearApiKey: z.boolean().default(false),
  customEndpoint: z.string().trim().max(500).optional().refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (url.protocol === "http:" || url.protocol === "https:") && !url.username && !url.password;
    } catch {
      return false;
    }
  }, "Enter an HTTP or HTTPS endpoint without embedded credentials."),
  dailyRequestLimit: z.number().int().min(0).max(5000),
  overrides: z.array(z.object({
    userId: z.string().min(1).max(100),
    enabled: z.boolean().nullable(),
  }).strict()).max(500),
}).strict().refine((value) => value.provider === "CUSTOM" || value.model.length > 0, "Choose a model.");

export type CopilotStudioPolicyInput = z.infer<typeof copilotStudioPolicySchema>;
