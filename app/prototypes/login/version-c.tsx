"use client";

import { useState } from "react";
import {
  Layers3,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  FolderKanban,
  CheckSquare,
  Sparkles,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
} from "lucide-react";
import { PrototypeGoogleButton } from "./google-button";
import { VersionProps } from "./types";

type RolePreview = "manager" | "worker" | "client";

export function VersionC({ state }: VersionProps) {
  const [activeRole, setActiveRole] = useState<RolePreview>("manager");

  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl md:flex-row">
        {/* Left Column: Sign In Form */}
        <div className="flex w-full flex-col justify-between p-6 sm:p-10 md:w-1/2 lg:p-12 border-b md:border-b-0 md:border-r border-border">
          <div>
            {/* Header Brand */}
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-sm">
                <Layers3 className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">WoPhoto</span>
            </div>

            <div className="mt-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Enter your workspace
              </h1>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Connect your verified Google account to access your studio portal.
              </p>
            </div>

            {/* Simulated Alerts */}
            <div className="mt-6">
              {state === "invite-accepted" && (
                <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="flex items-start gap-2.5">
                    <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Invitation Confirmed</p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                        Continue below with the invited Google email address to join the team.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {state === "invite-invalid" && (
                <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                    <div>
                      <p className="font-semibold">Invalid Invitation</p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                        This invitation link is not active. Ask your manager to issue a new one.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {state === "error-suspended" && (
                <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                    <div>
                      <p className="font-semibold">Account Suspended</p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                        Your studio credentials are temporarily inactive. Contact admin.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {state === "error-mismatch" && (
                <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                    <div>
                      <p className="font-semibold">Account Mismatch</p>
                      <p className="mt-0.5 text-xs leading-relaxed opacity-90">
                        Please choose the specific Google address invited by your producer.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action */}
              <div className="space-y-4">
                <PrototypeGoogleButton size="lg" />

                <div className="rounded-xl border border-border bg-muted/30 p-3.5 text-xs text-muted-foreground leading-relaxed">
                  <span className="font-medium text-foreground">Invite-only system:</span>{" "}
                  Your role (Manager, Crew Member, or Client) and project access are automatically configured based on your email invitation.
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer */}
          <div className="mt-8 border-t border-border/60 pt-4 text-xs text-muted-foreground flex items-center justify-between">
            <span>WoPhoto Production Suite</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Need an invite?</span>
          </div>
        </div>

        {/* Right Column: Live Interactive Multi-Role Showcase */}
        <div className="flex w-full flex-col justify-between bg-muted/20 p-6 sm:p-10 md:w-1/2 lg:p-12">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold tracking-wider uppercase text-muted-foreground">
                Explore Studio Roles
              </span>
              <span className="text-xs text-muted-foreground">Interactive Preview</span>
            </div>

            {/* Role Switcher Pill Tabs */}
            <div className="mt-3 grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1 text-xs">
              <button
                type="button"
                onClick={() => setActiveRole("manager")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
                  activeRole === "manager"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <FolderKanban className="size-3.5" />
                <span>Manager</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole("worker")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
                  activeRole === "worker"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <CheckSquare className="size-3.5" />
                <span>Crew</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveRole("client")}
                className={`flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium transition-all ${
                  activeRole === "client"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Client</span>
              </button>
            </div>

            {/* Dynamic Interactive Role Card Preview */}
            <div className="mt-6">
              {activeRole === "manager" && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Production Operations
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Real-time shoot scheduling & resource oversight
                      </p>
                    </div>
                    <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
                      <TrendingUp className="size-4" />
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <span className="text-muted-foreground">Active Shoots</span>
                      <p className="mt-1 text-lg font-bold text-foreground">12</p>
                    </div>
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <span className="text-muted-foreground">Team Utilization</span>
                      <p className="mt-1 text-lg font-bold text-foreground">94%</p>
                    </div>
                  </div>

                  <div className="rounded-lg border border-border/60 p-3 text-xs space-y-2">
                    <div className="flex justify-between font-medium">
                      <span>Vogue Summer Editorial</span>
                      <span className="text-orange-600 dark:text-orange-400 font-semibold">Stage 3 of 4</span>
                    </div>
                    <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-orange-600 rounded-full" style={{ width: "75%" }} />
                    </div>
                  </div>
                </div>
              )}

              {activeRole === "worker" && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Crew Workboard & Tasks
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Daily shot assignments, logging & file delivery
                      </p>
                    </div>
                    <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400">
                      <Clock className="size-4" />
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-orange-500" />
                        <span className="font-medium text-foreground">Color Grading — Batch B</span>
                      </div>
                      <span className="text-muted-foreground">Today, 4:00 PM</span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        <span className="font-medium text-foreground">RAW Ingest & Metadata</span>
                      </div>
                      <span className="text-emerald-600 dark:text-emerald-400 font-medium">Completed</span>
                    </div>
                  </div>
                </div>
              )}

              {activeRole === "client" && (
                <div className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-sm transition-all duration-300">
                  <div className="flex items-center justify-between border-b border-border/60 pb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        Client Delivery Hub
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Direct proof reviews, annotations & final approval
                      </p>
                    </div>
                    <span className="flex size-7 items-center justify-center rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400">
                      <Sparkles className="size-4" />
                    </span>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="rounded-lg border border-border/70 bg-muted/20 p-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-foreground">Campaign Hero Stills</span>
                        <span className="font-semibold text-orange-600 dark:text-orange-400">4 Awaiting Review</span>
                      </div>
                      <p className="mt-1 text-muted-foreground text-[11px]">
                        High-resolution previews ready for client feedback.
                      </p>
                    </div>
                    <div className="flex items-center justify-between rounded-lg border border-border/60 p-2.5">
                      <span className="text-muted-foreground">On-Time Delivery SLA</span>
                      <span className="font-semibold text-foreground">100%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Bottom Note */}
          <div className="mt-6 rounded-xl border border-border/60 bg-card p-4 text-xs text-muted-foreground flex items-center gap-3">
            <Users className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
            <span>One account connects all your active productions seamlessly.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
