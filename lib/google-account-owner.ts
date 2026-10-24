import { z } from "zod";

type GoogleAccount = { provider: string; providerAccountId: string; id_token?: string | null };

const googleAccountSchema = z.object({
  provider: z.literal("google"),
  providerAccountId: z.string().min(1).max(256),
  id_token: z.string().min(1).max(16_384).regex(/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
});
const googleClaimsSchema = z.object({
  sub: z.string().min(1).max(256),
  email: z.string().email().max(254),
  email_verified: z.literal(true),
}).passthrough();

// Only call with the token returned by Auth.js after it has verified Google's
// OAuth response. This checks account ownership, not the JWT signature.
export function assertGoogleAccountOwner(account: GoogleAccount, ownerEmail: string) {
  const parsedAccount = googleAccountSchema.safeParse(account);
  if (!parsedAccount.success) {
    throw new Error("A verified Google account is required.");
  }
  const verifiedAccount = parsedAccount.data;
  let claims;
  try {
    const payload = verifiedAccount.id_token.split(".")[1];
    claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw new Error("The Google account identity could not be read.");
  }
  const parsedClaims = googleClaimsSchema.safeParse(claims);
  const parsedOwnerEmail = z.string().email().max(254).safeParse(ownerEmail.trim().toLowerCase());
  if (!parsedClaims.success || !parsedOwnerEmail.success ||
    parsedClaims.data.sub !== verifiedAccount.providerAccountId ||
    parsedClaims.data.email.trim().toLowerCase() !== parsedOwnerEmail.data) {
    throw new Error("The Google account cannot be linked to a different WoPhoto user.");
  }
}
