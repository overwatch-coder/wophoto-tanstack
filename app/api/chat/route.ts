import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveLanguageModel } from "@/lib/ai/provider";
import { createGoogleGeminiChatResponse } from "@/lib/ai/google-chat";
import { createGroqChatResponse } from "@/lib/ai/groq-chat";
import { createOpenAIResponsesChatResponse } from "@/lib/ai/openai-responses-chat";
import { createStudioTools } from "@/lib/ai/tools";
import { convertToCoreMessages, streamText, type UIMessage } from "ai";
import { decryptAIKey } from "@/lib/ai/credentials";
import { AIProvider } from "@/lib/settings-preferences";
import { getEffectiveCopilotName } from "@/lib/ai/copilot-name";
import { z } from "zod";

export const maxDuration = 30;

const chatMessageSchema = z.object({
  id: z.string().max(200).optional(),
  role: z.enum(["user", "assistant"]),
  content: z.string().max(8_000),
  parts: z.array(z.record(z.string(), z.unknown())).max(80).optional(),
}).loose();

const chatRequestSchema = z.object({
  id: z.string().max(200).optional(),
  messages: z.array(chatMessageSchema).min(1).max(30),
}).strict();
const providerSchema = z.enum(["OPENAI", "ANTHROPIC", "GEMINI", "GROK", "GROQ", "CUSTOM"]);

