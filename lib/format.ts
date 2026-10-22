export function cleanClientName(rawName: string | null | undefined): string | null {
  if (!rawName) return null;
  // Remove parenthesized handles, email fragments, or nicknames (e.g. "Overwatch Coder (Brainy)" -> "Overwatch Coder")
  const cleaned = rawName.replace(/\s*\([^)]*\)/g, "").trim();
  return cleaned || rawName.trim() || null;
}
