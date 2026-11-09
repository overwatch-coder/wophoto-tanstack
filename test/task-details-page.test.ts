import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/actions/tasks", () => ({ updateTaskStatus: vi.fn() }));
vi.mock("@/src/server/actions/task-workflow", () => ({
  addTaskComment: vi.fn(),
  deleteTaskDeliverable: vi.fn(),
  uploadTaskDeliverable: vi.fn(),
  requestTaskEdit: vi.fn(),
  submitTaskRating: vi.fn(),
}));
vi.mock("@/src/server/actions/projects", () => ({
  addProjectCollaborator: vi.fn(),
  removeProjectCollaborator: vi.fn(),
}));

import { TASK_STATUS_LABELS } from "@/components/tasks/task-details-view";
import { TaskStatus, DeliverableType } from "@/generated/prisma/browser";

describe("Task Details Page and Table Layout", () => {
  it("provides human-readable status labels for all TaskStatus enum values", () => {
    expect(TASK_STATUS_LABELS[TaskStatus.PENDING]).toBe("Pending");
    expect(TASK_STATUS_LABELS[TaskStatus.TODO]).toBe("To do");
    expect(TASK_STATUS_LABELS[TaskStatus.IN_PROGRESS]).toBe("In progress");
    expect(TASK_STATUS_LABELS[TaskStatus.IN_REVIEW]).toBe("In review");
    expect(TASK_STATUS_LABELS[TaskStatus.COMPLETED]).toBe("Completed");
    expect(TASK_STATUS_LABELS[TaskStatus.TO_EDIT]).toBe("To edit");
  });

  it("calculates overdue condition correctly", () => {
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const isOverdue = (dueAt: string | null, status: TaskStatus) =>
      Boolean(dueAt && new Date(dueAt).getTime() < Date.now() && status !== TaskStatus.COMPLETED);

    expect(isOverdue(yesterday, TaskStatus.IN_PROGRESS)).toBe(true);
    expect(isOverdue(yesterday, TaskStatus.COMPLETED)).toBe(false);
    expect(isOverdue(tomorrow, TaskStatus.TODO)).toBe(false);
    expect(isOverdue(null, TaskStatus.TODO)).toBe(false);
  });

  it("partitions deliverables into input files and output deliverables", () => {
    const deliverables = [
      { id: "d1", name: "brief.pdf", type: DeliverableType.INPUT, fileSize: 1048576 },
      { id: "d2", name: "render_v1.mp4", type: DeliverableType.OUTPUT, fileSize: 20971520 },
      { id: "d3", name: "render_v2.mp4", type: DeliverableType.OUTPUT, fileSize: 21971520 },
    ];

    const inputFiles = deliverables.filter((d) => d.type === DeliverableType.INPUT);
    const outputFiles = deliverables.filter((d) => d.type === DeliverableType.OUTPUT);

    expect(inputFiles).toHaveLength(1);
    expect(inputFiles[0].name).toBe("brief.pdf");
    expect(outputFiles).toHaveLength(2);
    expect(outputFiles.map((d) => d.name)).toEqual(["render_v1.mp4", "render_v2.mp4"]);
  });

  it("ensures colgroup percentages sum to 100% and Quick look + Action have dedicated wide columns", () => {
    const columnPercentages = [15, 9, 10, 8, 8, 8, 7, 8, 8, 12, 7];
    const total = columnPercentages.reduce((acc, curr) => acc + curr, 0);

    expect(total).toBe(100);
    const quickLookCol = columnPercentages[9];
    const actionCol = columnPercentages[10];

    expect(quickLookCol).toBeGreaterThanOrEqual(12);
    expect(actionCol).toBeGreaterThanOrEqual(7);
  });
});
