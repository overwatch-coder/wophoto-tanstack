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
} from "lucide-react";

export function WorkerDashboard({
  data,
}: {
  data: WorkerAnalyticsData;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Productivity</h1>
          <p className="text-sm text-muted-foreground">
            Your personal workload, turnaround metrics, and upcoming deadlines
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button render={<Link href="/worker/tasks" />} className="gap-1.5">
            <Plus className="size-4" />
            <span>Log daily work</span>
          </Button>
        </div>
      </div>

      {/* Worker Personal KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">My Active Tasks</p>
            <ListTodo className="size-4 text-orange-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.activeTasksCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">in-progress or to do</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Completed Tasks</p>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.completedTasksCount}
          </p>
          <p className="mt-1 text-xs text-emerald-400">deliverables completed</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">On-Time Rate</p>
            <Clock className="size-4 text-orange-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-orange-400">
            {data.kpis.onTimeRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">on-time delivery</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Avg Turnaround</p>
            <CalendarDays className="size-4 text-blue-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.avgDurationDays} d
          </p>
          <p className="mt-1 text-xs text-muted-foreground">per assigned task</p>
        </div>
      </div>

      {/* 2-Column Grid: Active Deadlines & Daily Logs */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* Active Tasks & Upcoming Deadlines */}
        <div className="rounded-xl border border-white/5 bg-[#121214] p-5 lg:col-span-7">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Upcoming Deadlines</h2>
              <p className="text-xs text-muted-foreground">Assigned tasks requiring your attention</p>
            </div>
            <Link
              href="/worker/tasks"
              className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
            >
              <span>View all</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-white/5">
            {data.upcomingTasks.length > 0 ? (
              data.upcomingTasks.map((t) => (
                <div key={t.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 pr-3">
                    <p className="truncate font-medium text-foreground text-xs sm:text-sm">
                      {t.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {t.projectName} · {t.priority.toLowerCase()} priority
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="inline-block rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                      {t.dueAt
                        ? `Due ${new Date(t.dueAt).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                            month: "short",
                            day: "numeric",
                          })}`
                        : "No due date"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">
                No pending tasks. You are all caught up!
              </p>
            )}
          </div>
        </div>

        {/* Recent Daily Logs */}
        <div className="rounded-xl border border-white/5 bg-[#121214] p-5 lg:col-span-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Daily Logs</h2>
              <p className="text-xs text-muted-foreground">Your recorded work entries</p>
            </div>
            <Link
              href="/worker/tasks"
              className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
            >
              <span>Open daybook</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-white/5">
            {data.recentDailyLogs.length > 0 ? (
              data.recentDailyLogs.map((l) => (
                <div key={l.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0 pr-2">
                    <p className="truncate text-xs font-medium text-foreground sm:text-sm">
                      {l.title}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{l.projectName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <span className="text-xs text-muted-foreground">
                      {l.workDate
                        ? new Date(l.workDate).toLocaleDateString("en-US", {
                            timeZone: "UTC",
                            month: "short",
                            day: "numeric",
                          })
                        : "Today"}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <p className="text-xs text-muted-foreground">No daily work entries recorded yet.</p>
                <Button render={<Link href="/worker/tasks" />} variant="outline" size="sm" className="mt-3 text-xs">
                  Log your first entry
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
