"use client"

import Link from "next/link"
import type { WorkerAnalyticsData } from "@/lib/analytics"
import { Button } from "@/components/ui/button"
import {
  CheckCircle2,
  Clock,
  ListTodo,
  CalendarDays,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react"

export function WorkerDashboard({ data }: { data: WorkerAnalyticsData }) {
  const totalCompletedTrailing = data.taskTrend.reduce(
    (acc, m) => acc + m.completedCount,
    0
  )

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Productivity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your personal workload, turnaround time, and task
            velocity.
          </p>
        </div>

        <div>
          <Button
            nativeButton={false}
            render={<Link href="/worker/tasks" />}
            className="w-full gap-1.5 bg-orange-600 text-xs font-semibold text-white shadow-xs hover:bg-orange-700 sm:w-auto"
          >
            <Plus className="size-3.5" />
            <span>Log daily work</span>
          </Button>
        </div>
      </div>

      {/* Top Row: 4 Clean KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Active Tasks
            </span>
            <ListTodo className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.activeTasksCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            in-progress or to do
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Completed Tasks
            </span>
            <CheckCircle2 className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.completedTasksCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            deliverables completed
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              On-Time Rate
            </span>
            <Clock className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.onTimeRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            on-time fulfillment
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Avg Turnaround
            </span>
            <CalendarDays className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.avgDurationDays} days
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            per assigned task
          </p>
        </div>
      </div>

      {/* Middle: Monthly Task Velocity Time Graph */}
      <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Monthly Task Velocity
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Deliverables completed across trailing 6 months
          </p>
        </div>

        {/* Minimalist Bar Chart */}
        <div className="mt-6 flex h-44 items-end justify-between gap-3 px-2 sm:px-6">
          {data.taskTrend.map((m) => {
            const maxScale = 12
            const heightPct = Math.min(
              Math.round((m.completedCount / maxScale) * 100),
              100
            )

            return (
              <div
                key={m.month}
                className="group flex flex-1 flex-col items-center gap-2"
              >
                <span className="text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                  {m.completedCount}
                </span>

                <div className="relative flex h-32 w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-md bg-muted/60">
                  <div
                    className={`w-full rounded-md transition-all duration-300 ${
                      m.isCurrent
                        ? "bg-orange-600 shadow-xs"
                        : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
                    }`}
                    style={{ height: `${Math.max(heightPct, 8)}%` }}
                    title={`${m.month}: ${m.completedCount} completed`}
                  />
                </div>

                <span
                  className={`text-xs ${
                    m.isCurrent
                      ? "font-bold text-orange-600 dark:text-orange-400"
                      : "text-muted-foreground"
                  }`}
                >
                  {m.month}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-5 flex flex-col items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>
            Total completed in 6 months:{" "}
            <strong className="text-foreground">
              {totalCompletedTrailing} tasks
            </strong>
          </span>
          <span className="flex items-center gap-1 font-medium text-foreground">
            <TrendingUp className="size-3.5 text-orange-600 dark:text-orange-400" />
            <span>Active production pace</span>
          </span>
        </div>
      </div>

      {/* Bottom Grid: Upcoming Deadlines & Daily Logs */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Active Tasks & Upcoming Deadlines */}
        <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-7">
          <div>
            <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Upcoming Deadlines
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Assigned tasks requiring your attention
                </p>
              </div>
              <Link
                href="/worker/tasks"
                className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                <span>View all</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {data.upcomingTasks.length > 0 ? (
                data.upcomingTasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex flex-col gap-1 py-3 text-xs sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-medium text-foreground">
                        {task.title}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {task.projectName} · Due{" "}
                        {task.dueAt
                          ? new Date(task.dueAt).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "No due date"}
                      </p>
                    </div>
                    <span className="self-start text-[11px] font-medium text-muted-foreground capitalize sm:self-center">
                      {task.priority.toLowerCase()} priority
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No upcoming deadlines right now. You are all caught up!
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            <Link
              href="/worker/tasks"
              className="font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              Open Workboard →
            </Link>
          </div>
        </div>

        {/* Recent Daily Logs */}
        <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-5">
          <div>
            <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Daily Logs
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Your latest logged daily hours and entries
                </p>
              </div>
              <Link
                href="/worker/tasks"
                className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                <span>Log work</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {data.recentDailyLogs.length > 0 ? (
                data.recentDailyLogs.map((log) => (
                  <div key={log.id} className="py-2.5 text-xs">
                    <p className="truncate font-medium text-foreground">
                      {log.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {log.projectName} ·{" "}
                      {log.workDate
                        ? new Date(log.workDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })
                        : "Recent"}
                    </p>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No daily logs submitted yet.
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-border pt-3 text-xs text-muted-foreground">
            Keep track of daily editing and shoot hours regularly.
          </div>
        </div>
      </div>
    </div>
  )
}
