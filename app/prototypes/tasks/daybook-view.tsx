import { CalendarDays, Check, Circle, Clock3, Trash2 } from "lucide-react"

import type { PrototypeTask, TaskViewProps } from "./types"

export function DaybookView({
  tasks,
  role,
  onStatusChange,
  onDelete,
  onReturn,
}: TaskViewProps) {
  const daily = tasks.filter((task) => task.kind === "DAILY_ENTRY")
  const active = tasks.filter(
    (task) => task.kind === "ASSIGNED" && task.status !== "COMPLETED"
  )
  const done = tasks.filter((task) => task.status === "COMPLETED")
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.8fr)]">
      <section className="rounded-md border bg-card p-5 sm:p-6">
        <div className="mb-5 flex items-end justify-between gap-4 border-b pb-4">
          <div>
            <p className="text-sm text-muted-foreground">
              Wednesday, October 22
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">
              Today’s work
            </h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="size-4" />
            UTC
          </div>
        </div>
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          DAILY ENTRIES
        </p>
        <div className="space-y-1">
          {daily.map((task) => (
            <DayRow
              key={task.id}
              task={task}
              role={role}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
          {daily.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">
              No daily entries yet. Add what you plan to work on.
            </p>
          )}
        </div>
        <div className="mt-7 mb-3 flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            ASSIGNED TO YOU
          </p>
          <span className="text-xs text-muted-foreground">
            {active.length} active
          </span>
        </div>
        <div className="space-y-1">
          {active.map((task) => (
            <DayRow
              key={task.id}
              task={task}
              role={role}
              onStatusChange={onStatusChange}
              onDelete={onDelete}
            />
          ))}
        </div>
      </section>
      <aside className="space-y-4">
        <section className="rounded-md border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Needs your attention</h2>
            <span className="flex size-6 items-center justify-center rounded-full bg-accent text-xs font-medium text-accent-foreground">
              {tasks.filter((task) => task.status === "IN_REVIEW").length}
            </span>
          </div>
          {tasks
            .filter((task) => task.status === "IN_REVIEW")
            .map((task) => (
              <div key={task.id} className="border-t py-3 first:border-t-0">
                <p className="text-sm font-medium">{task.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {task.project} · Ready for review
                </p>
                {role === "MANAGER" && (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => onStatusChange(task.id, "COMPLETED")}
                      className="h-8 rounded-sm bg-primary px-3 text-xs font-medium text-primary-foreground"
                    >
                      Approve task
                    </button>
                    <button
                      type="button"
                      onClick={() => onReturn(task)}
                      className="h-8 rounded-sm border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Return
                    </button>
                  </div>
                )}
              </div>
            ))}
          {tasks.every((task) => task.status !== "IN_REVIEW") && (
            <p className="text-sm text-muted-foreground">
              You’re all caught up.
            </p>
          )}
        </section>
        <section className="rounded-md border bg-card p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recently completed</h2>
            <Check className="size-4 text-primary" />
          </div>
          {done.map((task) => (
            <div key={task.id} className="border-t py-3 first:border-t-0">
              <p className="text-sm font-medium">{task.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {task.project}
              </p>
            </div>
          ))}
          {done.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Completed tasks will appear here.
            </p>
          )}
        </section>
      </aside>
    </div>
  )
}

function DayRow({
  task,
  role,
  onStatusChange,
  onDelete,
}: Pick<TaskViewProps, "role" | "onStatusChange" | "onDelete"> & {
  task: PrototypeTask
}) {
  const completed = task.status === "COMPLETED"
  const next =
    task.status === "TODO"
      ? "IN_PROGRESS"
      : task.status === "IN_PROGRESS"
        ? "IN_REVIEW"
        : "COMPLETED"
  return (
    <div className="flex items-center gap-3 border-b py-3 last:border-b-0">
      <button
        type="button"
        disabled={
          role === "WORKER" && (task.status === "IN_REVIEW" || completed)
        }
        aria-label={`${completed ? "Reopen" : "Update"} ${task.title}`}
        title={
          task.status === "IN_REVIEW" ? "Awaiting manager review" : undefined
        }
        onClick={() => onStatusChange(task.id, next)}
        className="flex size-7 shrink-0 items-center justify-center rounded-sm text-muted-foreground hover:bg-muted disabled:opacity-50"
      >
        {completed ? (
          <Check className="size-4 text-primary" />
        ) : task.status === "IN_PROGRESS" ? (
          <Clock3 className="size-4 text-primary" />
        ) : (
          <Circle className="size-4" />
        )}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={`truncate text-sm font-medium ${completed ? "text-muted-foreground line-through" : ""}`}
        >
          {task.title}
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {task.project}
          {task.due && ` · Due ${task.due.toLowerCase()}`}
        </p>
      </div>
      {role === "MANAGER" && (
        <button
          type="button"
          aria-label={`Delete ${task.title}`}
          onClick={() => onDelete(task)}
          className="rounded-sm p-1.5 text-muted-foreground hover:bg-muted hover:text-destructive"
        >
          <Trash2 className="size-4" />
        </button>
      )}
    </div>
  )
}
