"use client";

import { useState } from "react";
import { mockKPIs, mockCollaborators } from "./data";
import { Users, Clock, CheckCircle2, AlertTriangle, Search } from "lucide-react";

export function VersionB() {
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");

  const filtered = mockCollaborators.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === "ALL" || c.capacityStatus === filterStatus;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Team Collaborator Roster</h2>
          <p className="text-sm text-muted-foreground">
            Individual delivery metrics, turnaround time, and current active allocation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-400">
            {mockCollaborators.length} Team Members
          </span>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="rounded-lg bg-orange-500/10 p-2 text-orange-400">
            <Users className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Load per Person</p>
            <p className="text-lg font-bold">{mockKPIs.activeTasksPerPerson} tasks</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="rounded-lg bg-emerald-500/10 p-2 text-emerald-400">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Team On-Time Rate</p>
            <p className="text-lg font-bold">{mockKPIs.onTimeDeliveryRate}%</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="rounded-lg bg-blue-500/10 p-2 text-blue-400">
            <Clock className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Avg Turnaround</p>
            <p className="text-lg font-bold">{mockKPIs.avgTaskDurationDays} days</p>
          </div>
        </div>

        <div className="flex items-center gap-3.5 rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="rounded-lg bg-rose-500/10 p-2 text-rose-400">
            <AlertTriangle className="size-5" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Workload Imbalance</p>
            <p className="text-lg font-bold">{mockKPIs.workloadBalanceIndex} index</p>
          </div>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search collaborator or role..."
            className="h-9 w-full rounded-lg border border-white/10 bg-black/40 pl-9 pr-3 text-xs placeholder:text-muted-foreground focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
          />
        </div>

        <div className="flex items-center gap-1.5 self-start sm:self-auto">
          {(["ALL", "optimal", "heavy", "light"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                filterStatus === status
                  ? "bg-orange-600 text-white"
                  : "bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground"
              }`}
            >
              {status === "ALL" ? "All Capacity" : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Collaborator Performance Table (Reference 2 Layout) */}
      <div className="overflow-hidden rounded-xl border border-white/5 bg-[#121214]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-white/5 bg-white/[0.02] text-muted-foreground">
              <tr>
                <th className="px-5 py-3 font-medium">Collaborator</th>
                <th className="px-4 py-3 text-right font-medium">Completed Tasks</th>
                <th className="px-4 py-3 text-right font-medium">Avg Duration</th>
                <th className="px-4 py-3 text-right font-medium">On-Time Rate</th>
                <th className="px-4 py-3 text-right font-medium">Active Tasks</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filtered.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
                  {/* Collaborator Name + Role */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500/30 to-amber-600/20 text-xs font-bold text-orange-400">
                        {c.initials}
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">{c.name}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{c.role}</p>
                      </div>
                    </div>
                  </td>

                  {/* Completed Tasks */}
                  <td className="px-4 py-4 text-right font-semibold text-foreground">
                    {c.completedTasks}
                  </td>

                  {/* Avg Duration */}
                  <td className="px-4 py-4 text-right text-muted-foreground">
                    {c.avgDurationDays} d
                  </td>

                  {/* On-Time Rate */}
                  <td className="px-4 py-4 text-right">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                        c.onTimeRate >= 85
                          ? "bg-emerald-500/10 text-emerald-400"
                          : c.onTimeRate >= 75
                            ? "bg-amber-500/10 text-amber-400"
                            : "bg-rose-500/10 text-rose-400"
                      }`}
                    >
                      {c.onTimeRate}%
                    </span>
                  </td>

                  {/* Active Tasks */}
                  <td className="px-4 py-4 text-right font-bold text-foreground">
                    {c.activeTasks}
                  </td>

                  {/* Capacity Status Badge */}
                  <td className="px-5 py-4 text-right">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${
                        c.capacityStatus === "heavy"
                          ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                          : c.capacityStatus === "optimal"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                      }`}
                    >
                      {c.capacityStatus}
                    </span>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                    No collaborators found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
