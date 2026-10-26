import { describe, expect, it } from "vitest";
import { getFocusedToolNames, getPendingClarificationToolName, restrictTools } from "@/lib/ai/tool-routing";
import { getTerminalToolMessage, isTerminalToolResult } from "@/lib/ai/tool-loop";

describe("Copilot tool routing", () => {
  it("routes worker daily work logging to its confirmation tool", () => {
    expect(getFocusedToolNames("Please log my daily work: I logged 20 photos today for Jossy Wedding", "WORKER"))
      .toEqual(["create_daily_entry"]);
    const messages = [
      { role: "assistant", parts: [{ type: "tool-invocation", toolInvocation: { toolName: "create_daily_entry", state: "result", result: { needsInput: true, message: "Which project?" } } }] },
      { role: "user", content: "Jossy Wedding" },
    ];
    expect(getPendingClarificationToolName(messages)).toBe("create_daily_entry");
    expect(getFocusedToolNames("Jossy Wedding", "WORKER", "create_daily_entry")).toEqual(["create_daily_entry"]);
  });

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

  it("routes client work and new project requests to the intake draft tool", () => {
    expect(getFocusedToolNames("I want to submit a work request for the product campaign", "CLIENT"))
      .toEqual(["prepare_work_request"]);
    expect(getFocusedToolNames("Can you create a new project for me?", "CLIENT"))
      .toEqual(["prepare_work_request"]);
    expect(getFocusedToolNames("Create a project for this client", "MANAGER"))
      .toEqual(["create_project"]);
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

  it("keeps a short client reply focused on the work request clarification", () => {
    const messages = [
      { role: "assistant", parts: [{ type: "tool-invocation", toolInvocation: { toolName: "prepare_work_request", state: "result", result: { needsInput: true, message: "Which project?" } } }] },
      { role: "user", content: "Spring campaign" },
    ];
    expect(getPendingClarificationToolName(messages)).toBe("prepare_work_request");
    expect(getFocusedToolNames("Spring campaign", "CLIENT", "prepare_work_request")).toEqual(["prepare_work_request"]);
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

  it("routes client work request lookups to the database tool, not smart search or request creation", () => {
    expect(getFocusedToolNames("How many work requests do I have?", "CLIENT"))
      .toEqual(["query_studio_data"]);
    expect(getFocusedToolNames("Do I have work or project requests?", "CLIENT"))
      .toEqual(["query_studio_data"]);
    expect(getFocusedToolNames("Show my work requests", "CLIENT"))
      .toEqual(["query_studio_data"]);
    expect(getFocusedToolNames("Find my work request about portraits", "CLIENT"))
      .toEqual(["query_studio_data"]);
    expect(getFocusedToolNames("Submit a work request for my product project", "CLIENT"))
      .toEqual(["prepare_work_request"]);
  });

  it("routes inventory reads to one structured query and inventory changes through confirmation", () => {
    expect(getFocusedToolNames("How many cameras are available in inventory?", "MANAGER"))
      .toEqual(["query_studio_data"]);
    expect(getFocusedToolNames("Create a new inventory item named Sony FX3", "MANAGER"))
      .toEqual(["prepare_inventory_action"]);
    expect(getFocusedToolNames("Check out the Sony FX3 from inventory", "WORKER"))
      .toEqual(["query_studio_data", "prepare_inventory_action"]);
    expect(getFocusedToolNames("Check out the available Sony FX3 in inventory", "WORKER"))
      .toEqual(["query_studio_data", "prepare_inventory_action"]);
  });

  it("does not expose inventory actions to clients", () => {
    expect(getFocusedToolNames("Create a new inventory item", "CLIENT")).toEqual([]);
    expect(getFocusedToolNames("Return an inventory item", "CLIENT")).toEqual([]);
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
    expect(isTerminalToolResult({ workRequestDraft: { type: "WORK" } })).toBe(true);
    expect(isTerminalToolResult({ count: 2 })).toBe(false);
    expect(getTerminalToolMessage({ needsInput: true, message: "Which client?" }))
      .toBe("Which client?");
    expect(getTerminalToolMessage({ clientFeedbackDraft: { type: "REVIEW" }, message: "Review draft ready." }))
      .toBe("Review draft ready.");
    expect(getTerminalToolMessage({ workRequestDraft: { type: "WORK" }, message: "Request draft ready." }))
      .toBe("Request draft ready.");
  });
});
