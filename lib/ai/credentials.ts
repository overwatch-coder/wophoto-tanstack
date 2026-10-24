import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ENCRYPTED_KEY_PREFIX = "enc:v1:";
const IV_LENGTH = 12;

function getEncryptionKey(): Buffer {
  const configuredKey = process.env.AI_KEYS_ENCRYPTION_KEY?.trim();
  if (!configuredKey || !/^[\da-f]{64}$/i.test(configuredKey)) {
    throw new Error("AI_KEYS_ENCRYPTION_KEY must be set to a 64 character hex key before saving provider keys.");
  }
  return Buffer.from(configuredKey, "hex");
}

export function isEncryptedAIKey(value: string | null | undefined): boolean {
  return Boolean(value?.startsWith(ENCRYPTED_KEY_PREFIX));
}

export function encryptAIKey(value: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_KEY_PREFIX}${iv.toString("base64url")}.${tag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptAIKey(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  if (!isEncryptedAIKey(value)) {
    throw new Error("A provider key saved before encryption must be replaced in Settings.");
  }

  try {
    const [ivPart, tagPart, ciphertextPart] = value.slice(ENCRYPTED_KEY_PREFIX.length).split(".");
    if (!ivPart || !tagPart || !ciphertextPart) throw new Error("Invalid encrypted key format.");

    const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(ivPart, "base64url"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("The saved provider key could not be decrypted. Check AI_KEYS_ENCRYPTION_KEY or replace the key in Settings.");
  }
}
