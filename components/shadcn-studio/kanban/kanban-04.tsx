"use client"

import { useMemo, useState, type CSSProperties, type ReactNode } from "react"
import {
  CalendarClockIcon,
  FolderKanbanIcon,
  GripVerticalIcon,
} from "lucide-react"
import { TaskStatus, TaskType } from "@/generated/prisma/browser"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Kanban,
  KanbanBoard,
  KanbanColumn,
  KanbanColumnContent,
  KanbanItem,
  KanbanItemHandle,
  KanbanOverlay,
  type KanbanMoveEvent,
} from "@/components/ui/kanban"
import { cn } from "@/lib/utils"
import { getProfileImageSrc } from "@/lib/profile-image"
import type { TaskItem } from "@/components/tasks/tasks-workspace"

type Role = "MANAGER" | "WORKER"

type KanbanDemoModernProps = {
  tasks: TaskItem[]
  role: Role
  pending: boolean
  onTaskMove: (taskId: string, nextStatus: TaskStatus) => void
  renderTaskActions: (task: TaskItem) => ReactNode
}

const STATUS_LABELS: Record<TaskStatus, string> = {
  [TaskStatus.TODO]: "To do",
  [TaskStatus.IN_PROGRESS]: "In progress",
  [TaskStatus.IN_REVIEW]: "In review",
  [TaskStatus.COMPLETED]: "Completed",
}

const PRIORITY_STYLES: Record<TaskItem["priority"], string> = {
  LOW: "border-border bg-muted/50 text-muted-foreground",
  MEDIUM: "border-primary/25 bg-primary/5 text-primary",
  HIGH: "border-destructive/30 bg-destructive/5 text-destructive",
}

