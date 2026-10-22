import { describe, expect, it } from "vitest";

describe("Dashboard & Analytics calculations", () => {
  it("calculates on-time delivery rate correctly", () => {
    const tasks = [
      { id: "t1", completedAt: new Date("2026-10-10"), dueAt: new Date("2026-10-12") }, // on-time
      { id: "t2", completedAt: new Date("2026-10-15"), dueAt: new Date("2026-10-14") }, // late
      { id: "t3", completedAt: new Date("2026-10-18"), dueAt: new Date("2026-10-18") }, // on-time
      { id: "t4", completedAt: new Date("2026-10-20"), dueAt: null }, // on-time (no deadline)
    ];

    const completed = tasks;
    const onTime = completed.filter((t) => {
      if (!t.dueAt || !t.completedAt) return true;
      return t.completedAt <= t.dueAt;
    }).length;

    const rate = Math.round((onTime / completed.length) * 100 * 10) / 10;
    expect(rate).toBe(75.0);
  });

  it("calculates active tasks per collaborator load", () => {
    const activeTasks = 22;
    const workers = 4;
    const loadPerPerson = Math.round((activeTasks / workers) * 10) / 10;
    expect(loadPerPerson).toBe(5.5);
  });

  it("determines collaborator capacity status threshold", () => {
    const getCapacity = (activeCount: number): "optimal" | "heavy" | "light" =>
      activeCount > 15 ? "heavy" : activeCount < 5 ? "light" : "optimal";

    expect(getCapacity(25)).toBe("heavy");
    expect(getCapacity(10)).toBe("optimal");
    expect(getCapacity(2)).toBe("light");
  });

  it("calculates project progress percentage for client portal", () => {
    const project = {
      totalTasks: 20,
      completedTasks: 16,
    };

    const progressPct = Math.round((project.completedTasks / project.totalTasks) * 100);
    expect(progressPct).toBe(80);
  });

  it("handles empty project deliverables gracefully", () => {
    const project = {
      totalTasks: 0,
      completedTasks: 0,
    };

    const progressPct = project.totalTasks > 0 ? Math.round((project.completedTasks / project.totalTasks) * 100) : 0;
    expect(progressPct).toBe(0);
  });
});
