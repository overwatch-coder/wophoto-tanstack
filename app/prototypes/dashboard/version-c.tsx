"use client";

import { useState } from "react";
import {
  mockKPIs,
  mockWeeklyLoad,
  mockServiceWorkloads,
  mockCollaborators,
} from "./data";
import {
  Search,
  Users,
  BarChart3,
  Calendar,
  ArrowUpRight,
} from "lucide-react";

type HybridSubView = "internal" | "roster" | "demand";

export function VersionC() {
  const [activeTab, setActiveTab] = useState<HybridSubView>("internal");
  const [timeRange, setTimeRange] = useState("Last 30 Days");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCapacity, setFilterCapacity] = useState<string>("ALL");

  const sortedCollaborators = [...mockCollaborators].sort(
    (a, b) => a.onTimeRate - b.onTimeRate
  );

  const filteredCollaborators = mockCollaborators.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.role.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCapacity =
      filterCapacity === "ALL" || c.capacityStatus === filterCapacity;
    return matchesSearch && matchesCapacity;
  });

  return (
    <div className="space-y-6">
      {/* Top Header with Segmented Pill Toggle (Matching Reference) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Internal Performance</h2>
          <p className="text-sm text-muted-foreground">
            Team Capacity, Workload & Productivity
          </p>
        </div>

        {/* View Toggle Pills: Switch between Internal Matrix, Team Roster, and Demand Analysis */}
        <div className="flex items-center rounded-full border border-white/10 bg-[#141417] p-1 text-xs">
          <button
            onClick={() => setActiveTab("internal")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all ${
              activeTab === "internal"
                ? "bg-white text-black shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BarChart3 className="size-3.5" />
            <span>Internal Performance</span>
          </button>

          <button
            onClick={() => setActiveTab("roster")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all ${
              activeTab === "roster"
                ? "bg-white text-black shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            <span>Team Roster</span>
          </button>

          <button
            onClick={() => setActiveTab("demand")}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium transition-all ${
              activeTab === "demand"
                ? "bg-white text-black shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>Demand Analysis</span>
          </button>
        </div>
      </div>

      {/* Date Range & Summary Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-4 text-orange-400" />
          <span>Active Period:</span>
          <span className="font-semibold text-foreground">{timeRange}</span>
          <span className="text-muted-foreground/60">·</span>
          <span>Showing data for 10 collaborators across 5 services</span>
        </div>
        <div className="flex items-center gap-1.5">
          {["Last 7 Days", "Last 30 Days", "This Quarter", "Year to Date"].map(
            (range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                  timeRange === range
                    ? "bg-orange-500/15 font-semibold text-orange-400 border border-orange-500/30"
                    : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                }`}
              >
                {range}
              </button>
            )
          )}
        </div>
      </div>

      {/* Persistent Top KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-xl border border-white/5 bg-[#121214] p-4 transition-all hover:border-white/10">
          <p className="text-xs font-medium text-muted-foreground">Active Tasks / Person</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">{mockKPIs.activeTasksPerPerson}</span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <p className="mt-2 text-xs font-medium text-orange-400">
            +{mockKPIs.activeTasksPerPerson - mockKPIs.activeTasksBenchmark} vs benchmark ({mockKPIs.activeTasksBenchmark})
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4 transition-all hover:border-white/10">
          <p className="text-xs font-medium text-muted-foreground">Team Productivity</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">{mockKPIs.teamProductivity}</span>
            <span className="text-xs text-muted-foreground">tasks / week</span>
          </div>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            ↗ Stable
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4 transition-all hover:border-white/10">
          <p className="text-xs font-medium text-muted-foreground">Avg Task Duration</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight">{mockKPIs.avgTaskDurationDays}</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="mt-2 text-xs font-medium text-orange-400">
            ↘ 0.9 days
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4 transition-all hover:border-white/10">
          <p className="text-xs font-medium text-muted-foreground">On-Time Delivery (OTD)</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-orange-400">{mockKPIs.onTimeDeliveryRate}%</span>
          </div>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            ↗ +5.1 pts
          </p>
        </div>

        <div className="col-span-2 rounded-xl border border-white/5 bg-[#121214] p-4 transition-all hover:border-white/10 sm:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">Workload Balance Index</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-rose-400">{mockKPIs.workloadBalanceIndex}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-rose-400">
            High imbalance
          </p>
        </div>
      </div>

      {/* VIEW 1: INTERNAL PERFORMANCE (Matrix: Heatmap, Services, Horizontal Ranking Bars) */}
      {activeTab === "internal" && (
        <section className="space-y-6">

          {/* Heatmap & Services Grid */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Heatmap */}
            <div className="rounded-xl border border-white/5 bg-[#121214] p-5 lg:col-span-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Weekly Load Trend</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Workload density by month & week</p>
                </div>
                <span className="text-[11px] font-medium text-orange-400">Live Heatmap</span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-2 text-left font-normal"></th>
                      <th className="px-2 py-2 font-normal">Week 1</th>
                      <th className="px-2 py-2 font-normal">Week 2</th>
                      <th className="px-2 py-2 font-normal">Week 3</th>
                      <th className="px-2 py-2 font-normal">Week 4</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {mockWeeklyLoad.map((row) => (
                      <tr key={row.month} className="h-10">
                        <td className="pr-2 text-left font-medium text-muted-foreground">
                          {row.month}
                        </td>
                        {[row.week1, row.week2, row.week3, row.week4].map((val, idx) => {
                          const bgStyle =
                            val >= 80
                              ? "bg-orange-600 text-white font-bold"
                              : val >= 50
                                ? "bg-orange-700/80 text-white"
                                : val >= 25
                                  ? "bg-orange-950/70 text-orange-200"
                                  : val > 0
                                    ? "bg-orange-950/30 text-orange-300/80"
                                    : "bg-white/[0.02] text-muted-foreground/40";
                          return (
                            <td key={idx} className="p-1">
                              <div
                                className={`flex h-8 items-center justify-center rounded-md text-[11px] transition-all hover:ring-1 hover:ring-orange-400 ${bgStyle}`}
                              >
                                {val > 0 ? `${val}%` : "0%"}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Workload By Service */}
            <div className="rounded-xl border border-white/5 bg-[#121214] p-5 lg:col-span-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Workload By Service</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">Delivery turnaround by creative stream</p>
                </div>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                  633 total deliverables
                </span>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-white/5 text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Service</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-right">Open</th>
                      <th className="pb-2 font-medium text-right">Late</th>
                      <th className="pb-2 font-medium text-right">On time</th>
                      <th className="pb-2 font-medium text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {mockServiceWorkloads.map((item) => (
                      <tr key={item.service} className="hover:bg-white/[0.02]">
                        <td className="py-3 font-medium text-foreground">{item.service}</td>
                        <td className="py-3 text-right text-muted-foreground">{item.total}</td>
                        <td className="py-3 text-right text-muted-foreground">{item.open}</td>
                        <td className="py-3 text-right font-medium text-rose-400">{item.late}</td>
                        <td className="py-3 text-right font-medium text-emerald-400">{item.onTime}</td>
                        <td className="py-3 text-right font-medium text-foreground">{item.avgTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Horizontal Ranking Bars Card */}
          <div className="rounded-xl border border-white/5 bg-[#121214] p-5 sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">On-time rate by collaborator</h3>
                <p className="text-xs text-muted-foreground">Individual delivery reliability ranking across team</p>
              </div>
              <button
                onClick={() => setActiveTab("roster")}
                className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
              >
                <span>View full roster details</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>

            <div className="mt-6 space-y-3.5">
              {sortedCollaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-xs">
                  <div className="w-32 shrink-0 truncate font-medium text-muted-foreground sm:w-44">
                    {c.name.toUpperCase()}
                  </div>
                  <div className="relative flex h-8 flex-1 items-center rounded-lg bg-black/40 p-1">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-[#d85a2b] px-3 font-semibold text-white shadow-sm transition-all duration-500"
                      style={{ width: `${c.onTimeRate}%` }}
                    >
                      <span className="text-xs">{c.onTimeRate}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* VIEW 2: TEAM ROSTER (Collaborator Table with Filters, Search, Turnaround, & Capacity) */}
      {activeTab === "roster" && (
        <section className="space-y-4">

          {/* Search and Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
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
                  onClick={() => setFilterCapacity(status)}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    filterCapacity === status
                      ? "bg-orange-600 text-white shadow-sm"
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
                    <th className="px-5 py-3.5 font-medium">Collaborator</th>
                    <th className="px-4 py-3.5 text-right font-medium">Completed Tasks</th>
                    <th className="px-4 py-3.5 text-right font-medium">Avg Duration</th>
                    <th className="px-4 py-3.5 text-right font-medium">On-Time Rate</th>
                    <th className="px-4 py-3.5 text-right font-medium">Active Tasks</th>
                    <th className="px-5 py-3.5 text-right font-medium">Capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredCollaborators.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-white/[0.02]">
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

                      <td className="px-4 py-4 text-right font-semibold text-foreground">
                        {c.completedTasks}
                      </td>

                      <td className="px-4 py-4 text-right text-muted-foreground">
                        {c.avgDurationDays} d
                      </td>

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

                      <td className="px-4 py-4 text-right font-bold text-foreground">
                        {c.activeTasks}
                      </td>

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
                  {filteredCollaborators.length === 0 && (
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
        </section>
      )}

      {/* VIEW 3: DEMAND ANALYSIS (Service Deliverables & Late vs On-time Ratios) */}
      {activeTab === "demand" && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-white/5 bg-[#121214] p-5">
              <h3 className="text-sm font-semibold text-foreground">Service Delivery Reliability</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Proportion of on-time vs late submissions per service</p>
              <div className="mt-5 space-y-4">
                {mockServiceWorkloads.map((s) => {
                  const onTimePct = Math.round((s.onTime / s.total) * 100);
                  const latePct = Math.round((s.late / s.total) * 100);
                  return (
                    <div key={s.service} className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-foreground">{s.service}</span>
                        <span>
                          <strong className="text-emerald-400">{onTimePct}%</strong> on-time ·{" "}
                          <span className="text-rose-400">{latePct}% late</span>
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/5">
                        <div
                          className="bg-emerald-500 transition-all duration-500"
                          style={{ width: `${onTimePct}%` }}
                        />
                        <div
                          className="bg-rose-500 transition-all duration-500"
                          style={{ width: `${latePct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-xl border border-white/5 bg-[#121214] p-5">
              <h3 className="text-sm font-semibold text-foreground">Turnaround Time vs Benchmark</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Average delivery days by creative service discipline</p>
              <div className="mt-5 space-y-3">
                {mockServiceWorkloads.map((s) => (
                  <div
                    key={s.service}
                    className="flex items-center justify-between rounded-lg border border-white/5 bg-black/30 p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{s.service}</p>
                      <p className="text-[11px] text-muted-foreground">{s.total} total deliverables</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-orange-400">{s.avgTime}</p>
                      <p className="text-[10px] text-muted-foreground">Average duration</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
