import type { AIProvider } from "@/lib/settings-preferences";

export type ModelCapability = "supported" | "unsupported" | "unknown";

/**
 * Only classify models when capability is known. Custom endpoints and newly
 * released model IDs remain unknown so we do not incorrectly block them.
 */
export function getImageInputCapability(provider: AIProvider, model: string): ModelCapability {
  const normalizedModel = model.trim().toLowerCase();

  if (provider === "GROQ") {
    if (/^openai\/gpt-oss-(20b|120b)$/.test(normalizedModel)) return "unsupported";
    if (normalizedModel === "qwen/qwen3.8-27b") return "supported";
  }

  if (provider === "OPENAI" && /^(gpt-4o|gpt-4\.1)(-|$)/.test(normalizedModel)) {
    return "supported";
  }

  if (provider === "ANTHROPIC" && /^claude-/.test(normalizedModel)) return "supported";
  if (provider === "GEMINI" && /^gemini-/.test(normalizedModel)) return "supported";
  if (provider === "GROK" && /^grok-4\./.test(normalizedModel)) return "supported";

  return "unknown";
}

export function getImageCapabilityError(provider: AIProvider, model: string): string | null {
  if (getImageInputCapability(provider, model) !== "unsupported") return null;
  return `${model} does not accept image input. Select a vision capable model such as Qwen 3.8 27B in Groq, GPT-4o in OpenAI, or another supported vision model, then try again. Your attached documents and prompt are still available.`;
}
