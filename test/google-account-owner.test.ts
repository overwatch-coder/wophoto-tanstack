import { describe, expect, it } from "vitest";
import { assertGoogleAccountOwner } from "@/lib/google-account-owner";

function account(email: string, verified = true, subject = "client-google-subject") {
  return { provider: "google", providerAccountId: "client-google-subject", id_token: `header.${Buffer.from(JSON.stringify({ sub: subject, email, email_verified: verified })).toString("base64url")}.signature` };
}

describe("Google account ownership guard", () => {
  it("rejects linking an invited client's Google identity to a signed-in worker", () => {
    expect(() => assertGoogleAccountOwner(account("client@example.com"), "worker@example.com")).toThrow("different WoPhoto user");
  });
  it("allows linking a verified identity to its own user, including normalized emails", () => {
    expect(() => assertGoogleAccountOwner(account("Client@Example.com"), "client@example.com")).not.toThrow();
  });
  it("rejects absent or malformed claims, an unverified email, and a different subject", () => {
    for (const value of [
      { provider: "google", providerAccountId: "id" },
      { provider: "google", providerAccountId: "id", id_token: "malformed" },
      account("client@example.com", false), account("client@example.com", true, "wrong-subject"),
    ]) expect(() => assertGoogleAccountOwner(value, "client@example.com")).toThrow();
  });
});
