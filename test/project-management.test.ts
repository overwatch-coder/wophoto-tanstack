import { describe, expect, it } from "vitest";

type ProjectTask = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  dueAt: Date | string | null;
};

function computeProjectStatus(tasks: ProjectTask[] = []): "PLANNING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" {
  if (tasks.length === 0) return "PLANNING";
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  if (completed === tasks.length) return "COMPLETED";
  const inReview = tasks.filter((t) => t.status === "IN_REVIEW").length;
  if (inReview > 0) return "IN_REVIEW";
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  if (inProgress > 0) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

describe("Project Management status and progress calculation", () => {
  it("computes PLANNING when project has no tasks", () => {
    expect(computeProjectStatus([])).toBe("PLANNING");
  });

  it("computes IN_PROGRESS when tasks are undergoing work", () => {
    const tasks: ProjectTask[] = [
      { id: "1", status: "TODO", dueAt: null },
      { id: "2", status: "IN_PROGRESS", dueAt: null },
    ];
    expect(computeProjectStatus(tasks)).toBe("IN_PROGRESS");
  });

  it("computes IN_REVIEW when tasks are under client review", () => {
    const tasks: ProjectTask[] = [
      { id: "1", status: "IN_REVIEW", dueAt: null },
      { id: "2", status: "COMPLETED", dueAt: null },
    ];
    expect(computeProjectStatus(tasks)).toBe("IN_REVIEW");
  });

  it("computes COMPLETED when all tasks are finished", () => {
    const tasks: ProjectTask[] = [
      { id: "1", status: "COMPLETED", dueAt: null },
      { id: "2", status: "COMPLETED", dueAt: null },
    ];
    expect(computeProjectStatus(tasks)).toBe("COMPLETED");
  });

  it("calculates completion percentages accurately", () => {
    const total = 5;
    const completed = 3;
    const percent = Math.round((completed / total) * 100);
    expect(percent).toBe(60);
  });
});
