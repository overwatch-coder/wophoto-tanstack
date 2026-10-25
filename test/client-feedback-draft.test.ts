import { describe, expect, it } from "vitest";
import { parseClientFeedbackDraft, parseClientFeedbackDraftJson } from "@/lib/client-feedback-draft";

const projects = [{ id: "project-1", name: "My PhD journey" }];

describe("client review drafts", () => {
  it("accepts a review draft only for one of the client's projects", () => {
    expect(parseClientFeedbackDraft({
      projectId: "project-1",
      type: "REVIEW",
      score: 3,
      details: "The project is taking longer than expected.",
    }, projects)).toEqual({
      projectId: "project-1",
      projectName: "My PhD journey",
      type: "REVIEW",
      score: 3,
      details: "The project is taking longer than expected.",
    });
  });

  it("rejects drafts with an unknown project, invalid rating, or empty text", () => {
    expect(parseClientFeedbackDraft({ projectId: "other", type: "REVIEW", score: 3, details: "Review" }, projects)).toBeNull();
    expect(parseClientFeedbackDraft({ projectId: "project-1", type: "REVIEW", score: 6, details: "Review" }, projects)).toBeNull();
    expect(parseClientFeedbackDraft({ projectId: "project-1", type: "REVIEW", score: 3, details: "  " }, projects)).toBeNull();
  });

  it("handles invalid session storage JSON safely", () => {
    expect(parseClientFeedbackDraftJson("{not json", projects)).toBeNull();
  });
});
