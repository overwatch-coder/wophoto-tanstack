import "server-only";

import { createDataStreamResponse, formatDataStreamPart, type ToolSet, type UIMessage } from "ai";
import { getTerminalToolMessage, isTerminalToolResult } from "@/lib/ai/tool-loop";

type ExecutableTool = {
  description?: string;
  parameters: {
    jsonSchema?: unknown;
    validate: (value: unknown) => Promise<{ success: true; value: unknown } | { success: false; error: Error }>;
  };
  execute?: (args: unknown, options: { toolCallId: string; messages: never[]; abortSignal?: AbortSignal }) => Promise<unknown>;
};

type GroqMessage = Record<string, unknown>;

function toGroqSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toGroqSchema);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => key !== "$schema")
      .map(([key, entry]) => [key, toGroqSchema(entry)]),
  );
}

function getPlainText(message: UIMessage): string {
  const contentText = typeof message.content === "string" ? message.content : "";
  if (contentText.trim()) return contentText;

  return (message.parts ?? [])
    .flatMap((part) => part.type === "text" && typeof part.text === "string" ? [part.text] : [])
    .join("");
}

export function createGroqChatResponse(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: UIMessage[];
  tools: ToolSet;
  abortSignal?: AbortSignal;
}): Response {
  const { apiKey, model, systemPrompt, messages, tools, abortSignal } = args;
  const toolMap = tools as Record<string, ExecutableTool>;
  const declarations = Object.entries(toolMap).map(([name, studioTool]) => ({
    type: "function",
    function: {
      name,
      description: studioTool.description,
      parameters: toGroqSchema(studioTool.parameters?.jsonSchema ?? { type: "object", properties: {} }),
    },
  }));
  const history: GroqMessage[] = [
    { role: "system", content: systemPrompt },
    ...messages.flatMap((message) => {
      const content = getPlainText(message).trim();
      return content ? [{ role: message.role, content }] : [];
    }),
  ];

  return createDataStreamResponse({
    headers: { "Cache-Control": "no-cache" },
    onError: () => "The Copilot could not complete that request. Check the provider setup and try again.",
    execute: async (stream) => {
      for (let step = 0; step < 5; step += 1) {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: history,
            tools: declarations,
            tool_choice: "auto",
            max_tokens: 2048,
          }),
          signal: abortSignal,
        });

        if (!response.ok) throw new Error(`Groq request failed with HTTP ${response.status}.`);

        const payload = await response.json() as {
          choices?: Array<{ message?: { content?: string | Array<{ text?: string }>; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> } }>;
          usage?: { prompt_tokens?: number; completion_tokens?: number };
        };
        const assistantMessage = payload.choices?.[0]?.message;
        if (!assistantMessage) throw new Error("Groq returned an empty chat response.");

        const toolCalls = assistantMessage.tool_calls ?? [];
        if (toolCalls.length === 0) {
          const finalText = typeof assistantMessage.content === "string"
            ? assistantMessage.content
            : assistantMessage.content?.map((part) => part.text ?? "").join("") ?? "";
          if (finalText) stream.write(formatDataStreamPart("text", finalText));
          stream.write(formatDataStreamPart("finish_message", {
            finishReason: "stop",
            usage: {
              promptTokens: payload.usage?.prompt_tokens ?? 0,
              completionTokens: payload.usage?.completion_tokens ?? 0,
            },
          }));
          return;
        }

        history.push({ role: "assistant", ...assistantMessage });
        for (const call of toolCalls) {
          const toolName = call.function?.name ?? "";
          const tool = toolMap[toolName];
          const toolCallId = call.id || crypto.randomUUID();
          let toolArgs: unknown = {};
          try {
            toolArgs = JSON.parse(call.function?.arguments ?? "{}");
          } catch {
            toolArgs = {};
          }
          if (!toolArgs || typeof toolArgs !== "object" || Array.isArray(toolArgs)) toolArgs = {};
          stream.write(formatDataStreamPart("tool_call", { toolCallId, toolName, args: toolArgs }));

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

          stream.write(formatDataStreamPart("tool_result", { toolCallId, result: toolOutput }));
          if (isTerminalToolResult(toolOutput)) {
            stream.write(formatDataStreamPart("text", getTerminalToolMessage(toolOutput)));
            stream.write(formatDataStreamPart("finish_message", { finishReason: "stop" }));
            return;
          }
          history.push({
            role: "tool",
            tool_call_id: toolCallId,
            content: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput),
          });
        }
      }

      stream.write(formatDataStreamPart("text", "I reached the tool-call limit for this turn. Please narrow the request and try again."));
      stream.write(formatDataStreamPart("finish_message", { finishReason: "stop" }));
    },
  });
}
