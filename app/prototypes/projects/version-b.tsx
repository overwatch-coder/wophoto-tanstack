"use client";

import { useState, useMemo } from "react";
import {
  Search,
  FolderPlus,
  Briefcase,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  TrendingUp,
  Filter,
  Layers,
  Calendar,
  X,
  ExternalLink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProjectModal } from "./add-project-modal";
import { ViewProjectModal } from "./view-project-modal";
import { PROTOTYPE_CLIENTS } from "./data";
import { PrototypeProject, ProjectStatus } from "./types";

export function VersionB({
  projects,
  onAddProject,
}: {
  projects: PrototypeProject[];
  onAddProject: (project: PrototypeProject) => void;
}) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Metrics
  const activeProjects = projects.filter((p) => p.status === "IN_PROGRESS").length;
  const inReviewCount = projects.filter((p) => p.status === "REVIEW").length;
  const completedCount = projects.filter((p) => p.status === "COMPLETED").length;
  const totalTasks = projects.reduce((acc, p) => acc + p.totalTasks, 0);
  const completedTasks = projects.reduce((acc, p) => acc + p.completedTasks, 0);

  const filtered = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase());
      const matchClient = clientFilter === "ALL" || p.client.id === clientFilter;
      const matchCategory = categoryFilter === "ALL" || p.category === categoryFilter;
      const matchStatus = statusFilter === "ALL" || p.status === statusFilter;
      return matchSearch && matchClient && matchCategory && matchStatus;
    });
  }, [projects, search, clientFilter, categoryFilter, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Production Management Hub
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Executive oversight of all studio shoots, photo edits, and client deliverables.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <AddProjectModal onAddProject={onAddProject} variant="accent" />
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">In Production</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <Briefcase className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {activeProjects}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Active shoots
            </span>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Awaiting Review</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {inReviewCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              With clients
            </span>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Task Velocity</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {completedTasks}/{totalTasks}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Tasks logged
            </span>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Completed</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {completedCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Archived
            </span>
          </div>
        </div>
      </div>

      {/* Control Filters */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects..."
            className="h-8.5 pl-8 pr-8 text-xs bg-background"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Clients</option>
            {PROTOTYPE_CLIENTS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Category Filter */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Categories</option>
            <option value="Wedding">Wedding</option>
            <option value="Commercial">Commercial</option>
            <option value="Editorial">Editorial</option>
            <option value="Portrait">Portrait</option>
            <option value="Event">Event</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="REVIEW">Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="PLANNING">Planning</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-5 py-3">Project Title</th>
                <th className="px-4 py-3">Client & Organization</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Progress</th>
                <th className="px-4 py-3">Deadline</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((p) => {
                const percent = Math.round(
                  (p.completedTasks / Math.max(p.totalTasks, 1)) * 100
                );

                return (
                  <tr key={p.id} className="transition-colors hover:bg-muted/30">
                    {/* Title */}
                    <td className="px-5 py-3.5">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-foreground text-sm hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer">
                          {p.name}
                        </span>
                        <p className="line-clamp-1 max-w-xs text-xs text-muted-foreground">
                          {p.description}
                        </p>
                      </div>
                    </td>

                    {/* Client with Avatar */}
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            p.client.avatarColor || "bg-orange-600 text-white"
                          }`}
                        >
                          {p.client.name.charAt(0)}
                        </span>
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {p.client.name}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {p.client.company || p.client.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5">
                      <span className="rounded-md border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {p.category}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                          p.status === "COMPLETED"
                            ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                            : p.status === "REVIEW"
                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                            : p.status === "IN_PROGRESS"
                            ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                            : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        <span
                          className={`size-1.5 rounded-full ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-500"
                              : p.status === "REVIEW"
                              ? "bg-amber-500"
                              : p.status === "IN_PROGRESS"
                              ? "bg-sky-500"
                              : "bg-slate-400"
                          }`}
                        />
                        {p.status.replace("_", " ")}
                      </span>
                    </td>

                    {/* Progress Bar */}
                    <td className="px-4 py-3.5">
                      <div className="w-24 space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>{p.completedTasks}/{p.totalTasks}</span>
                          <span className="font-semibold text-foreground">{percent}%</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className="h-full rounded-full bg-orange-600 transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* Deadline */}
                    <td className="px-4 py-3.5 text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="size-3 text-muted-foreground/70" />
                        <span>{p.dueDate}</span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-5 py-3.5 text-right">
                      <ViewProjectModal project={p} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span>Showing {filtered.length} of {projects.length} projects</span>
          <span className="text-[11px]">Auto-refreshed with database changes</span>
        </div>
      </div>
    </div>
  );
}
