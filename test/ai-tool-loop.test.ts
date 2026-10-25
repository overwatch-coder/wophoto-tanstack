import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class {
    models = { generateContent: mocks.generateContent };
    constructor() {}
  },
}));

import { createGoogleGeminiChatResponse } from "@/lib/ai/google-chat";

describe("Copilot tool loop", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stops provider rounds immediately after a confirmation proposal", async () => {
    const execute = vi.fn().mockResolvedValue({
      requiresConfirmation: true,
      proposalType: "CREATE_PROJECT",
      title: "Create Project: Sample",
      description: "Ready for review.",
      payload: { name: "Sample", clientEmail: "client@example.com" },
    });
    const validate = vi.fn().mockResolvedValue({ success: true, value: { name: "Sample" } });
    mocks.generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ functionCall: { name: "create_project", args: { name: "Sample" } } }] } }],
    });

    const response = createGoogleGeminiChatResponse({
      apiKey: "test-key",
      model: "test-model",
      systemPrompt: "",
      messages: [{ id: "user-1", role: "user", content: "Create Sample" } as never],
      tools: {
        create_project: {
          description: "Create a project",
          parameters: { jsonSchema: {}, validate },
          execute,
        },
      } as never,
    });
    const streamText = await response.text();

    expect(mocks.generateContent).toHaveBeenCalledOnce();
    expect(execute).toHaveBeenCalledOnce();
    expect(streamText).toContain("action proposal is ready");
    expect(streamText).not.toContain("reached the tool-call limit");
  });

  it("stops after a tool asks the user for missing information", async () => {
    const execute = vi.fn().mockResolvedValue({
      needsInput: true,
      message: "Which client email should I use?",
    });
    mocks.generateContent.mockResolvedValue({
      candidates: [{ content: { parts: [{ functionCall: { name: "create_project", args: { name: "Sample" } } }] } }],
    });
    const response = createGoogleGeminiChatResponse({
      apiKey: "test-key",
      model: "test-model",
      systemPrompt: "",
      messages: [{ id: "user-1", role: "user", content: "Create Sample" } as never],
      tools: {
        create_project: {
          description: "Create a project",
          parameters: { jsonSchema: {}, validate: vi.fn().mockResolvedValue({ success: true, value: { name: "Sample" } }) },
          execute,
        },
      } as never,
    });
    const streamText = await response.text();

    expect(mocks.generateContent).toHaveBeenCalledOnce();
    expect(streamText).toContain("Which client email should I use?");
    expect(streamText).not.toContain("reached the tool-call limit");
  });
});
