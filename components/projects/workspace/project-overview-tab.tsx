import { useState } from "react"
import { CheckCircle2, Plus, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"
import { AddCollaboratorDialog } from "./add-collaborator-dialog"
import type { ProjectWorkspaceData, ProjectWorkspaceTask } from "@/lib/projects"
import { TaskStatus } from "@/generated/prisma/browser"

interface ProjectOverviewTabProps {
  data: ProjectWorkspaceData
  onSelectTask: (task: ProjectWorkspaceTask) => void
}

export function ProjectOverviewTab({ data, onSelectTask }: ProjectOverviewTabProps) {
  const { project, tasks, stats, canManage } = data
  const [activeInfoTab, setActiveInfoTab] = useState<"AUDIENCE" | "MESSAGE" | "NOTE">("AUDIENCE")

  const completedTasks = tasks.filter((t) => t.status === TaskStatus.COMPLETED)

  // Build calendar strip for current week
  const today = new Date()
  const days = []
  const startOfWeek = new Date(today)
  const currentDay = today.getDay()
  const distanceToMonday = (currentDay + 6) % 7
  startOfWeek.setDate(today.getDate() - distanceToMonday)

  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek)
    d.setDate(startOfWeek.getDate() + i)
    days.push({
      dateNum: d.getDate(),
      dayName: d.toLocaleDateString("en-US", { weekday: "short" }),
      isToday: d.toDateString() === today.toDateString(),
    })
  }

  const allMembers = [
    { ...project.client, role: "Owner" },
    ...project.collaborators.map((c) => ({ ...c.user, role: "Collaborator" })),
    { ...project.manager, role: "Manager" },
  ]

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      {/* Left Column (2 Cols) */}
      <div className="lg:col-span-2 space-y-6">
        {/* Brief Info Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-border/80 pb-3">
            <h3 className="text-sm font-bold text-foreground tracking-wide">Brief Information</h3>

            {/* Sub-tabs */}
            <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => setActiveInfoTab("AUDIENCE")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeInfoTab === "AUDIENCE"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Target Audience
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab("MESSAGE")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeInfoTab === "MESSAGE"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Key Message
              </button>
              <button
                type="button"
                onClick={() => setActiveInfoTab("NOTE")}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                  activeInfoTab === "NOTE"
                    ? "bg-background text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Imagery & Notes
              </button>
            </div>
          </div>

          {/* Tab Content */}
          <div className="min-h-[70px] text-xs leading-relaxed text-muted-foreground">
            {activeInfoTab === "AUDIENCE" && (
              <p>
                {project.targetAudience ||
                  "No specific target audience documented for this project brief."}
              </p>
            )}
            {activeInfoTab === "MESSAGE" && (
              <p>
                {project.keyMessage ||
                  "No core message defined. Add key communication points in project settings."}
              </p>
            )}
            {activeInfoTab === "NOTE" && (
              <p>
                {project.imageryNote ||
                  project.description ||
                  "No additional imagery notes or creative guidelines provided."}
              </p>
            )}
          </div>

          {/* Bottom metadata row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-border pt-4 text-xs">
            <div>
              <span className="text-[11px] text-muted-foreground block">Start Date</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {project.startDate
                  ? new Date(project.startDate).toLocaleDateString("en-GB")
                  : new Date(project.createdAt).toLocaleDateString("en-GB")}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Deadline</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {project.deadline
                  ? new Date(project.deadline).toLocaleDateString("en-GB")
                  : "Flexible"}
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Briefs & Tasks</span>
              <span className="font-semibold text-foreground mt-0.5 block">
                {tasks.length} discrete tasks
              </span>
            </div>

            <div>
              <span className="text-[11px] text-muted-foreground block">Team Members</span>
              <div className="flex items-center gap-1.5 mt-1">
                {/* Avatar Stack */}
                <div className="flex -space-x-2 overflow-hidden">
                  {allMembers.slice(0, 4).map((member, idx) => (
                    <Avatar key={idx} className="size-6 border-2 border-background ring-1 ring-border">
                      <AvatarImage
                        src={getProfileImageSrc(member.image, member.id) || undefined}
                        alt={member.name || "Member"}
                      />
                      <AvatarFallback className="text-[8px] font-bold bg-primary/10 text-primary">
                        {member.name?.charAt(0).toUpperCase() || "M"}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                </div>

                {/* Add Collaborator Button */}
                <AddCollaboratorDialog
                  projectId={project.id}
                  projectName={project.name}
                  primaryClient={project.client}
                  collaborators={project.collaborators}
                  canManage={canManage}
                  trigger={
                    <button
                      type="button"
                      className="size-6 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      title="Invite Collaborator"
                    >
                      <Plus className="size-3" />
                    </button>
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* Completed Tasks section */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400" />
              Completed Tasks ({completedTasks.length})
            </h3>
          </div>

          {completedTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-3">
              No tasks have been completed yet. When specialists finish work and deliverables are
              ready, they will appear here.
            </p>
          ) : (
            <div className="space-y-2.5">
              {completedTasks.map((t) => {
                const rating = t.ratings[0]
                const worker = t.assignees[0]?.user
                const deliverables = t.deliverables.filter((d) => d.type === "OUTPUT")

                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-background p-3.5 cursor-pointer hover:border-primary/40 hover:bg-muted/20 transition-all text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <span className="font-semibold text-foreground truncate block">
                        {t.title}
                      </span>
                      <span className="text-[11px] text-muted-foreground block">
                        Start:{" "}
                        {t.startAt
                          ? new Date(t.startAt).toLocaleDateString()
                          : new Date(t.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {worker && (
                        <div className="flex items-center gap-1.5" title={worker.name || worker.email}>
                          <Avatar className="size-6">
                            <AvatarImage
                              src={getProfileImageSrc(worker.image, worker.id) || undefined}
                              alt={worker.name || "Specialist"}
                            />
                            <AvatarFallback className="text-[9px] font-bold">
                              {worker.name?.charAt(0).toUpperCase() || "W"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] text-muted-foreground hidden sm:inline">
                            {worker.name || worker.email}
                          </span>
                        </div>
                      )}

                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          deliverables.length > 0
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {deliverables.length > 0
                          ? `${deliverables.length} Deliverable${deliverables.length > 1 ? "s" : ""}`
                          : "No output yet"}
                      </span>

                      {rating && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          <Star className="size-3 fill-amber-400 text-amber-400" />
                          {rating.score} ★
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Status Card & Mini Calendar Strip */}
      <div className="space-y-6">
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-5">
          {/* Progress Header */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[11px]">
                Overall Process
              </span>
              <span className="font-bold text-foreground tabular-nums text-sm">
                {stats.percentComplete}%
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-orange-600 transition-all duration-500"
                style={{ width: `${stats.percentComplete}%` }}
              />
            </div>
          </div>

          {/* 2x2 Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                Time Remaining
              </span>
              <span className="text-base font-bold text-foreground">
                {stats.daysRemaining !== null ? `${stats.daysRemaining} d` : "Flexible"}
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                Created Tasks
              </span>
              <span className="text-base font-bold text-foreground">{stats.totalTasks}</span>
            </div>

            <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                In Progress
              </span>
              <span className="text-base font-bold text-sky-600 dark:text-sky-400">
                {stats.doingTasks}
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-background p-3 space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wide block">
                Pending / To Edit
              </span>
              <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                {stats.pendingTasks + stats.toEditTasks}
              </span>
            </div>
          </div>

          {/* Updates & Calendar Strip */}
          <div className="border-t border-border pt-4 space-y-3">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block">
              Weekly Activity
            </span>

            <div className="grid grid-cols-7 gap-1 text-center">
              {days.map((day, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col items-center justify-center rounded-lg py-2 transition-colors ${
                    day.isToday
                      ? "bg-orange-600 text-white font-bold shadow-xs"
                      : "bg-muted/40 text-foreground"
                  }`}
                >
                  <span className="text-[10px] opacity-80">{day.dayName}</span>
                  <span className="text-xs font-semibold mt-0.5">{day.dateNum}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
