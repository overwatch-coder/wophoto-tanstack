"use client";

import {
  mockKPIs,
  mockWeeklyLoad,
  mockServiceWorkloads,
  mockCollaborators,
} from "./data";

export function VersionA() {
  const sortedCollaborators = [...mockCollaborators].sort(
    (a, b) => a.onTimeRate - b.onTimeRate
  );

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Internal Performance</h2>
        <p className="text-sm text-muted-foreground">
          Team Capacity, Workload & Productivity
        </p>
      </div>

      {/* 5 Top KPI Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Active Tasks per Person
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {mockKPIs.activeTasksPerPerson}
            </span>
            <span className="text-xs text-muted-foreground">tasks</span>
          </div>
          <p className="mt-2 text-xs font-medium text-orange-400">
            +{mockKPIs.activeTasksPerPerson - mockKPIs.activeTasksBenchmark} vs benchmark ({mockKPIs.activeTasksBenchmark})
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Team Productivity per Person
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {mockKPIs.teamProductivity}
            </span>
            <span className="text-xs text-muted-foreground">tasks / week</span>
          </div>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            ↗ Stable
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Avg Task Duration
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {mockKPIs.avgTaskDurationDays}
            </span>
            <span className="text-xs text-muted-foreground">days</span>
          </div>
          <p className="mt-2 text-xs font-medium text-orange-400">
            ↘ 0.9 days
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <p className="text-xs font-medium text-muted-foreground">
            On-Time Delivery (OTD)
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {mockKPIs.onTimeDeliveryRate}%
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-emerald-400">
            ↗ +5.1 pts
          </p>
        </div>

        <div className="rounded-xl border border-white/5 bg-[#121214] p-4">
          <p className="text-xs font-medium text-muted-foreground">
            Workload Balance Index
          </p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight">
              {mockKPIs.workloadBalanceIndex}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-rose-400">
            High imbalance
          </p>
        </div>
      </div>

      {/* Middle Grid: Weekly Load Heatmap + Workload By Service */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Weekly Load Trend Matrix */}
        <div className="rounded-xl border border-white/5 bg-[#121214] p-5 lg:col-span-5">
          <h3 className="text-sm font-semibold text-foreground">Weekly Load Trend</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Workload density by month & week</p>

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
              <p className="mt-0.5 text-xs text-muted-foreground">Breakdown of service deliverables</p>
            </div>
            <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Total tasks: 633
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

      {/* Bottom Card: On-time rate by collaborator (Horizontal Ranking Bars) */}
      <div className="rounded-xl border border-white/5 bg-[#121214] p-5 sm:p-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">On-time rate by collaborator</h3>
            <p className="text-xs text-muted-foreground">Individual delivery reliability ranking across team</p>
          </div>
          <span className="text-xs text-muted-foreground">
            10 active collaborators
          </span>
        </div>

        <div className="mt-6 space-y-3.5">
          {sortedCollaborators.map((c) => (
            <div key={c.id} className="flex items-center gap-3 text-xs">
              {/* Collaborator Label */}
              <div className="w-32 shrink-0 truncate font-medium text-muted-foreground sm:w-44">
                {c.name.toUpperCase()}
              </div>

              {/* Progress Bar Container */}
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
    </div>
  );
}
