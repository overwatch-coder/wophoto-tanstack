import { describe, expect, it } from "vitest";
import {
  AI_PROVIDER_MODELS,
  DEFAULT_AI_MODELS,
  isAIModelAvailable,
  type AIProvider,
} from "@/lib/settings-preferences";

describe("AI provider model catalog", () => {
  const providers: AIProvider[] = ["OPENAI", "ANTHROPIC", "GEMINI", "GROK", "GROQ"];

  it.each(providers)("has a unique recommended model for %s", (provider) => {
    const options = AI_PROVIDER_MODELS[provider];
    const recommended = options.filter((option) => option.recommended);

    expect(new Set(options.map((option) => option.id)).size).toBe(options.length);
    expect(recommended).toHaveLength(1);
    expect(recommended[0].id).toBe(DEFAULT_AI_MODELS[provider]);
  });

  it("only accepts catalogued models for hosted providers", () => {
    expect(isAIModelAvailable("GROQ", "openai/gpt-oss-120b")).toBe(true);
    expect(isAIModelAvailable("GROQ", "qwen/qwen3.8-27b")).toBe(true);
    expect(isAIModelAvailable("GROQ", "gpt-6.1-sol")).toBe(false);
    expect(isAIModelAvailable("CUSTOM", "my-local-model")).toBe(true);
  });

  it("exposes the requested hosted model IDs with readable labels", () => {
    expect(AI_PROVIDER_MODELS.OPENAI.map(({ id }) => id)).toEqual([
      "gpt-6.1-sol", "gpt-6-astra", "gpt-6-luna", "gpt-5.6-terra", "gpt-4o", "gpt-4o-mini",
    ]);
    expect(AI_PROVIDER_MODELS.ANTHROPIC.map(({ id }) => id)).toEqual([
      "claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5",
    ]);
    expect(AI_PROVIDER_MODELS.GEMINI.map(({ id }) => id)).toEqual([
      "gemini-4-argon", "gemini-3.8-flash", "gemini-3.6-flash", "gemini-3.5-flash-lite",
    ]);
    expect(AI_PROVIDER_MODELS.GROK.map(({ id }) => id)).toEqual([
      "grok-4.7", "grok-4.3", "grok-4.20",
    ]);
    expect(AI_PROVIDER_MODELS.GROQ.map(({ id }) => id)).toEqual([
      "openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b",
    ]);
  });
});
