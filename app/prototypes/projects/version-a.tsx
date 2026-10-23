"use client";

import { useState, useMemo } from "react";
import {
  Search,
  SlidersHorizontal,
  FolderKanban,
  CheckCircle2,
  Clock,
  Sparkles,
  X,
  Calendar,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddProjectModal } from "./add-project-modal";
import { ViewProjectModal } from "./view-project-modal";
import { PROTOTYPE_CLIENTS } from "./data";
import { PrototypeProject, ProjectStatus } from "./types";

export function VersionA({
  projects,
  onAddProject,
}: {
  projects: PrototypeProject[];
  onAddProject: (project: PrototypeProject) => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchesSearch =
        search === "" ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.client.name.toLowerCase().includes(search.toLowerCase()) ||
        p.description.toLowerCase().includes(search.toLowerCase());

      const matchesClient =
        selectedClient === "ALL" || p.client.id === selectedClient;

      const matchesStatus =
        selectedStatus === "ALL" || p.status === selectedStatus;

      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [projects, search, selectedClient, selectedStatus]);

  const activeCount = projects.filter((p) => p.status === "IN_PROGRESS").length;

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              Projects Directory
            </h2>
            <span className="inline-flex items-center rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
              {activeCount} Active
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Monitor client productions, track milestones, and manage photography schedules.
          </p>
        </div>

        {/* Modal Trigger Button */}
        <div>
          <AddProjectModal onAddProject={onAddProject} />
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        {/* Search Input */}
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by project or client..."
            className="h-9 pl-9 pr-8 text-xs bg-background"
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

        {/* Client & Status Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-muted-foreground">Client:</span>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
            >
              <option value="ALL">All Clients ({PROTOTYPE_CLIENTS.length})</option>
              {PROTOTYPE_CLIENTS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Segmented Pills */}
          <div className="flex items-center rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            {["ALL", "IN_PROGRESS", "REVIEW", "COMPLETED"].map((st) => (
              <button
                key={st}
                onClick={() => setSelectedStatus(st)}
                className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-all ${
                  selectedStatus === st
                    ? "bg-card text-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {st === "ALL"
                  ? "All"
                  : st === "IN_PROGRESS"
                  ? "In Progress"
                  : st === "REVIEW"
                  ? "Review"
                  : "Completed"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">No projects found</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              No projects match your current search or filter criteria. Try resetting filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearch("");
                setSelectedClient("ALL");
                setSelectedStatus("ALL");
              }}
              className="mt-4 text-xs"
            >
              Reset Filters
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Project & Scope</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tasks Progress</th>
                  <th className="px-4 py-3">Target Date</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProjects.map((p) => {
                  const percent = Math.round(
                    (p.completedTasks / Math.max(p.totalTasks, 1)) * 100
                  );

                  return (
                    <tr
                      key={p.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      {/* Project info */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-foreground text-sm hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer">
                              {p.name}
                            </span>
                            <span className="rounded-md border border-border bg-muted/60 px-1.5 py-0.2 text-[10px] font-medium text-muted-foreground">
                              {p.category}
                            </span>
                          </div>
                          <p className="line-clamp-1 max-w-sm text-xs text-muted-foreground">
                            {p.description}
                          </p>
                        </div>
                      </td>

                      {/* Client info */}
                      <td className="px-4 py-3.5">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {p.client.name}
                          </p>
                          {p.client.company && (
                            <p className="text-[11px] text-muted-foreground">
                              {p.client.company}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : p.status === "REVIEW"
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                              : p.status === "IN_PROGRESS"
                              ? "bg-sky-500/10 text-sky-700 dark:text-sky-400"
                              : "bg-slate-500/10 text-slate-700 dark:text-slate-300"
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
                          <span>
                            {p.status === "IN_PROGRESS"
                              ? "In Progress"
                              : p.status === "REVIEW"
                              ? "In Review"
                              : p.status === "COMPLETED"
                              ? "Completed"
                              : "Planning"}
                          </span>
                        </span>
                      </td>

                      {/* Tasks Progress */}
                      <td className="px-4 py-3.5">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground font-medium">
                              {p.completedTasks}/{p.totalTasks}
                            </span>
                            <span className="font-semibold text-foreground">
                              {percent}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-orange-600 transition-all duration-300"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Due Date */}
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground/70" />
                          <span>{p.dueDate}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-5 py-3.5 text-right">
                        <ViewProjectModal project={p} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredProjects.length}</strong> of{" "}
            {projects.length} projects
          </span>
          <span className="text-[11px]">
            Sorted by most recently updated
          </span>
        </div>
      </div>
    </div>
  );
}
