"use client";

import { Eye, Calendar, User, CheckCircle2, Clock, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { PrototypeProject } from "./types";

export function ViewProjectModal({ project }: { project: PrototypeProject }) {
  const percentComplete = Math.round(
    (project.completedTasks / Math.max(project.totalTasks, 1)) * 100
  );

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1 px-2.5 text-xs text-foreground hover:bg-muted"
          >
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <span className="rounded-md border border-orange-500/20 bg-orange-500/10 px-2 py-0.5 text-[11px] font-semibold text-orange-600 dark:text-orange-400">
              {project.category}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                project.status === "COMPLETED"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : project.status === "REVIEW"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : project.status === "IN_PROGRESS"
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                  : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
              }`}
            >
              {project.status.replace("_", " ")}
            </span>
          </div>
          <DialogTitle className="mt-1 text-lg font-semibold text-foreground">
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Client & Metadata Card */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/40 p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="size-3" />
                <span>Client</span>
              </span>
              <p className="mt-0.5 font-semibold text-foreground">
                {project.client.name}
              </p>
              {project.client.company && (
                <p className="text-[11px] text-muted-foreground">
                  {project.client.company}
                </p>
              )}
            </div>

            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                <span>Due Date</span>
              </span>
              <p className="mt-0.5 font-medium text-foreground">
                {project.dueDate}
              </p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="size-2.5" />
                <span>Updated {project.updatedAt}</span>
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 rounded-lg border border-border p-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1 text-muted-foreground font-medium">
                <Layers className="size-3.5 text-orange-500" />
                <span>Task Progress</span>
              </span>
              <span className="font-semibold text-foreground">
                {project.completedTasks} / {project.totalTasks} ({percentComplete}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-orange-600 transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description & Notes
            </h4>
            <div className="rounded-lg border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
              {project.description || "No description provided."}
            </div>
          </div>
        </div>

        <DialogFooter className="-mx-6 -mb-6 mt-4 border-t border-border bg-muted/30 px-6 py-3">
          <DialogClose
            render={
              <Button variant="outline" className="h-8 px-3 text-xs">
                Close
              </Button>
            }
          />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
