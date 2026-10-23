"use client";

import { Camera, CheckCircle2, AlertTriangle, ShieldAlert, Sparkles, HelpCircle } from "lucide-react";
import { PrototypeGoogleButton } from "./google-button";
import { VersionProps } from "./types";

export function VersionA({ state }: VersionProps) {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] w-full items-stretch justify-center bg-background p-4 sm:p-6 lg:p-8">
      <div className="flex w-full max-w-6xl overflow-hidden rounded-2xl border border-border bg-card shadow-xl lg:min-h-[640px]">
        {/* Left Side: Editorial Photography Canvas */}
        <div className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
          {/* Subtle Background Photography */}
          <div
            className="absolute inset-0 bg-cover bg-center opacity-40 mix-blend-luminosity transition-transform duration-700 hover:scale-105"
            style={{
              backgroundImage:
                "url('https://images.unsplash.com/photo-1542038784456-1ea8e935640e?auto=format&fit=crop&w=1600&q=80')",
            }}
          />
          {/* Gradient Scrim */}
          <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/60 to-zinc-950/30" />

          {/* Top Brand & Metadata */}
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/30">
                <Camera className="size-4" />
              </div>
              <span className="text-lg font-bold tracking-tight">WoPhoto</span>
            </div>
            <div className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1 font-mono text-[11px] text-zinc-300 backdrop-blur-xs">
              50mm ƒ/1.4 · 1/250s · ISO 100
            </div>
          </div>

          {/* Center Visual Element */}
          <div className="relative z-10 my-auto max-w-md py-8">
            <h2 className="text-3xl font-semibold tracking-tight text-white leading-tight">
              Precision workflow for high-volume studio productions.
            </h2>
            <p className="mt-3 text-sm text-zinc-300 leading-relaxed">
              From creative briefs and shoot schedules to multi-role daily task logs and direct client approvals.
            </p>
          </div>

          {/* Bottom Quote */}
          <div className="relative z-10 border-t border-white/10 pt-6">
            <blockquote className="text-xs italic text-zinc-300 leading-relaxed">
              &ldquo;WoPhoto replaced messy email chains and ad-hoc spreadsheets with one crystal-clear production pipeline.&rdquo;
            </blockquote>
            <p className="mt-2 text-[11px] font-medium text-zinc-400">
              Marcus Chen — Head of Photography, Studio Lumière
            </p>
          </div>
        </div>

        {/* Right Side: Clean Sign-In Form */}
        <div className="flex flex-1 flex-col justify-between p-6 sm:p-10 lg:p-12">
          {/* Top Brand (Visible on mobile/tablet) */}
          <div className="flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 items-center justify-center rounded-lg bg-orange-600 text-white">
                <Camera className="size-4" />
              </div>
              <span className="text-base font-bold tracking-tight">WoPhoto</span>
            </div>
            <span className="text-xs text-muted-foreground">Studio Access</span>
          </div>

          {/* Center Form Content */}
          <div className="my-auto mx-auto w-full max-w-md py-6">
            <div className="mb-8">
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Sign in to Studio
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Welcome back. Access your active shoots, team tasks, and asset deliveries.
              </p>
            </div>

            {/* Simulated State Alerts */}
            {state === "invite-accepted" && (
              <div className="mb-6 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-900 dark:text-emerald-200">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Invitation Accepted</p>
                    <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
                      Your invitation has been registered. Continue with your invited Google account to access your studio workspace.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {state === "invite-invalid" && (
              <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Invalid or Expired Invitation</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                      This invitation token is invalid or has already been redeemed. Please contact your studio manager for a fresh link.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {state === "error-suspended" && (
              <div className="mb-6 rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-3">
                  <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Account Suspended</p>
                    <p className="mt-1 text-xs text-amber-800 dark:text-amber-300 leading-relaxed">
                      Your studio access is currently suspended. Please speak with your production manager to restore access.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {state === "error-mismatch" && (
              <div className="mb-6 rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-destructive">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="size-5 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold">Account Mismatch</p>
                    <p className="mt-1 text-xs leading-relaxed opacity-90">
                      The Google account you selected does not match an invited studio member. Please sign in with the invited email address.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Google Authentication Action */}
            <div className="space-y-4">
              <PrototypeGoogleButton size="lg" />

              <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-3 text-muted-foreground">
                    Private Studio Access
                  </span>
                </div>
              </div>

              <div className="rounded-xl border border-border/60 bg-muted/30 p-3.5 text-xs text-muted-foreground leading-relaxed">
                <div className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                  <HelpCircle className="size-3.5 text-orange-600 dark:text-orange-400" />
                  <span>Invitation Required</span>
                </div>
                WoPhoto authentication is restricted to invited production crew members, managers, and clients. Password-based sign-in is disabled for studio security.
              </div>
            </div>
          </div>

          {/* Bottom Security & Help Footer */}
          <div className="border-t border-border/50 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>© 2026 WoPhoto Studio</span>
            <div className="flex items-center gap-4">
              <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
              <a href="#" className="hover:text-foreground transition-colors">Terms</a>
              <a href="#" className="hover:text-foreground transition-colors">Contact Support</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
