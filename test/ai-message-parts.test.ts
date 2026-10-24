import { describe, expect, it } from "vitest";
import { convertToCoreMessages, type UIMessage } from "ai";

describe("AI chat message parts", () => {
  it("converts UI text and completed tool parts into model messages", () => {
    const messages = [
      {
        id: "user-1",
        role: "user",
        content: "Find open reviews",
        parts: [{ type: "text", text: "Find open reviews" }],
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "",
        parts: [
          {
            type: "tool-invocation",
            toolInvocation: {
              state: "result",
              step: 0,
              toolCallId: "call-1",
              toolName: "smart_search",
              args: { query: "open reviews" },
              result: { items: [] },
            },
          },
        ],
      },
    ] as unknown as UIMessage[];

    const converted = convertToCoreMessages(messages);

    expect(converted[0]).toEqual({
      role: "user",
      content: [{ type: "text", text: "Find open reviews" }],
    });
    expect(converted[1]).toMatchObject({
      role: "assistant",
      content: [{
        type: "tool-call",
        toolCallId: "call-1",
        toolName: "smart_search",
        args: { query: "open reviews" },
      }],
    });
    expect(converted[2]).toMatchObject({
      role: "tool",
      content: [{ type: "tool-result", toolCallId: "call-1", result: { items: [] } }],
    });
  });
});
