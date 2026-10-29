import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

export interface CopilotMessageWriter {
  writeActivity(label: string): void;
  writeText(text: string): void;
  writeToolCall(toolCallId: string, toolName: string, input: unknown): void;
  writeToolResult(toolCallId: string, output: unknown): void;
  finish(): void;
}

/** Adapts the custom provider loops to AI SDK's current UI message stream protocol. */
export function createCopilotMessageResponse(args: {
  originalMessages: UIMessage[];
  headers?: HeadersInit;
  onError?: (error: unknown) => string;
  execute: (writer: CopilotMessageWriter) => Promise<void>;
}): Response {
  const stream = createUIMessageStream<UIMessage>({
    originalMessages: args.originalMessages,
    onError: args.onError,
    execute: async ({ writer }) => {
      let textId: string | undefined;
      let finished = false;
      const finishText = () => {
        if (textId) {
          writer.write({ type: "text-end", id: textId });
          textId = undefined;
        }
      };

      const copilotWriter: CopilotMessageWriter = {
        writeActivity(label) {
          writer.write({ type: "data-copilot-activity", data: { label } });
        },
        writeText(text) {
          if (!text) return;
          textId ??= crypto.randomUUID();
          if (textId) {
            // A start chunk is only emitted once for this text block.
            if (textId === currentTextId) {
              writer.write({ type: "text-delta", id: textId, delta: text });
            } else {
              currentTextId = textId;
              writer.write({ type: "text-start", id: textId });
              writer.write({ type: "text-delta", id: textId, delta: text });
            }
          }
        },
        writeToolCall(toolCallId, toolName, input) {
          finishText();
          writer.write({ type: "tool-input-available", toolCallId, toolName, input });
        },
        writeToolResult(toolCallId, output) {
          writer.write({ type: "tool-output-available", toolCallId, output });
        },
        finish() {
          if (finished) return;
          finishText();
          writer.write({ type: "finish", finishReason: "stop" });
          finished = true;
        },
      };

      let currentTextId: string | undefined;
      await args.execute(copilotWriter);
      copilotWriter.finish();
    },
  });

  return createUIMessageStreamResponse({ stream, headers: args.headers });
}
