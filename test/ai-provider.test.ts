import { afterEach, describe, expect, it } from "vitest";
import { createOpenAIResponsesFetch, resolveLanguageModel } from "@/lib/ai/provider";

const originalEnv = {
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  GROK_API_KEY: process.env.GROK_API_KEY,
  GROQ_API_KEY: process.env.GROQ_API_KEY,
  AI_ALLOWED_CUSTOM_HOSTS: process.env.AI_ALLOWED_CUSTOM_HOSTS,
};

afterEach(() => {
  if (originalEnv.OPENAI_API_KEY === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
  if (originalEnv.ANTHROPIC_API_KEY === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalEnv.ANTHROPIC_API_KEY;
  if (originalEnv.GEMINI_API_KEY === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalEnv.GEMINI_API_KEY;
  if (originalEnv.GROK_API_KEY === undefined) delete process.env.GROK_API_KEY;
  else process.env.GROK_API_KEY = originalEnv.GROK_API_KEY;
  if (originalEnv.GROQ_API_KEY === undefined) delete process.env.GROQ_API_KEY;
  else process.env.GROQ_API_KEY = originalEnv.GROQ_API_KEY;
  if (originalEnv.AI_ALLOWED_CUSTOM_HOSTS === undefined) delete process.env.AI_ALLOWED_CUSTOM_HOSTS;
  else process.env.AI_ALLOWED_CUSTOM_HOSTS = originalEnv.AI_ALLOWED_CUSTOM_HOSTS;
});

describe("AI provider resolution", () => {
  it.each([
    ["OPENAI", "OPENAI_API_KEY", "gpt-6.1-sol"],
    ["ANTHROPIC", "ANTHROPIC_API_KEY", "claude-sonnet-5-5"],
    ["GEMINI", "GEMINI_API_KEY", "gemini-4-argon"],
    ["GROK", "GROK_API_KEY", "grok-4.20"],
    ["GROQ", "GROQ_API_KEY", "openai/gpt-oss-120b"],
  ] as const)("uses the current recommended %s default", (provider, keyName, modelName) => {
    process.env[keyName] = "test-provider-key";

    const result = resolveLanguageModel({ provider, model: "" });

    expect(result.modelName).toBe(modelName);
  });

  it("resolves Groq through the Groq SDK adapter", () => {
    process.env.GROQ_API_KEY = "test-groq-key";
    const result = resolveLanguageModel({ provider: "GROQ", model: "openai/gpt-oss-120b" });

    expect(result.providerName).toBe("Groq");
    expect(result.modelName).toBe("openai/gpt-oss-120b");
  });

  it("routes GPT-6 models through the OpenAI Responses API adapter", () => {
    process.env.OPENAI_API_KEY = "test-openai-key";
    const result = resolveLanguageModel({ provider: "OPENAI", model: "gpt-6.1-sol" });

    expect(result.model.provider).toContain("responses");
  });

  it("removes unsupported sampling defaults from GPT-6 Responses requests only", async () => {
    const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
    const fetchMock: typeof fetch = async (input, init) => {
      requests.push({
        url: input instanceof Request ? input.url : String(input),
        body: JSON.parse(String(init?.body)) as Record<string, unknown>,
      });
      return new Response("{}", { status: 200 });
    };
    const compatibleFetch = createOpenAIResponsesFetch(fetchMock);

    await compatibleFetch("https://api.openai.com/v1/responses", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-6.1-sol", input: "hello", temperature: 0, top_p: 1 }),
    });
    await compatibleFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      body: JSON.stringify({ model: "gpt-4o", messages: [], temperature: 0 }),
    });

    expect(requests[0].body).not.toHaveProperty("temperature");
    expect(requests[0].body).not.toHaveProperty("top_p");
    expect(requests[1].body).toHaveProperty("temperature", 0);
  });

  it("reports a missing Groq server key without attempting a request", () => {
    delete process.env.GROQ_API_KEY;
    expect(() => resolveLanguageModel({ provider: "GROQ", model: "openai/gpt-oss-120b" }))
      .toThrow(/GROQ_API_KEY/);
  });

  it("rejects unapproved custom endpoints", () => {
    process.env.AI_ALLOWED_CUSTOM_HOSTS = "";
    expect(() => resolveLanguageModel({
      provider: "CUSTOM",
      model: "local-model",
      customEndpoint: "https://example.test/v1",
    })).toThrow(/host is not allowed/i);
  });

  it("allows explicitly approved custom endpoint hosts", () => {
    process.env.AI_ALLOWED_CUSTOM_HOSTS = "example.test";
    const result = resolveLanguageModel({
      provider: "CUSTOM",
      model: "local-model",
      customEndpoint: "https://example.test/v1",
    });
    expect(result.providerName).toBe("Self-Hosted AI");
    expect(result.modelName).toBe("local-model");
  });
});
