import { describe, expect, it } from "vitest";
import { getImageCapabilityError, getImageInputCapability } from "@/lib/ai/model-capabilities";

describe("AI model image input capabilities", () => {
  it("blocks Groq GPT OSS models that do not accept image input", () => {
    expect(getImageInputCapability("GROQ", "openai/gpt-oss-120b")).toBe("unsupported");
    expect(getImageCapabilityError("GROQ", "openai/gpt-oss-120b")).toMatch(/does not accept image input/);
  });

  it("allows models with known image input support", () => {
    expect(getImageInputCapability("GROQ", "qwen/qwen3.8-27b")).toBe("supported");
    expect(getImageInputCapability("OPENAI", "gpt-4o")).toBe("supported");
    expect(getImageInputCapability("GROK", "grok-4.7")).toBe("supported");
  });

  it("does not block custom or unclassified model IDs", () => {
    expect(getImageInputCapability("CUSTOM", "local-vlm")).toBe("unknown");
    expect(getImageCapabilityError("OPENAI", "gpt-6.1-sol")).toBeNull();
  });
});
