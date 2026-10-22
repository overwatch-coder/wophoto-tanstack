import { CalendarDays, Trash2 } from "lucide-react"
import { useState } from "react"
import type { DragEventHandler } from "react"

import { statusLabels } from "./data"
import type { PrototypeTask, TaskViewProps } from "./types"

const columns = ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"] as const

export function FlowView({
  tasks,
  role,
  onStatusChange,
  onDelete,
  onReturn,
}: TaskViewProps) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const canDropTask = (
    task: PrototypeTask,
    nextStatus: (typeof columns)[number]
  ) => {
    if (task.status === "IN_REVIEW" || task.status === "COMPLETED") return false
    if (task.status === nextStatus || nextStatus === "COMPLETED") return false
    if (nextStatus === "IN_REVIEW") return role === "WORKER"
    return true
  }

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[920px] grid-cols-4 gap-3">
        {columns.map((status) => {
          const entries = tasks.filter((task) => task.status === status)
          return (
            <section
              key={status}
              className="min-h-80 rounded-md border bg-muted/25 p-3"
              onDragOver={(event) => {
                const task = tasks.find((item) => item.id === draggingTaskId)
                if (task && canDropTask(task, status)) {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = "move"
                }
              }}
              onDrop={(event) => {
                event.preventDefault()
                const task = tasks.find((item) => item.id === draggingTaskId)
                if (task && canDropTask(task, status)) {
                  onStatusChange(task.id, status)
                }
                setDraggingTaskId(null)
              }}
            >
              <header className="mb-3 flex items-center justify-between px-1">
                <h2 className="text-sm font-semibold">
                  {statusLabels[status]}
                </h2>
                <span className="rounded-sm bg-background px-2 py-0.5 text-xs text-muted-foreground">
                  {entries.length}
                </span>
              </header>
              <div className="space-y-2">
                {entries.map((task) => (
                  <FlowCard
                    key={task.id}
                    task={task}
                    role={role}
                    onStatusChange={onStatusChange}
                    onDelete={onDelete}
                    onReturn={onReturn}
                    onDragStart={(event) => {
                      if (
                        !canDropTask(task, "IN_PROGRESS") &&
                        task.status !== "IN_PROGRESS"
                      ) {
                        event.preventDefault()
                        return
                      }
                      setDraggingTaskId(task.id)
                      event.dataTransfer.setData("text/plain", task.id)
                      event.dataTransfer.effectAllowed = "move"
                    }}
                    onDragEnd={() => setDraggingTaskId(null)}
                  />
                ))}
                {entries.length === 0 && (
                  <p className="px-1 py-4 text-xs text-muted-foreground">
                    Nothing here yet
                  </p>
                )}
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}

function FlowCard({
  task,
  role,
  onStatusChange,
  onDelete,
  onReturn,
  onDragStart,
  onDragEnd,
}: Pick<TaskViewProps, "role" | "onStatusChange" | "onDelete" | "onReturn"> & {
  task: PrototypeTask
  onDragStart: DragEventHandler<HTMLElement>
  onDragEnd: DragEventHandler<HTMLElement>
}) {
  const nextStatus =
    task.status === "TODO"
      ? "IN_PROGRESS"
      : task.status === "IN_PROGRESS"
        ? "IN_REVIEW"
        : "COMPLETED"
  return (
    <article
      draggable={task.status === "TODO" || task.status === "IN_PROGRESS"}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className="cursor-grab rounded-md border bg-card p-3 shadow-sm shadow-black/[0.02] active:cursor-grabbing"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">{task.project}</p>
          <h3 className="mt-1 text-sm leading-5 font-medium">{task.title}</h3>
        </div>
        {role === "MANAGER" && (
          <button
            type="button"
            aria-label={`Delete ${task.title}`}
            onClick={() => onDelete(task)}
            className="rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
          >
            <Trash2 className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between border-t pt-2.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarDays className="size-3.5" />
          {task.due}
        </div>
        <div className="flex -space-x-1.5">
          {task.assignees.map((person) => (
            <span
              key={person}
              className="flex size-6 items-center justify-center rounded-full border-2 border-card bg-secondary text-[9px] font-semibold"
            >
              {person}
            </span>
          ))}
        </div>
      </div>
      {role === "MANAGER" && task.status === "IN_REVIEW" ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onStatusChange(task.id, "COMPLETED")}
            className="h-8 rounded-sm bg-primary px-2 text-xs font-medium text-primary-foreground"
          >
            Approve
          </button>
          <button
            type="button"
            onClick={() => onReturn(task)}
            className="h-8 rounded-sm border px-2 text-xs font-medium hover:bg-muted"
          >
            Return
          </button>
        </div>
      ) : (
        (task.status === "TODO" || task.status === "IN_PROGRESS") &&
        (role === "WORKER" ? (
          <button
            type="button"
            onClick={() => onStatusChange(task.id, nextStatus)}
            className="mt-3 h-8 w-full rounded-sm border text-xs font-medium hover:bg-muted"
          >
            {task.status === "IN_PROGRESS" ? "Submit for review" : "Start task"}
          </button>
        ) : (
          <button
            type="button"
            onClick={() =>
              onStatusChange(
                task.id,
                task.status === "TODO" ? "IN_PROGRESS" : "TODO"
              )
            }
            className="mt-3 h-8 w-full rounded-sm border text-xs font-medium hover:bg-muted"
          >
            {task.status === "TODO" ? "Move to in progress" : "Move to to do"}
          </button>
        ))
      )}
      {role === "WORKER" && task.status === "IN_REVIEW" && (
        <p className="mt-3 rounded-sm bg-accent/50 px-2.5 py-2 text-xs text-accent-foreground">
          Awaiting manager review
        </p>
      )}
    </article>
  )
}
