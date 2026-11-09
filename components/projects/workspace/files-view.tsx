import { useState } from "react"
import { Download, Eye, FileText, FolderOpen, Image, Search, Video } from "lucide-react";
import { DeliverableType } from "@/generated/prisma/browser"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { ProjectWorkspaceTask } from "@/lib/projects"

interface FilesViewProps {
  tasks: ProjectWorkspaceTask[]
}

export function FilesView({ tasks }: FilesViewProps) {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<"ALL" | DeliverableType>("ALL")

  // Flatten all files from tasks
  const allFiles = tasks.flatMap((t) =>
    t.deliverables.map((d) => ({
      ...d,
      taskTitle: t.title,
      taskId: t.id,
      taskStatus: t.status,
    }))
  )

  const filtered = allFiles.filter((file) => {
    const matchesSearch = file.name.toLowerCase().includes(search.toLowerCase()) ||
      file.taskTitle.toLowerCase().includes(search.toLowerCase())
    const matchesType = filterType === "ALL" || file.type === filterType
    return matchesSearch && matchesType
  })

  function getFileIcon(name: string) {
    const ext = name.split(".").pop()?.toLowerCase()
    if (ext === "mp4" || ext === "mov" || ext === "avi" || ext === "mkv") {
      return <Video className="size-5 text-purple-600 dark:text-purple-400" />
    }
    if (ext === "jpg" || ext === "jpeg" || ext === "png" || ext === "webp" || ext === "svg") {
      return <Image className="size-5 text-sky-600 dark:text-sky-400" />
    }
    return <FileText className="size-5 text-amber-600 dark:text-amber-400" />
  }

  return (
    <div className="space-y-4">
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search deliverables & files..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 text-xs h-9 bg-background"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          <Button
            type="button"
            variant={filterType === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("ALL")}
            className="text-xs h-8"
          >
            All Files ({allFiles.length})
          </Button>
          <Button
            type="button"
            variant={filterType === DeliverableType.OUTPUT ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(DeliverableType.OUTPUT)}
            className="text-xs h-8"
          >
            Deliverables ({allFiles.filter((f) => f.type === DeliverableType.OUTPUT).length})
          </Button>
          <Button
            type="button"
            variant={filterType === DeliverableType.INPUT ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType(DeliverableType.INPUT)}
            className="text-xs h-8"
          >
            References ({allFiles.filter((f) => f.type === DeliverableType.INPUT).length})
          </Button>
        </div>
      </div>

      {/* Files Grid */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border p-12 text-center bg-card">
          <FolderOpen className="size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-semibold text-foreground">No deliverables or files found</p>
          <p className="text-xs text-muted-foreground max-w-sm mt-1">
            Deliverable files uploaded by specialists and reference documents will be cataloged
            here for quick preview and download.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((file) => (
            <div
              key={file.id}
              className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="rounded-lg bg-muted p-2">{getFileIcon(file.name)}</div>
                    <div className="min-w-0">
                      <h4 className="truncate text-xs font-semibold text-foreground" title={file.name}>
                        {file.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground">
                        {file.fileSize ? `${(file.fileSize / (1024 * 1024)).toFixed(2)} MB • ` : ""}
                        {new Date(file.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-semibold shrink-0 ${
                      file.type === DeliverableType.OUTPUT
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                        : "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                    }`}
                  >
                    {file.type === DeliverableType.OUTPUT ? "Deliverable" : "Reference"}
                  </span>
                </div>

                <div className="rounded-md bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  <span className="font-medium text-foreground">Task:</span> {file.taskTitle}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                <span className="text-[11px] text-muted-foreground truncate">
                  By {file.uploadedBy.name || "Specialist"}
                </span>

                <div className="flex items-center gap-1.5 shrink-0">
                  <a
                    href={file.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition-colors"
                  >
                    <Eye className="size-3" /> Preview
                  </a>
                  <a
                    href={file.fileUrl}
                    download={file.name}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                  >
                    <Download className="size-3" /> Download
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
