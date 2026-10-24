"use client"

import { useState } from "react"
import type { ManagerAnalyticsData } from "@/lib/analytics"
import { Search, Users, BarChart3, Calendar, ArrowUpRight } from "lucide-react"
import { useDebounce } from "@uidotdev/usehooks"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Pagination } from "@/components/ui/pagination"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type ManagerSubView = "internal" | "roster" | "demand"

function heatmapCellClass(value: number) {
  return value >= 80
    ? "bg-orange-600 text-white font-bold shadow-xs"
    : value >= 50
      ? "bg-orange-500/85 text-white font-semibold"
      : value >= 25
        ? "bg-orange-100 dark:bg-orange-950/70 text-orange-950 dark:text-orange-200 border border-orange-200 dark:border-orange-800/60 font-medium"
        : value > 0
          ? "bg-orange-50 dark:bg-orange-950/30 text-orange-900 dark:text-orange-300 border border-orange-100 dark:border-orange-900/40"
          : "bg-muted text-muted-foreground border border-border/40"
}

function CapacityBadge({ status }: { status: "optimal" | "heavy" | "light" }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
        status === "heavy"
          ? "border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400"
          : status === "optimal"
            ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
            : "border border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-400"
      }`}
    >
      {status}
    </span>
  )
}

export function ManagerDashboard({ data }: { data: ManagerAnalyticsData }) {
  const [activeTab, setActiveTab] = useState<ManagerSubView>("internal")
  const [timeRange, setTimeRange] = useState("Last 30 Days")
  const [searchTerm, setSearchTerm] = useState("")
  const debouncedSearch = useDebounce(searchTerm, 300)
  const [filterCapacity, setFilterCapacity] = useState<string>("ALL")

  const sortedCollaborators = [...data.collaborators].sort(
    (a, b) => a.onTimeRate - b.onTimeRate
  )

  const filteredCollaborators = data.collaborators.filter((c) => {
    const query = debouncedSearch.toLowerCase().trim()
    const matchesSearch =
      !query ||
      c.name.toLowerCase().includes(query) ||
      c.role.toLowerCase().includes(query)
    const matchesCapacity =
      filterCapacity === "ALL" || c.capacityStatus === filterCapacity
    return matchesSearch && matchesCapacity
  })

  return (
    <div className="space-y-6">
      {/* Top Header with Segmented Tabs (Matching standard App Design System) */}
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Internal Performance
          </h1>
          <p className="text-sm text-muted-foreground">
            Team Capacity, Workload & Productivity
          </p>
        </div>

        {/* View Toggle Tabs: Switch between Internal Performance, Team Roster, and Demand Analysis */}
        <Tabs
          className="w-full min-w-0 sm:w-auto"
          value={activeTab}
          onValueChange={(val) =>
            setActiveTab((val as ManagerSubView) || "internal")
          }
        >
          <TabsList className="!grid !h-auto w-full grid-cols-3 p-1 sm:!inline-flex sm:!h-9 sm:w-max sm:grid-cols-none">
            <TabsTrigger
              aria-label="Internal Performance"
              value="internal"
              className="!h-auto min-h-10 min-w-0 justify-center px-1.5 py-2 text-center text-[11px] leading-tight whitespace-normal sm:!h-[calc(100%-1px)] sm:min-h-0 sm:flex-none sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-xs sm:whitespace-nowrap"
            >
              <BarChart3 className="size-3.5" />
              <span className="hidden sm:inline">Internal Performance</span>
              <span className="sm:hidden">Performance</span>
            </TabsTrigger>
            <TabsTrigger
              aria-label="Team Roster"
              value="roster"
              className="!h-auto min-h-10 min-w-0 justify-center px-1.5 py-2 text-center text-[11px] leading-tight whitespace-normal sm:!h-[calc(100%-1px)] sm:min-h-0 sm:flex-none sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-xs sm:whitespace-nowrap"
            >
              <Users className="size-3.5" />
              <span>Team Roster</span>
            </TabsTrigger>
            <TabsTrigger
              aria-label="Demand Analysis"
              value="demand"
              className="!h-auto min-h-10 min-w-0 justify-center px-1.5 py-2 text-center text-[11px] leading-tight whitespace-normal sm:!h-[calc(100%-1px)] sm:min-h-0 sm:flex-none sm:gap-2 sm:px-3.5 sm:py-1.5 sm:text-xs sm:whitespace-nowrap"
            >
              <span className="hidden sm:inline">Demand Analysis</span>
              <span className="sm:hidden">Demand</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Date Range & Summary Ribbon */}
      <div className="flex min-w-0 flex-col items-stretch gap-3 border-b border-border pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-2 text-xs text-muted-foreground sm:items-center">
          <Calendar className="size-4 text-primary" />
          <span className="min-w-0 leading-relaxed">
            <span className="mr-1">Active period:</span>
            <span className="font-semibold text-foreground">{timeRange}</span>
            <span className="mx-1 text-muted-foreground">·</span>
            <span>
              {data.collaboratorsTotal} collaborators across{" "}
              {data.serviceWorkloads.length} services
            </span>
          </span>
        </div>
        <Tabs
          className="w-full sm:w-auto"
          value={timeRange}
          onValueChange={(val) => val && setTimeRange(val)}
        >
          <TabsList className="!grid !h-auto w-full grid-cols-2 gap-2 !rounded-none !border-0 !bg-transparent !p-0 sm:!flex sm:!h-9 sm:w-max sm:grid-cols-none sm:!rounded-full sm:!border sm:!bg-muted/60 sm:!p-1">
            {[
              "Last 7 Days",
              "Last 30 Days",
              "This Quarter",
              "Year to Date",
            ].map((range) => (
              <TabsTrigger
                key={range}
                value={range}
                className="!h-auto min-h-11 min-w-0 rounded-lg border border-border bg-card px-2 py-2 text-center text-[11px] leading-tight whitespace-normal shadow-xs sm:!h-[calc(100%-1px)] sm:min-h-0 sm:flex-none sm:rounded-full sm:border-transparent sm:bg-transparent sm:px-3.5 sm:py-1 sm:text-xs sm:whitespace-nowrap sm:shadow-none"
              >
                {range}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Persistent Top KPI Metric Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">
            Active Tasks / Person
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">
              {data.kpis.activeTasksPerPerson}
            </span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">
            +
            {Math.round(
              (data.kpis.activeTasksPerPerson -
                data.kpis.activeTasksBenchmark) *
                10
            ) / 10}{" "}
            vs benchmark ({data.kpis.activeTasksBenchmark})
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">
            Team Productivity
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">
              {data.kpis.teamProductivity}
            </span>
            <span className="text-xs text-muted-foreground">tasks / week</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↗ Stable
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">
            Avg Task Duration
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-card-foreground">
              {data.kpis.avgTaskDurationDays}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-primary">↘ 0.9 days</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <p className="text-xs font-medium text-muted-foreground">
            On-Time Delivery (OTD)
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-primary">
              {data.kpis.onTimeDeliveryRate}%
            </span>
          </div>
          <p className="mt-2 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            ↗ +5.1 pts
          </p>
        </div>

        <div className="col-span-2 rounded-lg border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80 sm:col-span-1">
          <p className="text-xs font-medium text-muted-foreground">
            Workload Balance Index
          </p>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold tracking-tight text-rose-600 dark:text-rose-400">
              {data.kpis.workloadBalanceIndex}
            </span>
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
            <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-5">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">
                  Weekly Load Trend
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Workload density by month & week (Trailing 6 Months)
                </p>
              </div>

              <div className="mt-4 min-w-0">
                <div className="space-y-2 md:hidden">
                  {data.weeklyLoad.map((row) => (
                    <div
                      key={row.month}
                      className={`rounded-lg border border-border p-2.5 ${row.isCurrent ? "bg-primary/[0.04]" : "bg-background"}`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 text-xs">
                        <span
                          className={
                            row.isCurrent
                              ? "font-semibold text-primary"
                              : "font-medium text-foreground"
                          }
                        >
                          {row.month}
                        </span>
                        {row.isCurrent ? (
                          <span className="text-[10px] font-medium text-primary">
                            Current
                          </span>
                        ) : null}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[row.week1, row.week2, row.week3, row.week4].map(
                          (value, index) => (
                            <div key={index} className="min-w-0 text-center">
                              <span className="mb-1 block text-[9px] text-muted-foreground">
                                W{index + 1}
                              </span>
                              <span
                                className={`flex h-7 items-center justify-center rounded text-[10px] ${heatmapCellClass(value)}`}
                              >
                                {value > 0 ? `${value}%` : "0%"}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="hidden md:block">
                  <Table className="table-fixed text-center text-xs">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[19.5%]" />
                      <col className="w-[19.5%]" />
                      <col className="w-[19.5%]" />
                      <col className="w-[19.5%]" />
                    </colgroup>
                    <TableHeader>
                      <TableRow className="text-muted-foreground">
                        <TableHead className="py-2 text-left font-medium">
                          Month
                        </TableHead>
                        <TableHead className="px-2 py-2 font-medium">
                          Week 1 (1–7)
                        </TableHead>
                        <TableHead className="px-2 py-2 font-medium">
                          Week 2 (8–14)
                        </TableHead>
                        <TableHead className="px-2 py-2 font-medium">
                          Week 3 (15–21)
                        </TableHead>
                        <TableHead className="px-2 py-2 font-medium">
                          Week 4 (22+)
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border/60">
                      {data.weeklyLoad.map((row) => (
                        <TableRow
                          key={row.month}
                          className={`h-10 transition-colors ${
                            row.isCurrent
                              ? "bg-primary/[0.04]"
                              : "hover:bg-muted/20"
                          }`}
                        >
                          <TableCell className="pr-2 text-left font-medium text-foreground">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={
                                  row.isCurrent ? "font-bold text-primary" : ""
                                }
                              >
                                {row.month}
                              </span>
                              {row.isCurrent && (
                                <span className="rounded bg-primary/15 px-1 py-0.5 text-[9px] font-bold text-primary">
                                  Current
                                </span>
                              )}
                            </div>
                          </TableCell>
                          {[row.week1, row.week2, row.week3, row.week4].map(
                            (val, idx) => {
                              return (
                                <TableCell key={idx} className="p-1">
                                  <div
                                    className={`flex h-8 items-center justify-center rounded-md text-[11px] transition-all hover:ring-1 hover:ring-primary ${heatmapCellClass(val)}`}
                                  >
                                    {val > 0 ? `${val}%` : "0%"}
                                  </div>
                                </TableCell>
                              )
                            }
                          )}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>

            {/* Workload By Service */}
            <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-7">
              <div>
                <h3 className="text-sm font-semibold text-card-foreground">
                  Workload By Service
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Delivery turnaround by creative stream
                </p>
              </div>

              <div className="mt-4 min-w-0">
                <div className="space-y-2 lg:hidden">
                  {data.serviceWorkloads.map((item) => (
                    <article
                      key={item.service}
                      className="rounded-lg border border-border bg-background p-3"
                    >
                      <h4 className="text-xs font-semibold break-words text-foreground">
                        {item.service}
                      </h4>
                      <dl className="mt-2 grid grid-cols-3 gap-x-2 gap-y-2">
                        {[
                          ["Total", item.total],
                          ["Open", item.open],
                          ["Late", item.late],
                          ["On time", item.onTime],
                          ["Avg time", item.avgTime],
                        ].map(([label, value]) => (
                          <div key={label} className="min-w-0">
                            <dt className="text-[10px] text-muted-foreground">
                              {label}
                            </dt>
                            <dd
                              className={`truncate text-xs font-semibold tabular-nums ${label === "Late" ? "text-rose-600 dark:text-rose-400" : label === "On time" ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"}`}
                            >
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    </article>
                  ))}
                </div>
                <div className="hidden lg:block">
                  <Table className="table-fixed text-left text-xs">
                    <colgroup>
                      <col className="w-[34%]" />
                      <col className="w-[13.2%]" />
                      <col className="w-[13.2%]" />
                      <col className="w-[13.2%]" />
                      <col className="w-[13.2%]" />
                      <col className="w-[13.2%]" />
                    </colgroup>
                    <TableHeader className="border-b border-border text-muted-foreground">
                      <TableRow>
                        <TableHead className="pb-2 font-medium">
                          Service
                        </TableHead>
                        <TableHead className="pb-2 text-right font-medium">
                          Total
                        </TableHead>
                        <TableHead className="pb-2 text-right font-medium">
                          Open
                        </TableHead>
                        <TableHead className="pb-2 text-right font-medium">
                          Late
                        </TableHead>
                        <TableHead className="pb-2 text-right font-medium">
                          On time
                        </TableHead>
                        <TableHead className="pb-2 text-right font-medium">
                          Avg Time
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody className="divide-y divide-border">
                      {data.serviceWorkloads.map((item) => (
                        <TableRow
                          key={item.service}
                          className="transition-colors hover:bg-muted/40"
                        >
                          <TableCell className="py-3 font-medium text-foreground">
                            {item.service}
                          </TableCell>
                          <TableCell className="py-3 text-right text-muted-foreground">
                            {item.total}
                          </TableCell>
                          <TableCell className="py-3 text-right text-muted-foreground">
                            {item.open}
                          </TableCell>
                          <TableCell className="py-3 text-right font-semibold text-rose-600 dark:text-rose-400">
                            {item.late}
                          </TableCell>
                          <TableCell className="py-3 text-right font-semibold text-emerald-600 dark:text-emerald-400">
                            {item.onTime}
                          </TableCell>
                          <TableCell className="py-3 text-right font-semibold text-foreground">
                            {item.avgTime}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          </div>

          {/* Horizontal Ranking Bars Card */}
          <div className="rounded-lg border border-border bg-card p-4 shadow-xs sm:p-6">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-card-foreground">
                  On-time rate by collaborator
                </h3>
                <p className="text-xs text-muted-foreground">
                  Individual delivery reliability ranking across team
                </p>
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
                    {c.name}
                  </div>
                  <div
                    role="progressbar"
                    aria-label={`${c.name} on-time delivery rate`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(100, Math.max(0, c.onTimeRate))}
                    className="h-3 min-w-0 flex-1 overflow-hidden rounded-full border border-border bg-muted/70 dark:bg-muted/50"
                  >
                    <div
                      aria-hidden="true"
                      className="h-full rounded-full bg-primary transition-[width] duration-500"
                      style={{
                        width: `${Math.min(100, Math.max(0, c.onTimeRate))}%`,
                      }}
                    />
                  </div>
                  <span className="w-12 shrink-0 text-right text-sm font-semibold text-foreground tabular-nums">
                    {c.onTimeRate}%
                  </span>
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
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative w-full sm:w-80">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search collaborator or role..."
                className="h-9 w-full rounded-lg border border-input bg-background pr-3 pl-9 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring focus:outline-none"
              />
            </div>

            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:gap-1.5 sm:self-auto">
              {(["ALL", "optimal", "heavy", "light"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setFilterCapacity(status)}
                  className={`min-w-0 rounded-full px-2 py-2 text-[11px] font-medium transition-colors sm:px-3 sm:py-1.5 sm:text-xs ${
                    filterCapacity === status
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "border border-border/40 bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  {status === "ALL"
                    ? "All Capacity"
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Collaborator Performance Table */}
          <div className="overflow-hidden rounded-lg border border-border bg-card shadow-xs">
            <div className="space-y-3 p-3 lg:hidden">
              {filteredCollaborators.map((c) => (
                <article
                  key={c.id}
                  className="rounded-lg border border-border bg-background p-3.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                      {c.initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {c.name}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {c.role}
                      </p>
                    </div>
                    <CapacityBadge status={c.capacityStatus} />
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border pt-3 sm:grid-cols-4">
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        Completed
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                        {c.completedTasks}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        Avg duration
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                        {c.avgDurationDays} d
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        On-time rate
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                        {c.onTimeRate}%
                      </dd>
                    </div>
                    <div>
                      <dt className="text-[10px] text-muted-foreground">
                        Active tasks
                      </dt>
                      <dd className="mt-0.5 text-sm font-semibold text-foreground tabular-nums">
                        {c.activeTasks}
                      </dd>
                    </div>
                  </dl>
                </article>
              ))}
              {filteredCollaborators.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                  No collaborators found matching your search.
                </p>
              ) : null}
            </div>
            <div className="hidden min-w-0 lg:block">
              <Table className="table-fixed text-left text-xs">
                <colgroup>
                  <col className="w-[32%]" />
                  <col className="w-[13.6%]" />
                  <col className="w-[13.6%]" />
                  <col className="w-[13.6%]" />
                  <col className="w-[13.6%]" />
                  <col className="w-[13.6%]" />
                </colgroup>
                <TableHeader className="border-b border-border bg-muted/40 text-muted-foreground">
                  <TableRow>
                    <TableHead className="px-5 py-3.5 font-medium">
                      Collaborator
                    </TableHead>
                    <TableHead className="px-4 py-3.5 text-right font-medium">
                      Completed Tasks
                    </TableHead>
                    <TableHead className="px-4 py-3.5 text-right font-medium">
                      Avg Duration
                    </TableHead>
                    <TableHead className="px-4 py-3.5 text-right font-medium">
                      On-Time Rate
                    </TableHead>
                    <TableHead className="px-4 py-3.5 text-right font-medium">
                      Active Tasks
                    </TableHead>
                    <TableHead className="px-5 py-3.5 text-right font-medium">
                      Capacity
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filteredCollaborators.map((c) => (
                    <TableRow
                      key={c.id}
                      className="transition-colors hover:bg-muted/30"
                    >
                      <TableCell className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-xs font-bold text-primary">
                            {c.initials}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground">
                              {c.name}
                            </p>
                            <p className="truncate text-[11px] text-muted-foreground">
                              {c.role}
                            </p>
                          </div>
                        </div>
                      </TableCell>

                      <TableCell className="px-4 py-4 text-right font-semibold text-foreground">
                        {c.completedTasks}
                      </TableCell>

                      <TableCell className="px-4 py-4 text-right text-muted-foreground">
                        {c.avgDurationDays} d
                      </TableCell>

                      <TableCell className="px-4 py-4 text-right">
                        <span
                          className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                            c.onTimeRate >= 85
                              ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                              : c.onTimeRate >= 75
                                ? "border border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                : "border border-rose-500/20 bg-rose-500/10 text-rose-700 dark:text-rose-400"
                          }`}
                        >
                          {c.onTimeRate}%
                        </span>
                      </TableCell>

                      <TableCell className="px-4 py-4 text-right font-bold text-foreground">
                        {c.activeTasks}
                      </TableCell>

                      <TableCell className="px-5 py-4 text-right">
                        <CapacityBadge status={c.capacityStatus} />
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredCollaborators.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="px-5 py-10 text-center text-muted-foreground"
                      >
                        No collaborators found matching your search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
          <Pagination
            pathname="/manager"
            searchParams={{}}
            page={data.collaboratorsPage}
            totalPages={data.collaboratorsPageCount}
            totalItems={data.collaboratorsTotal}
          />
        </section>
      )}

      {/* VIEW 3: DEMAND ANALYSIS (Service Deliverables & Late vs On-time Ratios) */}
      {activeTab === "demand" && (
        <section className="space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5">
              <h3 className="text-sm font-semibold text-card-foreground">
                Service Delivery Reliability
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Proportion of on-time vs late deliverables per service
              </p>
              <div className="mt-5 space-y-4">
                {data.serviceWorkloads.map((s) => {
                  const onTimePct = s.total
                    ? Math.round((s.onTime / s.total) * 100)
                    : 0
                  const latePct = s.total
                    ? Math.round((s.late / s.total) * 100)
                    : 0
                  return (
                    <div key={s.service} className="space-y-1.5 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 font-medium">
                        <span className="min-w-0 break-words text-foreground">
                          {s.service}
                        </span>
                        <span className="shrink-0">
                          <strong className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {onTimePct}%
                          </strong>{" "}
                          on-time ·{" "}
                          <span className="font-semibold text-rose-600 dark:text-rose-400">
                            {latePct}% late
                          </span>
                        </span>
                      </div>
                      <div className="flex h-3 w-full overflow-hidden rounded-full border border-border/40 bg-muted">
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
                  )
                })}
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5">
              <h3 className="text-sm font-semibold text-card-foreground">
                Turnaround Time vs Benchmark
              </h3>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Average delivery days by creative service discipline
              </p>
              <div className="mt-5 space-y-3">
                {data.serviceWorkloads.map((s) => (
                  <div
                    key={s.service}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-foreground">
                        {s.service}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {s.total} total deliverables
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-primary">
                        {s.avgTime}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        Average duration
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
