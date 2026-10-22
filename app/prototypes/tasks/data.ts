import type { PrototypeTask } from "./types"

export const initialTasks: PrototypeTask[] = [
  {
    id: "t1",
    title: "Select hero portraits",
    project: "North Coast Campaign",
    status: "IN_REVIEW",
    priority: "High",
    due: "Today",
    kind: "ASSIGNED",
    assignees: ["AM", "JL"],
  },
  {
    id: "t2",
    title: "Prepare studio lighting kit",
    project: "North Coast Campaign",
    status: "IN_PROGRESS",
    priority: "Medium",
    due: "Today",
    kind: "DAILY_ENTRY",
    workDate: "Today",
    assignees: ["AM"],
  },
  {
    id: "t3",
    title: "Color grade product set",
    project: "Solace Product Launch",
    status: "TODO",
    priority: "High",
    due: "Oct 24",
    kind: "ASSIGNED",
    assignees: ["JL", "SK"],
  },
  {
    id: "t4",
    title: "Export social cutdowns",
    project: "Field Notes Series",
    status: "COMPLETED",
    priority: "Low",
    due: "Oct 21",
    kind: "ASSIGNED",
    assignees: ["SK"],
  },
  {
    id: "t5",
    title: "Capture behind the scenes clips",
    project: "Field Notes Series",
    status: "IN_PROGRESS",
    priority: "Medium",
    due: "Oct 25",
    kind: "ASSIGNED",
    assignees: ["AM", "SK"],
  },
]

export const statusLabels = {
  TODO: "To do",
  IN_PROGRESS: "In progress",
  IN_REVIEW: "In review",
  COMPLETED: "Completed",
} satisfies Record<PrototypeTask["status"], string>
