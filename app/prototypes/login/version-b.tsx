"use client";

import { useState } from "react";
import {
  Layers3,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  ChevronDown,
  Lock,
  Mail,
  HelpCircle,
} from "lucide-react";
import { PrototypeGoogleButton } from "./google-button";
import { VersionProps } from "./types";

export function VersionB({ state }: VersionProps) {
  const [openFaq, setOpenFaq] = useState<string | null>(null);

  const toggleFaq = (key: string) => {
    setOpenFaq((prev) => (prev === key ? null : key));
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] w-full items-center justify-center overflow-hidden bg-background px-4 py-12 sm:px-6">
      {/* Subtle Architectural Dot Grid Background */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)`,
          backgroundSize: "28px 28px",
        }}
      />

      {/* Soft Ambient Radial Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 size-96 rounded-full bg-orange-600/10 blur-[100px] dark:bg-orange-500/15"
      />

      {/* Floating Precision Card */}
      <div className="relative z-10 w-full max-w-[440px]">
        <div className="rounded-2xl border border-border/80 bg-card/95 p-8 shadow-2xl shadow-black/5 dark:shadow-black/40 backdrop-blur-md sm:p-10">
          {/* Centered Brand Emblem */}
          <div className="flex flex-col items-center text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25">
              <Layers3 className="size-6" />
            </div>

            <h1 className="mt-6 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              WoPhoto
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Unified tracking and delivery for multimedia teams.
            </p>
          </div>

          {/* State Feedback Banners */}
          <div className="mt-6">
            {state === "invite-accepted" && (
              <div className="mb-5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3.5 text-xs text-emerald-900 dark:text-emerald-200">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Invitation verified.</span> Continue with the invited Google account to access your workspace.
                  </div>
                </div>
              </div>
            )}

            {state === "invite-invalid" && (
              <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <span className="font-semibold">Expired or invalid link.</span> Please request a fresh invitation link from your producer.
                  </div>
                </div>
              </div>
            )}

            {state === "error-suspended" && (
              <div className="mb-5 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3.5 text-xs text-amber-900 dark:text-amber-200">
                <div className="flex items-start gap-2.5">
                  <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                  <div>
                    <span className="font-semibold">Access suspended.</span> Your account is currently inactive. Contact your team lead.
                  </div>
                </div>
              </div>
            )}

            {state === "error-mismatch" && (
              <div className="mb-5 rounded-xl border border-destructive/20 bg-destructive/10 p-3.5 text-xs text-destructive">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="size-4 shrink-0 text-destructive mt-0.5" />
                  <div>
                    <span className="font-semibold">Unrecognized account.</span> Sign in using the exact email address that received the invite.
                  </div>
                </div>
              </div>
            )}

            {/* Google Authentication Trigger */}
            <div className="space-y-4">
              <PrototypeGoogleButton size="lg" />

              <div className="flex items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
                <Lock className="size-3.5" />
                <span>Single sign-on via Google Workspace</span>
              </div>
            </div>

            {/* Divider */}
            <div className="my-6 border-t border-border/70" />

            {/* Collapsible Guidance FAQ Accordions */}
            <div className="space-y-2 text-xs">
              <div className="rounded-lg border border-border/60 bg-muted/20">
                <button
                  type="button"
                  onClick={() => toggleFaq("invite")}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left font-medium text-foreground hover:bg-muted/40 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <Mail className="size-3.5 text-muted-foreground" />
                    How do invitations work?
                  </span>
                  <ChevronDown
                    className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                      openFaq === "invite" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === "invite" && (
                  <div className="border-t border-border/40 px-3.5 py-2.5 text-muted-foreground leading-relaxed">
                    Managers send email invitations to crew members or clients. Once invited, you can sign in directly using Google with matching permissions.
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/60 bg-muted/20">
                <button
                  type="button"
                  onClick={() => toggleFaq("account")}
                  className="flex w-full items-center justify-between px-3.5 py-2.5 text-left font-medium text-foreground hover:bg-muted/40 transition-colors rounded-lg"
                >
                  <span className="flex items-center gap-2">
                    <HelpCircle className="size-3.5 text-muted-foreground" />
                    Need access or have trouble?
                  </span>
                  <ChevronDown
                    className={`size-3.5 text-muted-foreground transition-transform duration-200 ${
                      openFaq === "account" ? "rotate-180" : ""
                    }`}
                  />
                </button>
                {openFaq === "account" && (
                  <div className="border-t border-border/40 px-3.5 py-2.5 text-muted-foreground leading-relaxed">
                    If your email changed or you were invited under a personal address, ask your studio manager to update your account roster.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Quiet Minimal Footer */}
        <div className="mt-6 flex items-center justify-between px-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Studio Engine Online</span>
          </div>
          <div className="flex items-center gap-3">
            <a href="#" className="hover:text-foreground transition-colors">Help</a>
            <span>·</span>
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <span>·</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </div>
  );
}
