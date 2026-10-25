export interface ClientFeedbackDraft {
  projectId: string;
  projectName: string;
  type: "REVIEW";
  score: number;
  details: string;
}

export const CLIENT_FEEDBACK_DRAFT_STORAGE_KEY = "wophoto:client-feedback-draft";
const CLIENT_FEEDBACK_DRAFT_EVENT = "wophoto:client-feedback-draft-change";

export function setClientFeedbackDraft(draft: ClientFeedbackDraft): void {
  window.sessionStorage.setItem(CLIENT_FEEDBACK_DRAFT_STORAGE_KEY, JSON.stringify(draft));
  window.dispatchEvent(new Event(CLIENT_FEEDBACK_DRAFT_EVENT));
}

export function clearClientFeedbackDraft(): void {
  window.sessionStorage.removeItem(CLIENT_FEEDBACK_DRAFT_STORAGE_KEY);
  window.dispatchEvent(new Event(CLIENT_FEEDBACK_DRAFT_EVENT));
}

export function subscribeClientFeedbackDraft(listener: () => void): () => void {
  window.addEventListener(CLIENT_FEEDBACK_DRAFT_EVENT, listener);
  return () => window.removeEventListener(CLIENT_FEEDBACK_DRAFT_EVENT, listener);
}

export function getClientFeedbackDraftSnapshot(): string | null {
  return window.sessionStorage.getItem(CLIENT_FEEDBACK_DRAFT_STORAGE_KEY);
}

export function parseClientFeedbackDraft(
  value: unknown,
  projects: readonly { id: string; name: string }[],
): ClientFeedbackDraft | null {
  if (!value || typeof value !== "object") return null;

  const draft = value as Record<string, unknown>;
  const project = projects.find((item) => item.id === draft.projectId);
  if (
    !project ||
    draft.type !== "REVIEW" ||
    typeof draft.score !== "number" ||
    !Number.isInteger(draft.score) ||
    draft.score < 1 ||
    draft.score > 5 ||
    typeof draft.details !== "string" ||
    !draft.details.trim() ||
    draft.details.length > 5000
  ) {
    return null;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    type: "REVIEW",
    score: draft.score,
    details: draft.details.trim(),
  };
}

export function parseClientFeedbackDraftJson(
  raw: string,
  projects: readonly { id: string; name: string }[],
): ClientFeedbackDraft | null {
  try {
    return parseClientFeedbackDraft(JSON.parse(raw), projects);
  } catch {
    return null;
  }
}
