"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutDashboard, ArrowLeft, Layers, Sparkles, CheckCircle2 } from "lucide-react";
import { VersionA } from "./version-a";
import { VersionB } from "./version-b";
import { VersionC } from "./version-c";

type PrototypeVersion = "version-a" | "version-b" | "version-c";

export default function DashboardPrototypePage() {
  const [selectedVersion, setSelectedVersion] =
    useState<PrototypeVersion>("version-c");

  return (
    <div className="min-h-screen bg-[#09090b] text-foreground">
      {/* Top Prototype Controls Banner */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#09090b]/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              href="/manager/tasks"
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to App</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/20 text-orange-400">
                <LayoutDashboard className="size-4" />
              </span>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Performance Dashboard Prototypes
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Interactive toggle between Internal Performance and Team Roster
                </p>
              </div>
            </div>
          </div>

          {/* Version Switcher Tabs */}
          <div className="flex items-center rounded-xl border border-white/10 bg-black/60 p-1 text-xs">
            <button
              onClick={() => setSelectedVersion("version-c")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                selectedVersion === "version-c"
                  ? "bg-orange-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>Merged Hybrid (Active)</span>
            </button>

            <button
              onClick={() => setSelectedVersion("version-a")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                selectedVersion === "version-a"
                  ? "bg-orange-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Layers className="size-3.5" />
              <span>Matrix Only</span>
            </button>

            <button
              onClick={() => setSelectedVersion("version-b")}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                selectedVersion === "version-b"
                  ? "bg-orange-600 text-white shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CheckCircle2 className="size-3.5" />
              <span>Roster Only</span>
            </button>
          </div>
        </div>

        {/* Sub-banner describing selected version */}
        <div className="border-t border-white/5 bg-white/[0.015] px-4 py-2 text-xs text-muted-foreground sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
            <div>
              {selectedVersion === "version-c" && (
                <span>
                  <strong className="text-orange-400">Merged Hybrid:</strong> Combines the Executive Matrix and Collaborator Roster. Use the pill tabs on the dashboard below to toggle seamlessly between <strong>Internal Performance</strong>, <strong>Team Roster</strong>, and <strong>Demand Analysis</strong>!
                </span>
              )}
              {selectedVersion === "version-a" && (
                <span>
                  <strong className="text-orange-400">Matrix Only:</strong> Displays the 5 top KPI cards, monthly weekly load heatmap grid, service breakdown table, and horizontal collaborator ranking bars.
                </span>
              )}
              {selectedVersion === "version-b" && (
                <span>
                  <strong className="text-orange-400">Roster Only:</strong> Focuses purely on team collaborators with search, capacity filter pills, individual completed counts, and turnaround days.
                </span>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground">
              Route: <code className="rounded bg-white/5 px-1.5 py-0.5 text-orange-300">/prototypes/dashboard</code>
            </span>
          </div>
        </div>
      </header>

      {/* Main Canvas */}
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        {selectedVersion === "version-a" && <VersionA />}
        {selectedVersion === "version-b" && <VersionB />}
        {selectedVersion === "version-c" && <VersionC />}
      </main>
    </div>
  );
}
