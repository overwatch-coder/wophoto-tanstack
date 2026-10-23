"use client";

import Link from "next/link";
import type { WorkerAnalyticsData } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  ListTodo,
  CalendarDays,
  Plus,
  ArrowRight,
  TrendingUp,
} from "lucide-react";

export function WorkerDashboard({
  data,
}: {
  data: WorkerAnalyticsData;
}) {
  const totalCompletedTrailing = data.taskTrend.reduce(
    (acc, m) => acc + m.completedCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Productivity
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of your personal workload, turnaround time, and task velocity.
          </p>
        </div>

        <div>
          <Button
            nativeButton={false}
            render={<Link href="/worker/tasks" />}
            className="gap-1.5 shadow-xs text-xs font-semibold bg-orange-600 hover:bg-orange-700 text-white"
          >
            <Plus className="size-3.5" />
            <span>Log daily work</span>
          </Button>
        </div>
      </div>

      {/* Top Row: 4 Clean KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Tasks</span>
            <ListTodo className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.activeTasksCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">in-progress or to do</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Completed Tasks</span>
            <CheckCircle2 className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.completedTasksCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">deliverables completed</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">On-Time Rate</span>
            <Clock className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.onTimeRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">on-time fulfillment</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Avg Turnaround</span>
            <CalendarDays className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.avgDurationDays} days
          </p>
          <p className="mt-1 text-xs text-muted-foreground">per assigned task</p>
        </div>
      </div>

      {/* Middle: Monthly Task Velocity Time Graph */}
      <div className="rounded-lg border border-border bg-card p-5 shadow-xs">
        <div className="border-b border-border pb-3">
          <h2 className="text-sm font-semibold text-foreground">
            Monthly Task Velocity
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Deliverables completed across trailing 6 months
          </p>
        </div>

        {/* Minimalist Bar Chart */}
        <div className="mt-6 flex h-44 items-end justify-between gap-3 px-2 sm:px-6">
          {data.taskTrend.map((m) => {
            const maxScale = 12;
            const heightPct = Math.min(
              Math.round((m.completedCount / maxScale) * 100),
              100
            );

            return (
              <div
                key={m.month}
                className="flex flex-1 flex-col items-center gap-2 group"
              >
                <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">
                  {m.completedCount}
                </span>

                <div className="relative flex w-full max-w-[44px] flex-col justify-end overflow-hidden rounded-md bg-muted/60 h-32">
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
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span>
            Total completed in 6 months:{" "}
            <strong className="text-foreground">{totalCompletedTrailing} tasks</strong>
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
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Upcoming Deadlines
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Assigned tasks requiring your attention
                </p>
              </div>
              <Link
                href="/worker/tasks"
                className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
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
                      <p className="text-muted-foreground text-[11px]">
                        {task.projectName} · Due {task.dueAt ? new Date(task.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"}
                      </p>
                    </div>
                    <span className="self-start sm:self-center capitalize text-[11px] text-muted-foreground font-medium">
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
              className="text-orange-600 dark:text-orange-400 font-medium hover:underline"
            >
              Open Workboard →
            </Link>
          </div>
        </div>

        {/* Recent Daily Logs */}
        <div className="rounded-lg border border-border bg-card p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Recent Daily Logs
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Your latest logged daily hours and entries
                </p>
              </div>
              <Link
                href="/worker/tasks"
                className="flex items-center gap-1 text-xs font-medium text-orange-600 dark:text-orange-400 hover:underline"
              >
                <span>Log work</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {data.recentDailyLogs.length > 0 ? (
                data.recentDailyLogs.map((log) => (
                  <div key={log.id} className="py-2.5 text-xs">
                    <p className="font-medium text-foreground truncate">{log.title}</p>
                    <p className="text-muted-foreground text-[11px] mt-0.5">
                      {log.projectName} · {log.workDate ? new Date(log.workDate).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "Recent"}
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
  );
}
