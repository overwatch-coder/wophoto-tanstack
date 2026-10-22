import { CalendarDays, MoreHorizontal, Trash2 } from "lucide-react"

import { statusLabels } from "./data"
import type { TaskViewProps } from "./types"

const statusOrder = ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as const

export function TriageView({
  tasks,
  role,
  onStatusChange,
  onDelete,
  onReturn,
}: TaskViewProps) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <div className="min-w-[920px]">
        <div className="grid grid-cols-[minmax(260px,1.7fr)_minmax(150px,1fr)_120px_115px_150px_40px] gap-4 border-b bg-muted/40 px-5 py-3 text-xs font-medium text-muted-foreground">
          <span>Task</span>
          <span>Project</span>
          <span>Priority</span>
          <span>Due date</span>
          <span>People</span>
          <span />
        </div>
        {tasks.length ? (
          tasks.map((task) => (
            <div
              key={task.id}
              className="grid grid-cols-[minmax(260px,1.7fr)_minmax(150px,1fr)_120px_115px_150px_40px] items-center gap-4 border-b px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{task.title}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  <span
                    className={`rounded-sm px-1.5 py-0.5 ${task.kind === "DAILY_ENTRY" ? "bg-accent text-accent-foreground" : "bg-muted"}`}
                  >
                    {task.kind === "DAILY_ENTRY"
                      ? "Daily entry"
                      : statusLabels[task.status]}
                  </span>
                  {task.workDate && (
                    <span>Logged {task.workDate.toLowerCase()}</span>
                  )}
                </div>
              </div>
              <span className="truncate text-sm text-muted-foreground">
                {task.project}
              </span>
              <span
                className={`w-fit rounded-sm px-2 py-1 text-xs ${task.priority === "High" ? "bg-destructive/10 text-destructive" : task.priority === "Low" ? "bg-muted text-muted-foreground" : "bg-accent text-accent-foreground"}`}
              >
                {task.priority}
              </span>
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5" />
                {task.due}
              </span>
              <div className="flex -space-x-2">
                {task.assignees.map((person) => (
                  <span
                    key={person}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-card bg-secondary text-[10px] font-semibold"
                  >
                    {person}
                  </span>
                ))}
              </div>
              <div className="flex justify-end">
                {role === "MANAGER" ? (
                  task.status === "IN_REVIEW" ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onStatusChange(task.id, "COMPLETED")}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => onReturn(task)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Return
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Delete ${task.title}`}
                      title="Delete task"
                      onClick={() => onDelete(task)}
                      className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )
                ) : (
                  <button
                    type="button"
                    disabled={
                      task.status === "IN_REVIEW" || task.status === "COMPLETED"
                    }
                    aria-label={`Change status for ${task.title}`}
                    title={
                      task.status === "IN_REVIEW"
                        ? "Awaiting manager review"
                        : "Change task status"
                    }
                    onClick={() =>
                      onStatusChange(
                        task.id,
                        statusOrder[
                          (statusOrder.indexOf(task.status) + 1) %
                            statusOrder.length
                        ]
                      )
                    }
                    className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted disabled:opacity-40"
                  >
                    <MoreHorizontal className="size-4" />
                  </button>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="px-5 py-12 text-center text-sm text-muted-foreground">
            No tasks match these filters.
          </div>
        )}
      </div>
    </div>
  )
}
