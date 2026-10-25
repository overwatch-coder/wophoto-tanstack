export function isTerminalToolResult(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const result = value as { requiresConfirmation?: unknown; needsInput?: unknown; clientFeedbackDraft?: unknown };
  return result.requiresConfirmation === true || result.needsInput === true || Boolean(result.clientFeedbackDraft);
}

export function getTerminalToolMessage(value: unknown): string {
  if (!value || typeof value !== "object") return "The requested action is ready for your review.";
  const result = value as { message?: unknown };
  if (typeof result.message === "string") return result.message;
  return "The action proposal is ready. Review it below and confirm it only if it matches your request.";
}
