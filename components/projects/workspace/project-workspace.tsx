import { useState } from "react"
import { Link, useRouter } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react";
import { ProjectOverviewTab } from "./project-overview-tab"
import { ProjectTasksView } from "./project-tasks-view"
import { FilesView } from "./files-view"
import { TaskDetailsSheet } from "./task-details-sheet"
import { AddCollaboratorDialog } from "./add-collaborator-dialog"
import type { ProjectWorkspaceData, ProjectWorkspaceTask } from "@/lib/projects"

interface ProjectWorkspaceProps {
  data: ProjectWorkspaceData
  backUrl?: string
}

export function ProjectWorkspace({ data, backUrl = "/manager/projects" }: ProjectWorkspaceProps) {
  const { project, tasks, stats, currentUserRole, canManage } = data
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<"OVERVIEW" | "TASKS" | "FILES">("OVERVIEW")
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const selectedTask = selectedTaskId
    ? tasks.find((t) => t.id === selectedTaskId) ?? null
    : null

  function handleSelectTask(task: ProjectWorkspaceTask) {
    if (currentUserRole === "CLIENT") {
      router.navigate({
        href: `/client/tasks/${task.id}`,
      })
      return
    }

    setSelectedTaskId(task.id)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Navigation & Back link */}
      <div className="flex items-center justify-between">
        <Link
          to={backUrl}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" />
          Back to Projects
        </Link>

        <div className="flex items-center gap-2">
          {/* Add Collaborator Dialog */}
          <AddCollaboratorDialog
            projectId={project.id}
            projectName={project.name}
            primaryClient={project.client}
            collaborators={project.collaborators}
            canManage={canManage}
          />
        </div>
      </div>

      {/* Cover Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-border shadow-xs">
        {project.coverImage ? (
          <div
            className="h-44 sm:h-52 w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${project.coverImage})` }}
          />
        ) : (
          <div className="h-44 sm:h-52 w-full bg-gradient-to-r from-stone-900 via-orange-950 to-stone-900 p-6 flex flex-col justify-end text-white">
            <span className="text-xs font-bold tracking-widest uppercase text-orange-400">
              Workspace Project
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mt-1 text-white">
              {project.name}
            </h1>
          </div>
        )}

        {/* Banner Details Overlay Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-border bg-card px-6 py-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-bold text-foreground">{project.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                  stats.percentComplete === 100
                    ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    : stats.doingTasks > 0
                      ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {stats.percentComplete === 100
                  ? "Completed"
                  : stats.doingTasks > 0
                    ? "In Progress"
                    : "Active"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Client: <span className="font-semibold text-foreground">{project.client.name || project.client.email}</span>
              {project.collaborators.length > 0 && (
                <span>
                  {" "}
                  • {project.collaborators.length} collaborator{project.collaborators.length > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </div>

          {/* Navigation Tabs Switcher */}
          <div className="flex items-center gap-1 rounded-xl border border-border bg-muted/40 p-1 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setActiveTab("OVERVIEW")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "OVERVIEW"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("TASKS")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "TASKS"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Tasks ({tasks.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("FILES")}
              className={`flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                activeTab === "FILES"
                  ? "bg-orange-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Files ({stats.deliverablesCount})
            </button>
          </div>
        </div>
      </div>

      {/* Main Tab Panels */}
      {activeTab === "OVERVIEW" && (
        <ProjectOverviewTab data={data} onSelectTask={handleSelectTask} />
      )}

      {activeTab === "TASKS" && (
        <ProjectTasksView
          tasks={tasks}
          projectName={project.name}
          onSelectTask={handleSelectTask}
          currentUserRole={currentUserRole}
        />
      )}

      {activeTab === "FILES" && <FilesView tasks={tasks} />}

      {/* Task Details Sheet Modal */}
      <TaskDetailsSheet
        task={selectedTask}
        projectName={project.name}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        currentUserRole={currentUserRole}
      />
    </div>
  )
}
