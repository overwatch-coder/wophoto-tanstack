import "server-only";

import type { ToolSet, UIMessage } from "ai";
import OpenAI from "openai";
import type {
  FunctionTool,
  ResponseInput,
  ResponseInputContent,
  ResponseInputItem,
} from "openai/resources/responses/responses";
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

function getPlainText(message: UIMessage): string {
  return (message.parts ?? [])
    .flatMap((part) => part.type === "text" && typeof part.text === "string" ? [part.text] : [])
    .join("");
}

export function createOpenAIResponsesChatResponse(args: {
  apiKey: string;
  model: string;
  systemPrompt: string;
  messages: UIMessage[];
  tools: ToolSet;
  abortSignal?: AbortSignal;
}): Response {
  const { apiKey, model, systemPrompt, messages, tools, abortSignal } = args;
  const client = new OpenAI({ apiKey, maxRetries: 1 });
  const toolMap = tools as unknown as Record<string, ExecutableTool>;
  const declarations: FunctionTool[] = Object.entries(toolMap).map(([name, studioTool]) => ({
    type: "function",
    name,
    description: studioTool.description,
    parameters: (studioTool.parameters?.jsonSchema ?? { type: "object", properties: {} }) as FunctionTool["parameters"],
    strict: false,
  }));
  const input: ResponseInput = messages.flatMap((message): ResponseInputItem[] => {
    const text = getPlainText(message).trim();
    const role = message.role === "system" ? "system" : message.role === "user" ? "user" : "assistant";

    const attachments = (message.parts ?? []).flatMap((part) => part.type === "file"
      ? [{ url: part.url, contentType: part.mediaType }]
      : []);
    if (message.role === "user" && attachments && Array.isArray(attachments) && attachments.length > 0) {
      const contentParts: ResponseInputContent[] = [];
      if (text) {
        contentParts.push({ type: "input_text", text });
      }
      for (const att of attachments) {
        if (typeof att.url === "string" && (att.url.startsWith("data:image/") || att.contentType?.startsWith("image/"))) {
          contentParts.push({
            type: "input_image",
            image_url: att.url,
            detail: "auto",
          });
        }
      }
      if (contentParts.length > 0) {
        return [{ role: "user", content: contentParts }];
      }
    }

    if (!text) return [];
    return [{ role, content: text }];
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
        let response;
        try {
          response = await client.responses.create({
            model,
            instructions: systemPrompt,
            input,
            tools: declarations,
            tool_choice: "auto",
            max_output_tokens: 2048,
          }, { signal: abortSignal });
        } catch (error) {
          const status = error instanceof OpenAI.APIError ? error.status : undefined;
          const code = error instanceof OpenAI.APIError && typeof error.code === "string" ? error.code : undefined;
          const safeMessage = error instanceof Error
            ? error.message
              .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
              .replace(/proj_[A-Za-z0-9]+/g, "[project]")
              .slice(0, 240)
            : "No provider error detail was returned.";
          console.error("OpenAI Responses request failed", {
            model,
            status,
            code,
            message: safeMessage,
          });
          throw error;
        }

        const outputItems = response.output;
        const functionCalls = outputItems.filter((item) => item.type === "function_call");

        if (!functionCalls.length) {
          reportActivity("Preparing your response…");
          const finalText = outputItems
            .filter((item) => item.type === "message")
            .flatMap((item) => item.content)
            .filter((part) => part.type === "output_text")
            .map((part) => part.text)
            .join("");
          if (finalText) stream.writeText(finalText);
          stream.finish();
          return;
        }

        // Responses function calls are assistant output items. Echo the full
        // objects unchanged before their results so the model gets its call IDs.
        input.push(...outputItems as unknown as ResponseInputItem[]);

        for (const call of functionCalls) {
          const toolName = call.name;
          const tool = toolMap[toolName];
          const toolCallId = call.call_id;
          let toolArgs: unknown = {};
          try {
            toolArgs = JSON.parse(call.arguments);
          } catch {
            toolArgs = {};
          }
          if (!toolArgs || typeof toolArgs !== "object" || Array.isArray(toolArgs)) toolArgs = {};
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
          input.push({
            type: "function_call_output",
            call_id: toolCallId,
            output: typeof toolOutput === "string" ? toolOutput : JSON.stringify(toolOutput),
          });
        }
      }

      stream.writeText("I reached the tool-call limit for this turn. Please narrow the request and try again.");
      stream.finish();
    },
  });
}