function taskDate(task: TaskItem) {
  const date = task.type === TaskType.DAILY_ENTRY ? task.workDate : task.dueAt
  if (!date) return null
  return new Date(date).toLocaleDateString("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function taskStatus(task: TaskItem, role: Role) {
  return role === "WORKER" ? (task.myStatus ?? task.status) : task.status
}

function canMoveTask(task: TaskItem, role: Role) {
  const status = taskStatus(task, role)
  if (role === "WORKER") {
    return status === TaskStatus.TODO || status === TaskStatus.IN_PROGRESS
  }
  return status === TaskStatus.IN_REVIEW
}

function getTaskColumns(tasks: TaskItem[], statuses: TaskStatus[], role: Role) {
  return Object.fromEntries(
    statuses.map((status) => [
      status,
      tasks.filter((task) => taskStatus(task, role) === status),
    ])
  )
}

function TaskCard({
  task,
  role,
  pending,
  isOverlay = false,
  renderTaskActions,
}: {
  task: TaskItem
  role: Role
  pending: boolean
  isOverlay?: boolean
  renderTaskActions: (task: TaskItem) => ReactNode
}) {
  const canDrag = canMoveTask(task, role) && !pending
  const currentStatus = taskStatus(task, role)
  const date = taskDate(task)
  const isOverdue = Boolean(
    task.dueAt &&
    new Date(task.dueAt) < new Date() &&
    task.status !== TaskStatus.COMPLETED
  )
  const ownManagerNote = task.assignees.find(
    (assignee) => assignee.isCurrentUser
  )?.managerNote

  return (
    <KanbanItem
      value={task.id}
      disabled={!canDrag || isOverlay}
      className={cn(
        "min-w-0 rounded-xl border bg-card text-card-foreground shadow-xs transition-[border-color,box-shadow]",
        canDrag && "hover:border-primary/30 hover:shadow-sm",
        isOverlay && "rotate-1 shadow-lg ring-2 ring-primary/25",
        pending && "opacity-70"
      )}
    >
      <div className="space-y-3 p-3 sm:p-3.5">
        <div className="flex min-w-0 items-start gap-2">
          {canDrag && !isOverlay ? (
            <KanbanItemHandle
              render={(handleProps) => (
                <Button
                  {...handleProps}
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={`Drag ${task.title}`}
                  title="Drag to change status"
                  className="mt-0.5 size-7 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing"
                >
                  <GripVerticalIcon aria-hidden="true" className="size-4" />
                </Button>
              )}
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-2 text-[10px] font-medium capitalize",
                  PRIORITY_STYLES[task.priority]
                )}
              >
                {task.priority.toLowerCase()}
              </Badge>
              {task.type === TaskType.DAILY_ENTRY ? (
                <Badge variant="secondary" className="h-5 px-2 text-[10px]">
                  Daily work
                </Badge>
              ) : null}
            </div>
            <h3 className="mt-2 line-clamp-2 text-sm leading-snug font-semibold wrap-break-word">
              {task.title}
            </h3>
          </div>
        </div>

        {task.description ? (
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {task.description}
          </p>
        ) : null}

        <div className="space-y-2 rounded-lg bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
          <p className="flex min-w-0 items-center gap-2">
            <FolderKanbanIcon
              aria-hidden="true"
              className="size-3.5 shrink-0"
            />
            <span className="truncate">{task.project.name}</span>
          </p>
          <p
            className={cn(
              "flex min-w-0 items-center gap-2",
              isOverdue && "text-destructive"
            )}
          >
            <CalendarClockIcon
              aria-hidden="true"
              className="size-3.5 shrink-0"
            />
            <span className="truncate">
              {date
                ? task.type === TaskType.DAILY_ENTRY
                  ? `Worked ${date}`
                  : `Due ${date}`
                : "No date set"}
            </span>
          </p>
        </div>

        {task.assignees.length > 0 ? (
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex shrink-0 -space-x-2">
              {task.assignees.slice(0, 4).map((assignee) => {
                const name = assignee.user.name || assignee.user.email
                const initials = name
                  .split(" ")
                  .map((part) => part[0])
                  .join("")
                  .slice(0, 2)
                return (
                  <Avatar
                    key={assignee.userId}
                    size="sm"
                    className="ring-2 ring-card"
                    aria-label={name}
                  >
                    <AvatarImage
                      src={
                        getProfileImageSrc(
                          assignee.user.image,
                          assignee.userId
                        ) ?? undefined
                      }
                      alt={name}
                    />
                    <AvatarFallback>{initials}</AvatarFallback>
                  </Avatar>
                )
              })}
              {task.assignees.length > 4 ? (
                <Avatar
                  size="sm"
                  className="ring-2 ring-card"
                  aria-label={`${task.assignees.length - 4} more assignees`}
                >
                  <AvatarFallback className="text-[9px]">
                    +{task.assignees.length - 4}
                  </AvatarFallback>
                </Avatar>
              ) : null}
            </div>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {task.assignees.length === 1
                ? task.assignees[0].user.name || task.assignees[0].user.email
                : `${task.assignees.length} collaborators`}
            </span>
          </div>
        ) : null}

        {ownManagerNote ? (
          <p className="rounded-md border border-destructive/20 bg-destructive/5 px-2.5 py-2 text-xs text-destructive">
            {ownManagerNote}
          </p>
        ) : null}

        {!isOverlay ? (
          <div className="flex min-h-10 flex-wrap items-center gap-1.5 border-t pt-2.5 [&_button]:shrink-0">
            {renderTaskActions(task)}
            {currentStatus ? (
              <span className="sr-only">
                Status: {STATUS_LABELS[currentStatus]}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </KanbanItem>
  )
}

function TaskColumn({
  status,
  tasks,
  role,
  pending,
  isOverlay = false,
  renderTaskActions,
}: {
  status: TaskStatus
  tasks: TaskItem[]
  role: Role
  pending: boolean
  isOverlay?: boolean
  renderTaskActions: (task: TaskItem) => ReactNode
}) {
  return (
    <KanbanColumn
      value={status}
      disabled
      className={cn("flex min-w-0 flex-col", isOverlay && "opacity-95")}
    >
      <section className="flex min-h-64 max-w-xs flex-col rounded-xl border bg-muted/30 p-2 shadow-xs">
        <header className="mb-2 flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2.5">
          <h2 className="flex min-w-0 items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className={cn(
                "size-2 shrink-0 rounded-full",
                status === TaskStatus.IN_REVIEW
                  ? "bg-primary"
                  : "bg-muted-foreground/50"
              )}
            />
            <span className="truncate">{STATUS_LABELS[status]}</span>
          </h2>
          <Badge variant="secondary" className="tabular-nums">
            {tasks.length}
          </Badge>
        </header>

        <KanbanColumnContent value={status} className="min-h-0 gap-2 p-1">
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              role={role}
              pending={pending}
              renderTaskActions={renderTaskActions}
            />
          ))}
          {tasks.length === 0 ? (
            <p className="flex min-h-20 min-w-0 items-center justify-center rounded-lg border border-dashed bg-card/60 px-3 text-center text-xs wrap-anywhere text-muted-foreground">
              {role === "MANAGER"
                ? "No tasks in this status yet."
                : "Drop here to update status."}
            </p>
          ) : null}
        </KanbanColumnContent>
      </section>
    </KanbanColumn>
  )
}

