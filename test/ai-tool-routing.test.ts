import { describe, expect, it } from "vitest";
import { getFocusedToolNames, getPendingClarificationToolName, restrictTools } from "@/lib/ai/tool-routing";
import { getTerminalToolMessage, isTerminalToolResult } from "@/lib/ai/tool-loop";

describe("Copilot tool routing", () => {
  it("routes a direct project creation request to the project tool only", () => {
    expect(getFocusedToolNames("Create a new project named My PhD journey"))
      .toEqual(["create_project"]);
  });

  it("routes client review draft requests to the form preparation tool", () => {
    expect(getFocusedToolNames("Generate the review card for me so I can submit", "CLIENT"))
      .toEqual(["prepare_client_feedback"]);
    expect(getFocusedToolNames("Create a review for My PhD journey", "MANAGER"))
      .toBeNull();
  });

  it("keeps a short client reply focused on the review draft clarification", () => {
    const messages = [
      { role: "assistant", parts: [{
        type: "tool-invocation",
        toolInvocation: {
          toolName: "prepare_client_feedback",
          state: "result",
          result: { needsInput: true, message: "Which project?" },
        },
      }] },
      { role: "user", content: "My PhD journey" },
    ];
    expect(getPendingClarificationToolName(messages)).toBe("prepare_client_feedback");
    expect(getFocusedToolNames("My PhD journey", "CLIENT", "prepare_client_feedback"))
      .toEqual(["prepare_client_feedback"]);
    expect(getPendingClarificationToolName([{ role: "user" }, { role: "assistant" }])).toBeNull();
  });

  it("routes client invitation requests and email replies to the invitation proposal tool", () => {
    expect(getFocusedToolNames("Can you invite a client if I give you the email?", "MANAGER"))
      .toEqual(["create_invitation"]);
    const messages = [
      { role: "assistant", parts: [{ type: "tool-invocation", toolInvocation: {
        toolName: "create_invitation",
        state: "result",
        result: { needsInput: true, message: "What email address?" },
      } }] },
      { role: "user", content: "client@example.com" },
    ];
    expect(getPendingClarificationToolName(messages)).toBe("create_invitation");
    expect(getFocusedToolNames("client@example.com", "MANAGER", "create_invitation"))
      .toEqual(["create_invitation"]);
  });

  it("routes direct counts to the database query tool", () => {
    expect(getFocusedToolNames("How many projects have upcoming deadlines?"))
      .toEqual(["query_studio_data"]);
  });

  it("keeps the full toolset for requests that are not a clear single intent", () => {
    expect(getFocusedToolNames("Help me plan a shoot and suggest the right workflow"))
      .toBeNull();
    expect(getFocusedToolNames("Create a project and task list for a campaign"))
      .toBeNull();
    expect(restrictTools({ smart_search: 1, create_project: 2 }, null))
      .toEqual({ smart_search: 1, create_project: 2 });
  });

  it("restricts a clear request to its matching available tool", () => {
    expect(restrictTools({ smart_search: 1, create_project: 2 }, ["create_project"]))
      .toEqual({ create_project: 2 });
  });

  it("ends follow-up tool rounds after a proposal or a required clarification", () => {
    expect(isTerminalToolResult({ requiresConfirmation: true })).toBe(true);
    expect(isTerminalToolResult({ needsInput: true })).toBe(true);
    expect(isTerminalToolResult({ clientFeedbackDraft: { type: "REVIEW" } })).toBe(true);
    expect(isTerminalToolResult({ count: 2 })).toBe(false);
    expect(getTerminalToolMessage({ needsInput: true, message: "Which client?" }))
      .toBe("Which client?");
    expect(getTerminalToolMessage({ clientFeedbackDraft: { type: "REVIEW" }, message: "Review draft ready." }))
      .toBe("Review draft ready.");
  });
});
