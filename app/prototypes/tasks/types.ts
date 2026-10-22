export type PrototypeRole = "MANAGER" | "WORKER"

export type PrototypeTaskStatus =
  "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED"

export type PrototypeTask = {
  id: string
  title: string
  project: string
  status: PrototypeTaskStatus
  priority: "Low" | "Medium" | "High"
  due: string
  workDate?: string
  kind: "ASSIGNED" | "DAILY_ENTRY"
  assignees: string[]
}

export type TaskViewProps = {
  tasks: PrototypeTask[]
  role: PrototypeRole
  onStatusChange: (id: string, status: PrototypeTaskStatus) => void
  onDelete: (task: PrototypeTask) => void
  onReturn: (task: PrototypeTask) => void
}