function chatError(message: string, status: number) {
  return new Response(message, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

function getSafeAIErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : "";
  if (/does not have access to model/i.test(message)) {
    return "The OpenAI API project used by this account does not have access to the selected model. Enable model access for that project or choose a model it already supports.";
  }
  if (error && typeof error === "object") {
    const providerError = error as { statusCode?: unknown; responseBody?: unknown };
    const statusCode = typeof providerError.statusCode === "number" ? providerError.statusCode : undefined;
    if (statusCode && typeof providerError.responseBody === "string") {
      try {
        const response = JSON.parse(providerError.responseBody) as {
          error?: { message?: unknown; code?: unknown; param?: unknown };
        };
        const detail = [response.error?.message, response.error?.code, response.error?.param]
          .filter((part): part is string => typeof part === "string")
          .join(" ( ")
          .replace(/proj_[A-Za-z0-9]+/g, "[project]")
          .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
          .slice(0, 240);
        if (detail) return `The AI provider rejected this request (HTTP ${statusCode}): ${detail}`;
      } catch {
        // Keep the generic message when the provider response is not JSON.
      }
    }
  }
  return "The Copilot could not complete that request. Check the provider setup and try again.";
}

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new Response("Unauthorized", { status: 401 });
    }

    const contentLength = Number(req.headers.get("content-length") || 0);
    if (contentLength > 100_000) return chatError("This message is too large. Shorten it and try again.", 413);
    const rawBody = await req.text();
    if (rawBody.length > 100_000) {
      return chatError("This message is too large. Shorten it and try again.", 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody);
    } catch {
      return chatError("The chat request was not valid JSON.", 400);
    }
    const parsedBody = chatRequestSchema.safeParse(body);
    if (!parsedBody.success) {
      return chatError("Chat history is invalid or too long. Start a new conversation and try again.", 400);
    }
    const { messages } = parsedBody.data;

    // Query user preferences for AI settings
    const preference = await prisma.userPreference.findUnique({
      where: { userId: session.user.id },
      select: {
        aiProvider: true,
        aiCopilotName: true,
        aiModel: true,
        aiApiKeyEncrypted: true,
        aiApiKeyProvider: true,
        aiCustomEndpoint: true,
        aiAutonomousExecution: true,
      },
    });

    const providerResult = providerSchema.safeParse(preference?.aiProvider || "OPENAI");
    if (!providerResult.success) {
      return chatError("The selected AI provider is invalid. Choose a provider again in Settings.", 400);
    }
    const provider = providerResult.data as AIProvider;
    const model = preference?.aiModel || "gpt-6.1-sol";
    const customApiKey = preference?.aiApiKeyProvider === provider
      ? decryptAIKey(preference.aiApiKeyEncrypted)
      : undefined;
    const customEndpoint = preference?.aiCustomEndpoint || undefined;
    const autonomousExecution = preference?.aiAutonomousExecution ?? false;
    const copilotName = await getEffectiveCopilotName(
      session.user.id,
      session.user.role,
      preference?.aiCopilotName,
    );

    // Create role-aware studio tools
    const tools = createStudioTools({
      userId: session.user.id,
      role: session.user.role,
      userEmail: session.user.email ?? "",
      autonomousExecution: session.user.role === "MANAGER" && autonomousExecution,
    });

    const systemPrompt = `You are ${copilotName}, an AI assistant for professional photography and multimedia studios. Use that name if the user asks what to call you.
Your primary role is to assist the user (Role: ${session.user.role}, Name: ${session.user.name || "User"}) with studio operations.

Guidelines:
- Keep answers concise, clear, and focused. Avoid unnecessary preamble.
- Always use the tools available:
  - If the user asks about a client review, feedback, or image revision pins, execute 'smart_search'.
  - If the user asks about retoucher availability or capacity, execute 'query_team_capacity'.
  - If the user asks about deadlines or SLA risks, execute 'query_sla_risks'.
  - If the user asks to create projects or tasks, use 'create_project' and 'create_task_batch'.
  - If the user asks to navigate somewhere, use 'navigate_to'.
- You must strictly respect user permissions. Never attempt to bypass role boundaries.
- When an action returns a link, provide it cleanly to the user.`;

    if (provider === "GEMINI") {
      const googleApiKey = customApiKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
      if (!googleApiKey) {
        return chatError(
          "Google Gemini API key is missing. Add your key in Settings or set GEMINI_API_KEY in the server environment.",
          500,
        );
      }

      return createGoogleGeminiChatResponse({
        apiKey: googleApiKey,
        model,
        systemPrompt,
        messages: messages as unknown as UIMessage[],
        tools,
        abortSignal: req.signal,
      });
    }

    if (provider === "GROQ") {
      const groqApiKey = customApiKey || process.env.GROQ_API_KEY;
      if (!groqApiKey) {
        return chatError(
          "Groq API key is missing. Add your key in Settings or set GROQ_API_KEY in the server environment.",
          500,
        );
      }

      return createGroqChatResponse({
        apiKey: groqApiKey,
        model,
        systemPrompt,
        messages: messages as unknown as UIMessage[],
        tools,
        abortSignal: req.signal,
      });
    }

    if (provider === "OPENAI" && /^(gpt-6|gpt-5\.6)/.test(model)) {
      const openaiApiKey = customApiKey || process.env.OPENAI_API_KEY;
      if (!openaiApiKey) {
        return chatError(
          "OpenAI API key is missing. Add your key in Settings or set OPENAI_API_KEY in the server environment.",
          500,
        );
      }

      return createOpenAIResponsesChatResponse({
        apiKey: openaiApiKey,
        model,
        systemPrompt,
        messages: messages as unknown as UIMessage[],
        tools,
        abortSignal: req.signal,
      });
    }

    // Resolve the remaining providers through the shared AI SDK v4 stream adapter.
    const { model: languageModel } = resolveLanguageModel({
      provider,
      model,
      customApiKey,
      customEndpoint,
    });

    const result = streamText({
      model: languageModel,
      system: systemPrompt,
      messages: convertToCoreMessages(messages as unknown as UIMessage[], { tools }),
      tools,
      maxSteps: 5,
    });

    return result.toDataStreamResponse({ getErrorMessage: getSafeAIErrorMessage });
  } catch (error) {
    console.error("AI Chat Route Error:", error);
    if (error instanceof Error && /does not have access to model/i.test(error.message)) {
      return chatError(getSafeAIErrorMessage(error), 403);
    }
    const safeMessage = error instanceof Error && /API key is missing|endpoint|allowed|decrypted|encryption/i.test(error.message)
      ? error.message
      : "The Copilot could not complete that request. Check the provider setup and try again.";
    return chatError(safeMessage, 500);
  }
}
