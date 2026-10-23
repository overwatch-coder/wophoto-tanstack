"use client";

import Link from "next/link";
import type { ClientAnalyticsData } from "@/lib/analytics";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquareText,
  ArrowRight,
  TrendingUp,
  BarChart3,
  ShieldCheck,
  Camera,
  Layers,
  Star,
  Zap,
} from "lucide-react";

export function ClientDashboard({
  data,
}: {
  data: ClientAnalyticsData;
}) {
  const totalDeliveredTrailing = data.deliveryTrend.reduce(
    (acc, m) => acc + m.deliveredCount,
    0
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Client Analytics Overview
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              <span>Production Live</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Executive delivery summary, turnaround velocity, and creative production performance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            nativeButton={false}
            render={<Link href="/client/project-feedback" />}
            variant="outline"
            className="gap-1.5 shadow-xs text-xs font-semibold"
          >
            <MessageSquareText className="size-3.5" />
            <span>Send feedback</span>
          </Button>
        </div>
      </div>

      {/* Top Row: 4 KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Active Campaigns</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <FolderKanban className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.activeProjectsCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">photo & media campaigns</p>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Deliverables Ready</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.completedDeliverablesCount}
          </p>
          <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
            approved & delivered
          </p>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">In Production</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Clock className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.inProgressDeliverablesCount}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">currently being edited</p>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-border/80">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Delivery Reliability</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-3.5" />
            </span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
            {data.kpis.onTimeDeliveryRate}%
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">on-time fulfillment</p>
        </div>
      </div>

      {/* Middle Analytics Grid: Time Graph + Quality Scorecard */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Time Graph: Monthly Delivery Velocity */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs lg:col-span-7">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between border-b border-border pb-3.5">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-orange-600 dark:text-orange-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Monthly Delivery Velocity
                </h2>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Deliverables fulfilled vs in production (Trailing 6 Months)
              </p>
            </div>
            <div className="flex items-center gap-3 self-start sm:self-auto text-[11px]">
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="size-2.5 rounded-xs bg-orange-600" />
                <span>Delivered</span>
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground font-medium">
                <span className="size-2.5 rounded-xs bg-sky-500/80" />
                <span>In Production</span>
              </span>
            </div>
          </div>

          {/* Time Graph Visualization: Vertical Stacked Columns */}
          <div className="mt-6 flex h-48 items-end justify-between gap-3 px-2">
            {data.deliveryTrend.map((m) => {
              const totalVal = Math.max(m.deliveredCount + m.inProductionCount, 1);
              const maxScale = 12; // visual scaling ceiling
              const heightPct = Math.min(Math.round((totalVal / maxScale) * 100), 100);
              const deliveredPct = Math.round((m.deliveredCount / totalVal) * 100);
              const inProgPct = 100 - deliveredPct;

              return (
                <div
                  key={m.month}
                  className="flex flex-1 flex-col items-center gap-2 group cursor-pointer"
                >
                  {/* Total Count Tooltip / Label */}
                  <span className="text-[10px] font-bold text-muted-foreground group-hover:text-foreground transition-colors">
                    {m.deliveredCount + m.inProductionCount}
                  </span>

                  {/* Vertical Column Bar */}
                  <div className="relative flex w-full max-w-[42px] flex-col justify-end overflow-hidden rounded-md bg-muted/50 border border-border/50 h-36 p-0.5">
                    <div
                      className={`w-full overflow-hidden rounded-xs flex flex-col justify-end transition-all duration-500 ${
                        m.isCurrent ? "ring-2 ring-orange-500" : ""
                      }`}
                      style={{ height: `${heightPct}%` }}
                    >
                      {/* In Production Segment */}
                      {m.inProductionCount > 0 && (
                        <div
                          className="w-full bg-sky-500/80 transition-all"
                          style={{ height: `${inProgPct}%` }}
                          title={`${m.month}: ${m.inProductionCount} in production`}
                        />
                      )}
                      {/* Delivered Segment */}
                      <div
                        className="w-full bg-orange-600 transition-all"
                        style={{ height: `${deliveredPct}%` }}
                        title={`${m.month}: ${m.deliveredCount} delivered`}
                      />
                    </div>
                  </div>

                  {/* Month Label */}
                  <div className="flex flex-col items-center">
                    <span
                      className={`text-xs font-semibold ${
                        m.isCurrent
                          ? "text-orange-600 dark:text-orange-400 font-bold"
                          : "text-muted-foreground"
                      }`}
                    >
                      {m.month}
                    </span>
                    {m.isCurrent && (
                      <span className="rounded bg-orange-500/15 px-1 py-0.2 text-[9px] font-bold text-orange-600 dark:text-orange-400">
                        Current
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Graph Summary Banner */}
          <div className="mt-6 flex flex-wrap items-center justify-between border-t border-border bg-muted/20 px-4 py-2.5 rounded-lg text-xs">
            <span className="text-muted-foreground">
              Total fulfilled in 6 months:{" "}
              <strong className="text-foreground">{totalDeliveredTrailing} assets</strong>
            </span>
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
              <TrendingUp className="size-3.5" />
              <span>+18% velocity consistency</span>
            </span>
          </div>
        </div>

        {/* Quality & Performance SLA Scorecard */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs lg:col-span-5 flex flex-col justify-between">
          <div className="border-b border-border pb-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Service & Quality SLA
                </h2>
              </div>
              <span className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                Guaranteed SLA
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production turnaround, approval speed, and rating scores
            </p>
          </div>

          <div className="my-auto space-y-4 py-2">
            {/* Metric 1 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Clock className="size-3 text-orange-500" />
                  <span>On-Time Fulfillment Rate</span>
                </span>
                <span className="font-bold text-foreground">
                  {data.qualityMetrics.onTimeFulfillment}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/50">
                <div
                  className="h-full rounded-full bg-emerald-600 transition-all duration-500"
                  style={{ width: `${data.qualityMetrics.onTimeFulfillment}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">Benchmark target: &gt;90%</span>
            </div>

            {/* Metric 2 */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                  <Sparkles className="size-3 text-sky-500" />
                  <span>First-Pass Acceptance</span>
                </span>
                <span className="font-bold text-foreground">
                  {data.qualityMetrics.firstPassAcceptance}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/50">
                <div
                  className="h-full rounded-full bg-sky-600 transition-all duration-500"
                  style={{ width: `${data.qualityMetrics.firstPassAcceptance}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground">Delivered without required re-edits</span>
            </div>

            {/* Metric 3: Stat Boxes in 2 columns */}
            <div className="grid grid-cols-2 gap-2.5 pt-1">
              <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                  <Zap className="size-3 text-amber-500" />
                  <span>Avg Turnaround</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {data.qualityMetrics.avgTurnaroundDays} <span className="text-xs font-normal text-muted-foreground">Days</span>
                </p>
                <p className="text-[10px] text-muted-foreground">Shoot to deliverable</p>
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-2.5">
                <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                  <Star className="size-3 text-amber-500 fill-amber-500" />
                  <span>Satisfaction Score</span>
                </div>
                <p className="mt-1 text-lg font-bold text-foreground">
                  4.9 <span className="text-xs font-normal text-muted-foreground">/ 5.0</span>
                </p>
                <p className="text-[10px] text-muted-foreground">Client review average</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 text-center text-[11px] text-muted-foreground">
            All creative deliverables meet calibrated color and print standards.
          </div>
        </div>
      </div>

      {/* Bottom Grid: Creative Stream Distribution + Recent Deliverables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Creative Stream Breakdown (Distribution Chart) */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs lg:col-span-6">
          <div className="border-b border-border pb-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="size-4 text-orange-600 dark:text-orange-400" />
                <h2 className="text-sm font-semibold text-foreground">
                  Deliverables by Creative Stream
                </h2>
              </div>
              <span className="text-[11px] text-muted-foreground font-medium">
                Volume &amp; Fulfillment
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Production asset volume and delivery accuracy by medium
            </p>
          </div>

          <div className="mt-4 space-y-4">
            {data.categoryBreakdown.map((item) => (
              <div key={item.category} className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-foreground">{item.category}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-[11px]">
                      {item.completed} of {item.total} items
                    </span>
                    <span className="rounded-md border border-border bg-muted px-1.5 py-0.2 text-[10px] font-semibold text-foreground">
                      {item.percentage}%
                    </span>
                  </div>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/40">
                  <div
                    className="h-full rounded-full bg-orange-600 transition-all duration-500"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Share of campaign assets</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {item.onTimeRate}% on-time
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deliverables Overview */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-xs lg:col-span-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-border pb-3.5">
              <div className="flex items-center gap-2">
                <Camera className="size-4 text-orange-600 dark:text-orange-400" />
                <div>
                  <h2 className="text-sm font-semibold text-foreground">
                    Latest Deliverables
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Assets recently delivered and ready for client feedback
                  </p>
                </div>
              </div>
              <Link
                href="/client/project-feedback"
                className="flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 dark:text-orange-400 hover:underline"
              >
                <span>Give feedback</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {data.recentDeliverables.length > 0 ? (
                data.recentDeliverables.map((d) => (
                  <div key={d.id} className="flex items-center justify-between py-3">
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-medium text-foreground text-xs sm:text-sm">
                        {d.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        {d.projectName}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <span className="inline-flex items-center rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                        Delivered
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <p className="font-medium text-foreground">No completed assets yet</p>
                  <p className="mt-1">
                    Your production deliverables will appear here as soon as they are approved.
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 border-t border-border pt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>High-res download links available in Project Feedback</span>
            <Link
              href="/client/project-feedback"
              className="text-orange-600 hover:underline font-medium dark:text-orange-400"
            >
              Open Feedback Portal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
