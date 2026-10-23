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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
      {/* Top Header with Segmented Tabs (Matching standard App Design System) */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Internal Performance</h1>
          <p className="text-sm text-muted-foreground">
            Team Capacity, Workload & Productivity
          </p>
        </div>

        {/* View Toggle Tabs: Switch between Internal Performance, Team Roster, and Demand Analysis */}
        <Tabs value={activeTab} onValueChange={(val) => setActiveTab((val as HybridSubView) || "internal")}>
          <TabsList>
            <TabsTrigger value="internal">
              <BarChart3 className="size-3.5" />
              <span>Internal Performance</span>
            </TabsTrigger>
            <TabsTrigger value="roster">
              <Users className="size-3.5" />
              <span>Team Roster</span>
            </TabsTrigger>
            <TabsTrigger value="demand">
              <span>Demand Analysis</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Date Range & Summary Ribbon */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="size-4 text-primary" />
          <span>Active Period:</span>
          <span className="font-semibold text-foreground">{timeRange}</span>
          <span className="text-muted-foreground">·</span>
          <span>{mockCollaborators.length} collaborators across 4 services</span>
        </div>
        <Tabs value={timeRange} onValueChange={(val) => val && setTimeRange(val)}>
          <TabsList className="bg-muted/60">
            {["Last 7 Days", "Last 30 Days", "This Quarter", "Year to Date"].map(
              (range) => (
                <TabsTrigger key={range} value={range} className="px-2.5 py-1">
                  {range}
                </TabsTrigger>
              )
            )}
          </TabsList>
        </Tabs>
      </div>

      {/* Persistent Top KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">Active Tasks / Person</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">{mockKPIs.activeTasksPerPerson}</span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">
            +{(mockKPIs.activeTasksPerPerson - mockKPIs.activeTasksBenchmark).toFixed(1)} vs benchmark ({mockKPIs.activeTasksBenchmark})
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">Team Productivity</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">{mockKPIs.teamProductivity}</span>
            <span className="text-xs text-muted-foreground">tasks / week</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↗ Stable
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">Avg Task Duration</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">{mockKPIs.avgTaskDurationDays}</span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">
            ↘ 0.9 days
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">On-Time Delivery (OTD)</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-primary">{mockKPIs.onTimeDeliveryRate}%</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↗ +5.1 pts
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80 sm:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">Workload Balance Index</p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">{mockKPIs.workloadBalanceIndex}</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-rose-600 dark:text-rose-400">
            High imbalance
          </p>
        </div>
      </div>

      {/* VIEW 1: INTERNAL PERFORMANCE (Matrix: Heatmap, Services, Horizontal Ranking Bars) */}
      {activeTab === "internal" && (
        <section className="space-y-6">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
            {/* Heatmap */}
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-5">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Weekly Load Trend</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Workload density by month & week (Trailing 6 Months)</p>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-center text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="py-2 text-left font-medium">Month</th>
                      <th className="px-2 py-2 font-medium">Week 1 (1–7)</th>
                      <th className="px-2 py-2 font-medium">Week 2 (8–14)</th>
                      <th className="px-2 py-2 font-medium">Week 3 (15–21)</th>
                      <th className="px-2 py-2 font-medium">Week 4 (22+)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {mockWeeklyLoad.map((row) => (
                      <tr
                        key={row.month}
                        className={`h-10 transition-colors ${
                          row.isCurrent ? "bg-primary/[0.04]" : "hover:bg-muted/20"
                        }`}
                      >
                        <td className="pr-2 text-left font-medium text-foreground">
                          <div className="flex items-center gap-1.5">
                            <span className={row.isCurrent ? "font-bold text-primary" : ""}>
                              {row.month}
                            </span>
                            {row.isCurrent && (
                              <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold text-primary">
                                Current
                              </span>
                            )}
                          </div>
                        </td>
                        {[row.week1, row.week2, row.week3, row.week4].map((val, idx) => {
                          const bgStyle =
                            val >= 80
                              ? "bg-orange-600 text-white font-bold shadow-xs"
                              : val >= 50
                                ? "bg-orange-500/85 text-white font-semibold"
                                : val >= 25
                                  ? "bg-orange-100 dark:bg-orange-950/70 text-orange-950 dark:text-orange-200 border border-orange-200 dark:border-orange-800/60 font-medium"
                                  : val > 0
                                    ? "bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-300 border border-orange-100 dark:border-orange-900/40"
                                    : "bg-muted text-muted-foreground border border-border/40";
                          return (
                            <td key={idx} className="p-1">
                              <div
                                className={`flex h-8 items-center justify-center rounded-md text-[11px] transition-all hover:ring-1 hover:ring-primary ${bgStyle}`}
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
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-7">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">Workload By Service</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">Delivery turnaround by creative stream</p>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-border text-muted-foreground">
                    <tr>
                      <th className="pb-2 font-medium">Service</th>
                      <th className="pb-2 font-medium text-right">Total</th>
                      <th className="pb-2 font-medium text-right">Open</th>
                      <th className="pb-2 font-medium text-right">Late</th>
                      <th className="pb-2 font-medium text-right">On time</th>
                      <th className="pb-2 font-medium text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {mockServiceWorkloads.map((item) => (
                      <tr key={item.service} className="hover:bg-muted/40 transition-colors">
                        <td className="py-3 font-medium text-foreground">{item.service}</td>
                        <td className="py-3 text-right text-muted-foreground">{item.total}</td>
                        <td className="py-3 text-right text-muted-foreground">{item.open}</td>
                        <td className="py-3 text-right font-semibold text-rose-600 dark:text-rose-400">{item.late}</td>
                        <td className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">{item.onTime}</td>
                        <td className="py-3 text-right font-semibold text-foreground">{item.avgTime}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Horizontal Ranking Bars Card */}
          <div className="rounded-lg border border-border bg-card p-5 shadow-xs sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">On-time rate by collaborator</h3>
                <p className="text-xs text-muted-foreground">Individual delivery reliability ranking across team</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab("roster")}
                className="flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
              >
                <span>View team roster details</span>
                <ArrowUpRight className="size-3.5" />
              </button>
            </div>

            <div className="mt-6 space-y-3.5">
              {sortedCollaborators.map((c) => (
                <div key={c.id} className="flex items-center gap-3 text-xs">
                  <div className="w-32 shrink-0 truncate font-medium text-foreground sm:w-44">
                    {c.name.toUpperCase()}
                  </div>
                  <div className="relative flex h-8 flex-1 items-center rounded-md bg-muted border border-border/50 p-1">
                    <div
                      className="flex h-full items-center justify-end rounded-sm bg-primary px-3 font-semibold text-primary-foreground shadow-xs transition-all duration-500"
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
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>

            <div className="flex items-center gap-1.5 self-start sm:self-auto">
              {(["ALL", "optimal", "heavy", "light"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterCapacity(status)}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    filterCapacity === status
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-border/40"
                  }`}
                >
                  {status === "ALL" ? "All Capacity" : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Collaborator Performance Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/40 text-muted-foreground">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Collaborator</th>
                    <th className="px-4 py-3.5 text-right font-medium">Completed Tasks</th>
                    <th className="px-4 py-3.5 text-right font-medium">Avg Duration</th>
                    <th className="px-4 py-3.5 text-right font-medium">On-Time Rate</th>
                    <th className="px-4 py-3.5 text-right font-medium">Active Tasks</th>
                    <th className="px-5 py-3.5 text-right font-medium">Capacity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredCollaborators.map((c) => (
                    <tr key={c.id} className="transition-colors hover:bg-muted/30">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary border border-primary/20">
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
                              ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                              : c.onTimeRate >= 75
                                ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
                                : "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
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
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                            c.capacityStatus === "heavy"
                              ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
                              : c.capacityStatus === "optimal"
                                ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                                : "bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20"
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
            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-card-foreground">Service Delivery Reliability</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Proportion of on-time vs late deliverables per service</p>
              <div className="mt-5 space-y-4">
                {mockServiceWorkloads.map((s) => {
                  const onTimePct = Math.round((s.onTime / s.total) * 100);
                  const latePct = Math.round((s.late / s.total) * 100);
                  return (
                    <div key={s.service} className="space-y-1.5 text-xs">
                      <div className="flex justify-between font-medium">
                        <span className="text-foreground">{s.service}</span>
                        <span>
                          <strong className="text-emerald-600 dark:text-emerald-400 font-semibold">{onTimePct}%</strong> on-time ·{" "}
                          <span className="text-rose-600 dark:text-rose-400 font-semibold">{latePct}% late</span>
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted border border-border/40">
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

            <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-card-foreground">Turnaround Time vs Benchmark</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Average delivery days by creative service discipline</p>
              <div className="mt-5 space-y-3">
                {mockServiceWorkloads.map((s) => (
                  <div
                    key={s.service}
                    className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3 text-xs"
                  >
                    <div>
                      <p className="font-semibold text-foreground">{s.service}</p>
                      <p className="text-[11px] text-muted-foreground">{s.total} total deliverables</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">{s.avgTime}</p>
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