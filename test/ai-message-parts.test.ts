import { describe, expect, it } from "vitest";
import { convertToModelMessages, type UIMessage } from "ai";

describe("AI chat message parts", () => {
  it("converts UI text and completed tool parts into model messages", async () => {
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
        parts: [
          {
            type: "tool-smart_search",
            state: "output-available",
            toolCallId: "call-1",
            input: { query: "open reviews" },
            output: { items: [] },
          },
        ],
      },
    ] as unknown as UIMessage[];

    const converted = await convertToModelMessages(messages);

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
        input: { query: "open reviews" },
      }],
    });
    expect(converted[2]).toMatchObject({
      role: "tool",
      content: [{ type: "tool-result", toolCallId: "call-1", output: { type: "json", value: { items: [] } } }],
    });
  });
});
