import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findPreference: vi.fn(),
  groqResponse: vi.fn(),
  resolveLanguageModel: vi.fn(),
  decryptAIKey: vi.fn(() => "test-api-key"),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ prisma: { userPreference: { findUnique: mocks.findPreference } } }));
vi.mock("@/lib/ai/provider", () => ({ resolveLanguageModel: mocks.resolveLanguageModel }));
vi.mock("@/lib/ai/google-chat", () => ({ createGoogleGeminiChatResponse: vi.fn() }));
vi.mock("@/lib/ai/groq-chat", () => ({ createGroqChatResponse: mocks.groqResponse }));
vi.mock("@/lib/ai/openai-responses-chat", () => ({ createOpenAIResponsesChatResponse: vi.fn() }));
vi.mock("@/lib/ai/tools", () => ({ createStudioTools: vi.fn(() => ({})) }));
vi.mock("@/lib/ai/credentials", () => ({ decryptAIKey: mocks.decryptAIKey }));
vi.mock("@/lib/ai/copilot-name", () => ({ getEffectiveCopilotName: vi.fn(() => "Test Copilot") }));
vi.mock("ai", () => ({ convertToCoreMessages: vi.fn(() => []), streamText: vi.fn() }));

import { POST } from "@/app/api/chat/route";

function request() {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [{
        id: "message-1",
        role: "user",
        content: "Describe this image",
        experimental_attachments: [{
          name: "sample.png",
          contentType: "image/png",
          url: "data:image/png;base64,aGVsbG8=",
        }],
      }],
    }),
  });
}

describe("AI chat image capability guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.mockResolvedValue({ user: { id: "manager-1", role: "MANAGER", email: "manager@example.com", name: "Manager" } });
    mocks.findPreference.mockImplementation(({ where }: { where: { userId: string } }) => Promise.resolve({
      aiProvider: "GROQ",
      aiModel: where.userId === "manager-1" ? "openai/gpt-oss-120b" : "qwen/qwen3.8-27b",
      aiCopilotName: null,
      aiApiKeyEncrypted: null,
      aiApiKeyProvider: null,
      aiCustomEndpoint: null,
      aiAutonomousExecution: false,
    }));
    mocks.groqResponse.mockReturnValue(new Response("stream"));
  });

  it("returns a clear validation error before calling a text-only model with an image", async () => {
    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(await response.text()).toMatch(/does not accept image input/);
    expect(mocks.groqResponse).not.toHaveBeenCalled();
  });

  it("passes image messages to a Groq model with known image support", async () => {
    mocks.findPreference.mockResolvedValue({
      aiProvider: "GROQ",
      aiModel: "qwen/qwen3.8-27b",
      aiCopilotName: null,
      aiApiKeyEncrypted: "encrypted-test-key",
      aiApiKeyProvider: "GROQ",
      aiCustomEndpoint: null,
      aiAutonomousExecution: false,
    });

    const response = await POST(request());

    expect(response.status).toBe(200);
    expect(mocks.groqResponse).toHaveBeenCalledOnce();
  });
});
