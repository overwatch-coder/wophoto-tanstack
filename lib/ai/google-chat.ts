
import { GoogleGenAI, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import type { ToolSet, UIMessage } from "ai";
import { getTerminalToolMessage, isTerminalToolResult } from "@/lib/ai/tool-loop";
import { createCopilotMessageResponse } from "@/lib/ai/message-stream";

type ExecutableTool = {
  description?: string;
  parameters: {
    jsonSchema?: unknown;
    validate: (value: unknown) => Promise<{ success: true; value: unknown } | { success: false; error: Error }>;
  };
  execute?: (args: unknown, options: { toolCallId: string; messages: never[]; abortSignal?: AbortSignal }) => Promise<unknown>;
};

function toGoogleSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGoogleSchema);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema" && key !== "additionalProperties")
      .map(([key, entry]) => [key, toGoogleSchema(entry)]),
  );
}

function getPlainText(message: UIMessage): string {
  return (message.parts ?? [])
    .flatMap((part) => part.type === "text" && typeof part.text === "string" ? [part.text] : [])
    .join("");
}

function getToolDeclarations(tools: ToolSet): FunctionDeclaration[] {
  return Object.entries(tools).map(([name, rawTool]) => {
    const studioTool = rawTool as unknown as ExecutableTool;
    const parameters = studioTool.parameters?.jsonSchema;

    return {
      name,
      description: studioTool.description,
      ...(parameters ? { parametersJsonSchema: toGoogleSchema(parameters) } : {}),
    };
  });
}

export function createGoogleGeminiChatResponse(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: UIMessage[];
  tools: ToolSet;
  abortSignal?: AbortSignal;
}): Response {
  const { apiKey, model, systemPrompt, messages, tools, abortSignal } = args;
  const google = new GoogleGenAI({ apiKey });
  const toolMap = tools as unknown as Record<string, ExecutableTool>;
  const declarations = getToolDeclarations(tools);

  // Keep only visible text and image attachments from previous turns. Tool-call history is represented
  // by the current Gemini response below, where the SDK retains its signatures.
  const contents: Content[] = messages.flatMap((message) => {
    const text = getPlainText(message).trim();
    const parts: Part[] = [];
    if (text) {
      parts.push({ text });
    }

    const attachments = (message.parts ?? []).flatMap((part) => part.type === "file"
      ? [{ url: part.url, contentType: part.mediaType }]
      : []);
    if (attachments && Array.isArray(attachments)) {
      for (const att of attachments) {
        if (typeof att.url === "string" && att.url.startsWith("data:") && att.url.includes(";base64,")) {
          const [header, base64Data] = att.url.split(";base64,");
          const mimeType = att.contentType || header.replace("data:", "") || "image/jpeg";
          if (mimeType.startsWith("image/") && base64Data) {
            parts.push({
              inlineData: {
                mimeType,
                data: base64Data,
              },
            });
          }
        }
      }
    }

    if (parts.length === 0) return [];
    return [{
      role: message.role === "assistant" ? "model" : "user",
      parts,
    }];
  });

  return createCopilotMessageResponse({
    originalMessages: messages,
    headers: { "Cache-Control": "no-cache" },
    onError: () => "The Copilot could not complete that request. Check the provider setup and try again.",
    execute: async (stream) => {
      const reportActivity = (label: string) => stream.writeActivity(label);
      reportActivity("Understanding your request…");
      for (let step = 0; step < 5; step += 1) {
        if (step > 0) reportActivity("Reviewing the information gathered…");
        const response = await google.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: 2048,
            abortSignal,
            ...(declarations.length ? { tools: [{ functionDeclarations: declarations }] } : {}),
          },
        });

        const modelContent = response.candidates?.[0]?.content;
        const responseParts = modelContent?.parts ?? [];
        const functionCalls = responseParts.flatMap((part) => part.functionCall ? [part.functionCall] : []);

        if (!functionCalls.length) {
          reportActivity("Preparing your response…");
          const finalText = responseParts
            .flatMap((part: Part) => !part.thought && typeof part.text === "string" ? [part.text] : [])
            .join("");
          if (finalText) stream.writeText(finalText);
          stream.finish();
          return;
        }

        if (modelContent) contents.push(modelContent);

        const functionResponses: Part[] = [];
        for (const call of functionCalls) {
          const toolName = call.name ?? "";
          const tool = toolMap[toolName];
          const toolCallId = call.id || crypto.randomUUID();
          const toolArgs = call.args ?? {};
          stream.writeToolCall(toolCallId, toolName, toolArgs);

          let toolOutput: unknown;
          try {
            if (!tool?.execute) throw new Error("This tool is unavailable for your account.");
            const validation = await tool.parameters.validate(toolArgs);
            if (!validation.success) throw validation.error;
            toolOutput = await tool.execute(validation.value, {
              toolCallId,
              messages: [],
              abortSignal,
            });
          } catch (error) {
            toolOutput = {
              error: error instanceof Error ? error.message.slice(0, 300) : "The requested tool could not be completed.",
            };
          }

          stream.writeToolResult(toolCallId, toolOutput);
          if (isTerminalToolResult(toolOutput)) {
            stream.writeText(getTerminalToolMessage(toolOutput));
            stream.finish();
            return;
          }
          functionResponses.push({
            functionResponse: {
              name: toolName,
              ...(call.id ? { id: call.id } : {}),
              response: { output: toolOutput },
            },
          });
        }

        contents.push({ role: "user", parts: functionResponses });
      }

      stream.writeText("I reached the tool-call limit for this turn. Please narrow the request and try again.");
      stream.finish();
    },
  });
}
