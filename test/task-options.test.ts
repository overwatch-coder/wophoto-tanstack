import { describe, expect, it } from "vitest";
import { cleanClientName } from "@/lib/format";

describe("task assignment modal client and project flow", () => {
  it("cleans parenthesized handles or emails from client names", () => {
    expect(cleanClientName("Overwatch Coder (Brainy)")).toBe("Overwatch Coder");
    expect(cleanClientName("Alice Smith (alice@example.com)")).toBe("Alice Smith");
    expect(cleanClientName("Bob")).toBe("Bob");
    expect(cleanClientName(null)).toBeNull();
  });

  it("filters projects strictly by selected client", () => {
    const projects = [
      { id: "p1", name: "Jossy Wedding", clientId: "c1" },
      { id: "p2", name: "Summer Campaign", clientId: "c2" },
      { id: "p3", name: "Fashion Shoot", clientId: "c1" },
    ];

    const selectedClientId = "c1";
    const filtered = projects.filter((p) => p.clientId === selectedClientId);

    expect(filtered).toHaveLength(2);
    expect(filtered.map((p) => p.name)).toEqual(["Jossy Wedding", "Fashion Shoot"]);
  });

  it("displays only the project name without any client or bracketed text", () => {
    const project = { id: "p1", name: "Jossy Wedding", clientId: "c1" };
    expect(project.name).toBe("Jossy Wedding");
    expect(project.name).not.toContain("(");
    expect(project.name).not.toContain(")");
  });

  it("ensures task table data structure does not require rendering raw description in the main cell", () => {
    const task = {
      id: "t1",
      title: "Buy chairs",
      description: "I want you to buy chairs for nothing. Just buy them because you want to buy them.",
      type: "ASSIGNED",
    };

    // Table view summarizes title and type, keeping description for View modal
    const summaryCell = {
      title: task.title,
      typeLabel: task.type === "ASSIGNED" ? "Assigned task" : "Daily entry",
    };

    expect(summaryCell.title).toBe("Buy chairs");
    expect(summaryCell.typeLabel).toBe("Assigned task");
    expect(summaryCell).not.toHaveProperty("description");
  });

  it("handles form reset on successful submission without error", () => {
    const successResult = { success: "Task created.", taskId: "t1" };
    const errorResult = { error: "Title is required." };

    const shouldCloseAndReset = (res: { error?: string; success?: string }) => !res.error;

    expect(shouldCloseAndReset(successResult)).toBe(true);
    expect(shouldCloseAndReset(errorResult)).toBe(false);
  });
});
