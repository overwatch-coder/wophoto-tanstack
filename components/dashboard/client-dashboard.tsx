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
} from "lucide-react";

export function ClientDashboard({
  data,
}: {
  data: ClientAnalyticsData;
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Overview</h1>
          <p className="text-sm text-muted-foreground">
            Track your ongoing photography, videography, and creative deliverables
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button render={<Link href="/client/project-feedback" />} variant="outline" className="gap-1.5">
            <MessageSquareText className="size-4" />
            <span>Send feedback</span>
          </Button>
        </div>
      </div>

      {/* Client KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Active Projects</p>
            <FolderKanban className="size-4 text-orange-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.activeProjectsCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">photo & media campaigns</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Deliverables Ready</p>
            <CheckCircle2 className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.completedDeliverablesCount}
          </p>
          <p className="mt-1 text-xs text-emerald-400">approved & delivered</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">In Production</p>
            <Clock className="size-4 text-orange-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-foreground">
            {data.kpis.inProgressDeliverablesCount}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">currently being edited</p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Delivery Reliability</p>
            <Sparkles className="size-4 text-emerald-400" />
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-400">
            {data.kpis.onTimeDeliveryRate}%
          </p>
          <p className="mt-1 text-xs text-muted-foreground">on-time completion</p>
        </div>
      </div>

      {/* Projects Delivery Progress */}
      <div className="rounded-xl border border-white/5 bg-[#121214] p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Projects Delivery Progress</h2>
            <p className="text-xs text-muted-foreground">Active production streams and completion rates</p>
          </div>
          <span className="text-xs text-muted-foreground">
            {data.projects.length} connected project{data.projects.length === 1 ? "" : "s"}
          </span>
        </div>

        <div className="mt-4 space-y-4">
          {data.projects.length > 0 ? (
            data.projects.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-white/5 bg-black/30 p-4 transition-colors hover:border-white/10"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="font-semibold text-foreground text-sm sm:text-base">
                      {p.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Managed by {p.managerName || "Team Lead"} · {p.completedTasks} of {p.totalTasks} deliverables completed
                    </p>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-bold text-orange-400">
                      {p.progressPercentage}%
                    </span>
                    <span className="ml-1 text-xs text-muted-foreground">complete</span>
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-600 to-[#ff6a3d] transition-all duration-500"
                    style={{ width: `${p.progressPercentage}%` }}
                  />
                </div>
              </div>
            ))
          ) : (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No active projects connected to your account yet. Your project manager will assign one shortly.
            </p>
          )}
        </div>
      </div>

      {/* Recent Deliverables */}
      {data.recentDeliverables.length > 0 && (
        <div className="rounded-xl border border-white/5 bg-[#121214] p-5">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Recent Completed Deliverables</h2>
              <p className="text-xs text-muted-foreground">Latest photography and media assets delivered to you</p>
            </div>
            <Link
              href="/client/project-feedback"
              className="flex items-center gap-1 text-xs font-medium text-orange-400 hover:text-orange-300"
            >
              <span>Give feedback</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>

          <div className="mt-4 divide-y divide-white/5">
            {data.recentDeliverables.map((d) => (
              <div key={d.id} className="flex items-center justify-between py-3">
                <div className="min-w-0 pr-3">
                  <p className="truncate font-medium text-foreground text-xs sm:text-sm">
                    {d.title}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{d.projectName}</p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="inline-flex items-center rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                    Delivered
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
