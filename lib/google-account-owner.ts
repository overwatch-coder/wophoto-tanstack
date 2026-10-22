type GoogleAccount = { provider: string; providerAccountId: string; id_token?: string | null };

// Only call with the token returned by Auth.js after it has verified Google's
// OAuth response. This checks account ownership, not the JWT signature.
export function assertGoogleAccountOwner(account: GoogleAccount, ownerEmail: string) {
  if (account.provider !== "google" || !account.id_token) {
    throw new Error("A verified Google account is required.");
  }
  let claims;
  try {
    claims = JSON.parse(Buffer.from(account.id_token.split(".")[1], "base64url").toString("utf8"));
  } catch {
    throw new Error("The Google account identity could not be read.");
  }
  if (
    claims?.sub !== account.providerAccountId ||
    claims?.email_verified !== true ||
    typeof claims?.email !== "string" ||
    claims.email.trim().toLowerCase() !== ownerEmail.trim().toLowerCase()
  ) {
    throw new Error("The Google account cannot be linked to a different WoPhoto user.");
  }
}
