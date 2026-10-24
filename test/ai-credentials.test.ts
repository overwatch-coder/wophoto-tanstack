import { afterEach, describe, expect, it } from "vitest";
import { decryptAIKey, encryptAIKey, isEncryptedAIKey } from "@/lib/ai/credentials";

const previousKey = process.env.AI_KEYS_ENCRYPTION_KEY;

afterEach(() => {
  if (previousKey === undefined) delete process.env.AI_KEYS_ENCRYPTION_KEY;
  else process.env.AI_KEYS_ENCRYPTION_KEY = previousKey;
});

describe("AI provider key encryption", () => {
  it("encrypts keys at rest and decrypts only with the configured key", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = "a".repeat(64);
    const encrypted = encryptAIKey("provider-secret-123");

    expect(isEncryptedAIKey(encrypted)).toBe(true);
    expect(encrypted).not.toContain("provider-secret-123");
    expect(decryptAIKey(encrypted)).toBe("provider-secret-123");
  });

  it("rejects legacy plaintext values for replacement", () => {
    expect(() => decryptAIKey("legacy-provider-key")).toThrow(/must be replaced/i);
  });

  it("does not decrypt a tampered value", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = "a".repeat(64);
    const encrypted = encryptAIKey("provider-secret-123");
    process.env.AI_KEYS_ENCRYPTION_KEY = "b".repeat(64);

    expect(() => decryptAIKey(encrypted)).toThrow(/could not be decrypted/i);
  });

  it("requires a 256-bit hex key", () => {
    process.env.AI_KEYS_ENCRYPTION_KEY = "too-short";
    expect(() => encryptAIKey("provider-secret-123")).toThrow(/64 character hex key/i);
  });
});