function KanbanDemoModern(props: KanbanDemoModernProps) {
  const taskStateKey = props.tasks
    .map(
      (task) =>
        `${task.id}:${task.status}:${task.myStatus ?? ""}:${String(task.updatedAt)}`
    )
    .join("|")

  return <KanbanBoardState key={`${props.role}:${taskStateKey}`} {...props} />
}

function KanbanBoardState({
  tasks,
  role,
  pending,
  onTaskMove,
  renderTaskActions,
}: KanbanDemoModernProps) {
  const statuses = useMemo(
    () =>
      role === "MANAGER"
        ? [
            TaskStatus.TODO,
            TaskStatus.IN_PROGRESS,
            TaskStatus.IN_REVIEW,
            TaskStatus.COMPLETED,
          ]
        : [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW],
    [role]
  )
  const [columns, setColumns] = useState(() =>
    getTaskColumns(tasks, statuses, role)
  )

  function handleMove({
    activeContainer,
    activeIndex,
    overContainer,
  }: KanbanMoveEvent) {
    if (activeContainer === overContainer) return
    const task = columns[activeContainer]?.[activeIndex]
    const nextStatus = overContainer as TaskStatus
    if (!task || !statuses.includes(nextStatus) || !canMoveTask(task, role))
      return
    onTaskMove(task.id, nextStatus)
  }

  return (
    <div className="w-full max-w-full min-w-0 touch-pan-x overflow-x-auto overscroll-x-contain pb-2">
      <Kanban
        value={columns}
        onValueChange={setColumns}
        getItemValue={(task: TaskItem) => task.id}
        onMove={handleMove}
        className="w-max min-w-full"
      >
        <KanbanBoard
          className="task-kanban-board grid auto-rows-auto gap-3"
          style={
            {
              "--kanban-column-count": statuses.length,
              "--kanban-mobile-board-min": `${statuses.length * 15}rem`,
              "--kanban-desktop-board-min": `${statuses.length * 17}rem`,
            } as CSSProperties
          }
        >
          {statuses.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              tasks={columns[status] ?? []}
              role={role}
              pending={pending}
              renderTaskActions={renderTaskActions}
            />
          ))}
        </KanbanBoard>
        <KanbanOverlay>
          {({ value, variant }) => {
            const activeValue = String(value)
            if (variant === "column") {
              const status = activeValue as TaskStatus
              return (
                <TaskColumn
                  status={status}
                  tasks={columns[status] ?? []}
                  role={role}
                  pending={pending}
                  isOverlay
                  renderTaskActions={renderTaskActions}
                />
              )
            }
            const task = Object.values(columns)
              .flat()
              .find((item) => item.id === activeValue)
            return task ? (
              <TaskCard
                task={task}
                role={role}
                pending={pending}
                isOverlay
                renderTaskActions={renderTaskActions}
              />
            ) : null
          }}
        </KanbanOverlay>
      </Kanban>
    </div>
  )
}

export { KanbanDemoModern }
