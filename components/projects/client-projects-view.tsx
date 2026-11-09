import { Link } from "@tanstack/react-router"
import { FolderKanban, Search } from "lucide-react";
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getProfileImageSrc } from "@/lib/profile-image"

export type ClientProjectListItem = {
  id: string
  name: string
  description: string | null
  coverImage: string | null
  startDate: Date | string | null
  deadline: Date | string | null
  updatedAt: Date | string
  client: {
    id: string
    name: string | null
    image: string | null
  }
  collaborators: Array<{
    id: string
    user: {
      id: string
      name: string | null
      image: string | null
    }
  }>
  totalTasks: number
  completedTasks: number
  percentComplete: number
}

interface ClientProjectsViewProps {
  projects: ClientProjectListItem[]
}

export function ClientProjectsView({ projects }: ClientProjectsViewProps) {
  const [search, setSearch] = useState("")

  const filtered = projects.filter((p) => {
    const q = search.toLowerCase()
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Projects Workspace</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Access your multimedia projects, review deliverables, request edits, and collaborate with
            the studio team.
          </p>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>
      </div>

      {/* Projects Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border p-12 text-center bg-card">
          <FolderKanban className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">No projects found</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            {projects.length === 0
              ? "You haven't been assigned to any project workspace yet."
              : "No projects match your current search query."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((project) => {
            const allMembers = [
              project.client,
              ...project.collaborators.map((c) => c.user),
            ]

            return (
              <Link
                key={project.id}
                to="/client/projects/$projectId"
                params={{ projectId: project.id }}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card shadow-xs transition-all hover:border-primary/40 hover:shadow-md"
              >
                {/* Cover Image or Gradient */}
                <div className="relative h-36 w-full overflow-hidden bg-muted">
                  {project.coverImage ? (
                    <div
                      className="h-full w-full bg-cover bg-center transition-transform duration-500 group-hover:scale-105"
                      style={{ backgroundImage: `url(${project.coverImage})` }}
                    />
                  ) : (
                    <div className="h-full w-full bg-gradient-to-tr from-stone-900 via-orange-950 to-stone-900 p-4 flex flex-col justify-end text-white">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400">
                        WoPhoto Studio
                      </span>
                    </div>
                  )}

                  {/* Tasks Badge */}
                  <span className="absolute top-3 right-3 rounded-md bg-black/60 backdrop-blur-md px-2 py-0.5 text-[11px] font-bold text-white shadow-xs">
                    {project.completedTasks}/{project.totalTasks} Tasks
                  </span>
                </div>

                {/* Card Content */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h3 className="font-bold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {project.name}
                    </h3>
                    {project.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {project.description}
                      </p>
                    ) : (
                      <p className="text-xs text-muted-foreground/60 italic">No description</p>
                    )}
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-1.5 pt-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Progress</span>
                      <span className="font-bold text-foreground tabular-nums">
                        {project.percentComplete}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-orange-600 transition-all duration-300"
                        style={{ width: `${project.percentComplete}%` }}
                      />
                    </div>
                  </div>

                  {/* Card Footer: Members & Date */}
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    {/* Team Members stack */}
                    <div className="flex -space-x-1.5 overflow-hidden">
                      {allMembers.slice(0, 4).map((member, idx) => (
                        <Avatar
                          key={idx}
                          className="size-5 border-2 border-background ring-1 ring-border"
                        >
                          <AvatarImage
                            src={getProfileImageSrc(member.image, member.id) || undefined}
                            alt={member.name || "Member"}
                          />
                          <AvatarFallback className="text-[7px] font-bold">
                            {member.name?.charAt(0).toUpperCase() || "M"}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>

                    <span className="text-[11px] text-muted-foreground">
                      {project.deadline
                        ? `Due ${new Date(project.deadline).toLocaleDateString()}`
                        : `Updated ${new Date(project.updatedAt).toLocaleDateString()}`}
                    </span>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
