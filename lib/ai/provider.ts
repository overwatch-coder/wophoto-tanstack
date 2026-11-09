
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import type { LanguageModelV3 } from "@ai-sdk/provider";
import { AIProvider } from "@/lib/settings-preferences";

export interface AIProviderConfig {
  provider: AIProvider;
  model: string;
  customApiKey?: string | null;
  customEndpoint?: string | null;
}

/**
 * The AI SDK's OpenAI adapter defaults temperature to 0. GPT-6 reasoning models reject
 * temperature and top_p, so remove those defaults from Responses API requests.
 */
export function createOpenAIResponsesFetch(baseFetch: typeof fetch = fetch): typeof fetch {
  return async (input, init) => {
    const url = input instanceof Request ? input.url : String(input);
    if (!url.endsWith("/responses") || typeof init?.body !== "string") {
      return baseFetch(input, init);
    }

    let body: Record<string, unknown>;
    try {
      body = JSON.parse(init.body) as Record<string, unknown>;
    } catch {
      return baseFetch(input, init);
    }

    if (typeof body.model !== "string" || !body.model.startsWith("gpt-6")) {
      return baseFetch(input, init);
    }

    delete body.temperature;
    delete body.top_p;
    return baseFetch(input, { ...init, body: JSON.stringify(body) });
  };
}

function validateCustomEndpoint(rawEndpoint: string): string {
  let endpoint: URL;
  try {
    endpoint = new URL(rawEndpoint);
  } catch {
    throw new Error("Enter a valid HTTP(S) custom AI endpoint.");
  }
  if (endpoint.protocol !== "https:" && endpoint.protocol !== "http:") {
    throw new Error("The custom AI endpoint must use HTTP or HTTPS.");
  }
  if (endpoint.username || endpoint.password) {
    throw new Error("Do not include credentials in the custom AI endpoint URL.");
  }

  const host = endpoint.hostname.toLowerCase();
  const allowedHosts = (process.env.AI_ALLOWED_CUSTOM_HOSTS ?? "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const loopbackHosts = ["localhost", "127.0.0.1", "::1", "[::1]"];
  const developmentLoopback = process.env.NODE_ENV !== "production" && loopbackHosts.includes(host);
  if (!developmentLoopback && !allowedHosts.includes(host)) {
    throw new Error("This custom AI host is not allowed. Add its hostname to AI_ALLOWED_CUSTOM_HOSTS.");
  }
  return endpoint.toString().replace(/\/$/, "");
}

export function resolveLanguageModel(config: AIProviderConfig): {
  model: LanguageModelV3;
  providerName: string;
  modelName: string;
} {
  const { provider, model, customApiKey, customEndpoint } = config;

  switch (provider) {
    case "ANTHROPIC": {
      const apiKey = customApiKey || process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Anthropic API key is missing. Add your key in Settings or set ANTHROPIC_API_KEY in the server environment."
        );
      }
      const anthropic = createAnthropic({ apiKey });
      const modelId = model || "claude-sonnet-5-5";
      return {
        model: anthropic(modelId),
        providerName: "Anthropic",
        modelName: modelId,
      };
    }

    case "GEMINI": {
      const apiKey =
        customApiKey ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Google Gemini API key is missing. Add your key in Settings or set GEMINI_API_KEY in the server environment."
        );
      }
      const google = createGoogleGenerativeAI({ apiKey });
      const modelId = model || "gemini-4-argon";
      return {
        model: google(modelId),
        providerName: "Google Gemini",
        modelName: modelId,
      };
    }

    case "GROK": {
      // xAI Grok is OpenAI-compatible
      const apiKey = customApiKey || process.env.GROK_API_KEY || process.env.XAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "xAI Grok API key is missing. Add your key in Settings or set GROK_API_KEY in the server environment."
        );
      }
      const xai = createOpenAI({
        baseURL: "https://api.x.ai/v1",
        apiKey,
      });
      const modelId = model || "grok-4.20";
      return {
        model: xai(modelId),
        providerName: "xAI Grok",
        modelName: modelId,
      };
    }

    case "GROQ": {
      const apiKey = customApiKey || process.env.GROQ_API_KEY;
      if (!apiKey) {
        throw new Error(
          "Groq API key is missing. Add your key in Settings or set GROQ_API_KEY in the server environment.",
        );
      }
      const groq = createGroq({ apiKey });
      const modelId = model || "openai/gpt-oss-120b";
      return { model: groq(modelId), providerName: "Groq", modelName: modelId };
    }

    case "CUSTOM": {
      // Custom / Self-hosted endpoint (Ollama, vLLM, LMStudio, LocalAI)
      const baseURL = validateCustomEndpoint(
        customEndpoint || process.env.CUSTOM_AI_ENDPOINT || "http://localhost:11434/v1",
      );
      const apiKey = customApiKey || process.env.CUSTOM_AI_API_KEY || "self-hosted";
      const customOpenAI = createOpenAI({
        baseURL,
        apiKey,
      });
      const modelId = model || "llama3.3";
      return {
        model: customOpenAI(modelId),
        providerName: "Self-Hosted AI",
        modelName: modelId,
      };
    }

    case "OPENAI":
    default: {
      const apiKey = customApiKey || process.env.OPENAI_API_KEY;
      if (!apiKey) {
        throw new Error(
          "OpenAI API key is missing. Add your key in Settings or set OPENAI_API_KEY in the server environment."
        );
      }
      const openai = createOpenAI({ apiKey, fetch: createOpenAIResponsesFetch() });
      const modelId = model || "gpt-6.1-sol";
      return {
        // GPT-6.1 supports tool calling through the Responses API. The Chat
        // Completions endpoint does not support its tools.
        model: modelId.startsWith("gpt-6") ? openai.responses(modelId) : openai(modelId),
        providerName: "OpenAI",
        modelName: modelId,
      };
    }
  }
}
