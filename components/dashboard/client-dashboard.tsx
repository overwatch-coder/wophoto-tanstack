"use client"

import Link from "next/link"
import type { ClientAnalyticsData } from "@/lib/analytics"
import { Button } from "@/components/ui/button"
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Sparkles,
  MessageSquareText,
  ArrowRight,
  TrendingUp,
} from "lucide-react"

export function ClientDashboard({ data }: { data: ClientAnalyticsData }) {
  const totalDeliveredTrailing = data.deliveryTrend.reduce(
    (acc, m) => acc + m.deliveredCount,
    0
  )

  return (
    <div className="min-w-0 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of deliverables, turnaround time, and production velocity.
          </p>
        </div>

        <div>
          <Button
            nativeButton={false}
            render={<Link href="/client/project-feedback" />}
            variant="outline"
            className="w-full gap-1.5 text-xs font-medium shadow-xs sm:w-auto"
          >
            <MessageSquareText className="size-3.5" />
            <span>Send feedback</span>
          </Button>
        </div>
      </div>

      {/* Top Row: 4 Clean KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Active Campaigns
            </span>
            <FolderKanban className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.activeProjectsCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            photo &amp; media campaigns
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Deliverables Ready
            </span>
            <CheckCircle2 className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.completedDeliverablesCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            approved &amp; delivered
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              In Production
            </span>
            <Clock className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.inProgressDeliverablesCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            currently being edited
          </p>
        </div>

        <div className="min-w-0 rounded-lg border border-border bg-card p-3 shadow-xs sm:p-4">
          <div className="flex items-center justify-between">
            <span className="min-w-0 pr-2 text-xs leading-snug font-medium text-muted-foreground">
              Delivery Reliability
            </span>
            <Sparkles className="size-4 text-muted-foreground/70" />
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
            {data.kpis.onTimeDeliveryRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            on-time completion
          </p>
        </div>
      </div>

      {/* Middle Analytics Grid: Delivery Velocity Time Graph + SLA */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Time Graph: Monthly Delivery Velocity */}
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-7">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Monthly Delivery Velocity
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Deliverables completed across trailing 6 months
            </p>
          </div>

          {/* Minimalist Bar Chart */}
          <div className="mt-6 flex h-44 items-end justify-between gap-3 px-2">
            {data.deliveryTrend.map((m) => {
              const maxScale = 12
              const heightPct = Math.min(
                Math.round((m.deliveredCount / maxScale) * 100),
                100
              )

              return (
                <div
                  key={m.month}
                  className="group flex flex-1 flex-col items-center gap-2"
                >
                  <span className="text-[11px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                    {m.deliveredCount}
                  </span>

                  <div className="relative flex h-32 w-full max-w-[36px] flex-col justify-end overflow-hidden rounded-md bg-muted/60">
                    <div
                      className={`w-full rounded-md transition-all duration-300 ${
                        m.isCurrent
                          ? "bg-orange-600 shadow-xs"
                          : "bg-muted-foreground/30 group-hover:bg-muted-foreground/50"
                      }`}
                      style={{ height: `${Math.max(heightPct, 8)}%` }}
                      title={`${m.month}: ${m.deliveredCount} delivered`}
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
                {totalDeliveredTrailing} deliverables
              </strong>
            </span>
            <span className="flex items-center gap-1 font-medium text-foreground">
              <TrendingUp className="size-3.5 text-orange-600 dark:text-orange-400" />
              <span>Consistent delivery cadence</span>
            </span>
          </div>
        </div>

        {/* Quality & Turnaround Metrics */}
        <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-5">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Quality &amp; Turnaround Metrics
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Production speed and delivery benchmarks
            </p>
          </div>

          <div className="my-auto space-y-4 py-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  On-Time Fulfillment
                </span>
                <span className="font-semibold text-foreground">
                  {data.qualityMetrics.onTimeFulfillment}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-orange-600 transition-all duration-300"
                  style={{ width: `${data.qualityMetrics.onTimeFulfillment}%` }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  First-Pass Approval
                </span>
                <span className="font-semibold text-foreground">
                  {data.qualityMetrics.firstPassAcceptance}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-orange-600 transition-all duration-300"
                  style={{
                    width: `${data.qualityMetrics.firstPassAcceptance}%`,
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-md border border-border bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">
                  Avg Turnaround
                </span>
                <p className="mt-1 text-lg font-bold text-foreground">
                  {data.qualityMetrics.avgTurnaroundDays} days
                </p>
              </div>

              <div className="rounded-md border border-border bg-muted/20 p-3">
                <span className="text-xs text-muted-foreground">
                  Satisfaction
                </span>
                <p className="mt-1 text-lg font-bold text-foreground">
                  4.9 / 5.0
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border pt-2 text-[11px] text-muted-foreground">
            Target delivery window: within 3 business days of shoot completion.
          </div>
        </div>
      </div>

      {/* Bottom Row: Breakdown & Recent Deliverables */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Creative Stream Breakdown */}
        <div className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-6">
          <div className="border-b border-border pb-3">
            <h2 className="text-sm font-semibold text-foreground">
              Deliverables by Creative Stream
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Distribution of photography and media assets
            </p>
          </div>

          <div className="mt-4 space-y-3.5">
            {data.categoryBreakdown.map((item) => (
              <div key={item.category} className="space-y-1">
                <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1 text-xs">
                  <span className="min-w-0 font-medium break-words text-foreground">
                    {item.category}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {item.completed} of {item.total} ({item.percentage}%)
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-orange-600 transition-all duration-300"
                    style={{ width: `${item.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Deliverables */}
        <div className="flex min-w-0 flex-col justify-between rounded-lg border border-border bg-card p-4 shadow-xs sm:p-5 lg:col-span-6">
          <div>
            <div className="flex flex-col gap-2 border-b border-border pb-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Latest Deliverables
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Recently finished assets ready for your review
                </p>
              </div>
              <Link
                href="/client/project-feedback"
                className="flex items-center gap-1 text-xs font-medium text-orange-600 hover:underline dark:text-orange-400"
              >
                <span>Give feedback</span>
                <ArrowRight className="size-3" />
              </Link>
            </div>

            <div className="mt-3 divide-y divide-border">
              {data.recentDeliverables.length > 0 ? (
                data.recentDeliverables.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between py-2.5 text-xs"
                  >
                    <div className="min-w-0 pr-3">
                      <p className="truncate font-medium text-foreground">
                        {d.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {d.projectName}
                      </p>
                    </div>
                    <span className="shrink-0 font-medium text-muted-foreground">
                      Delivered
                    </span>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-muted-foreground">
                  No completed deliverables yet.
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span className="min-w-0">
              High-resolution downloads in Feedback portal
            </span>
            <Link
              href="/client/project-feedback"
              className="font-medium text-orange-600 hover:underline dark:text-orange-400"
            >
              Open Feedback →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
