"use client";

import { useState, useMemo } from "react";
import {
  Search,
  Plus,
  Command,
  ArrowRight,
  FolderDot,
  CheckCircle2,
  Clock,
  Sparkles,
  Calendar,
  X,
  ChevronRight,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProjectModal } from "./add-project-modal";
import { ViewProjectModal } from "./view-project-modal";
import { PROTOTYPE_CLIENTS } from "./data";
import { PrototypeProject } from "./types";

export function VersionC({
  projects,
  onAddProject,
}: {
  projects: PrototypeProject[];
  onAddProject: (project: PrototypeProject) => void;
}) {
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"ALL" | "ACTIVE" | "REVIEW" | "COMPLETED">("ALL");
  const [selectedClient, setSelectedClient] = useState<string>("ALL");

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase()) ||
        p.category.toLowerCase().includes(search.toLowerCase());

      const matchTab =
        tab === "ALL"
          ? true
          : tab === "ACTIVE"
          ? p.status === "IN_PROGRESS"
          : tab === "REVIEW"
          ? p.status === "REVIEW"
          : p.status === "COMPLETED";

      const matchClient =
        selectedClient === "ALL" || p.client.id === selectedClient;

      return matchSearch && matchTab && matchClient;
    });
  }, [projects, search, tab, selectedClient]);

  const counts = {
    ALL: projects.length,
    ACTIVE: projects.filter((p) => p.status === "IN_PROGRESS").length,
    REVIEW: projects.filter((p) => p.status === "REVIEW").length,
    COMPLETED: projects.filter((p) => p.status === "COMPLETED").length,
  };

  return (
    <div className="space-y-5">
      {/* Top Header & New Project CTA */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-md bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <FolderDot className="size-3.5" />
            </span>
            <h2 className="text-lg font-bold tracking-tight text-foreground">
              Projects
            </h2>
            <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
              {projects.length} Total
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Organize team assignments, set deadlines, and collaborate with clients.
          </p>
        </div>

        <div>
          <AddProjectModal onAddProject={onAddProject} variant="accent" />
        </div>
      </div>

      {/* Modern Tab Bar & Command Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3">
        {/* Underline Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto">
          {(["ALL", "ACTIVE", "REVIEW", "COMPLETED"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                tab === t
                  ? "bg-muted text-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              }`}
            >
              <span>
                {t === "ALL"
                  ? "All Projects"
                  : t === "ACTIVE"
                  ? "In Production"
                  : t === "REVIEW"
                  ? "In Review"
                  : "Completed"}
              </span>
              <span
                className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                  tab === t
                    ? "bg-foreground/10 text-foreground font-bold"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {counts[t]}
              </span>
            </button>
          ))}
        </div>

        {/* Search & Client Filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter projects..."
              className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs bg-background"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>

          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Clients</option>
            {PROTOTYPE_CLIENTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Projects List/Table */}
      <div className="rounded-xl border border-border bg-card shadow-xs overflow-hidden">
        {filtered.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-sm font-medium text-foreground">No matching projects</p>
            <p className="text-xs text-muted-foreground mt-1">
              Try switching tabs or clearing your search query.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map((p) => {
              const percent = Math.round(
                (p.completedTasks / Math.max(p.totalTasks, 1)) * 100
              );

              return (
                <div
                  key={p.id}
                  className="group flex flex-col gap-3 p-4 transition-colors hover:bg-muted/30 sm:flex-row sm:items-center sm:justify-between"
                >
                  {/* Left: Project title & Client info */}
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                        p.client.avatarColor || "bg-orange-600 text-white"
                      }`}
                    >
                      {p.name.charAt(0)}
                    </span>
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground text-sm group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors">
                          {p.name}
                        </span>
                        <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                          {p.category}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {p.client.name}
                        </span>
                        <span>•</span>
                        <span>{p.dueDate ? `Due ${p.dueDate}` : "No due date"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Status badge, task progress bar, and actions */}
                  <div className="flex items-center gap-4 self-end sm:self-center">
                    {/* Status badge */}
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                        p.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : p.status === "REVIEW"
                          ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                          : p.status === "IN_PROGRESS"
                          ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                          : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {p.status.replace("_", " ")}
                    </span>

                    {/* Progress */}
                    <div className="hidden sm:block w-24 space-y-1">
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{p.completedTasks}/{p.totalTasks}</span>
                        <span>{percent}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-orange-600"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>

                    {/* View Modal */}
                    <ViewProjectModal project={p} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
