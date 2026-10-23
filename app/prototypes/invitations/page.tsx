"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  Mail,
  Sun,
  Moon,
  Info,
  Layers,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PrototypeInvitation, PrototypeVersion } from "./types";
import { INITIAL_INVITATIONS } from "./data";
import { VersionA } from "./version-a";
import { VersionB } from "./version-b";
import { VersionC } from "./version-c";
import { VersionD } from "./version-d";

export default function InvitationsPrototypePage() {
  const [selectedVersion, setSelectedVersion] = useState<PrototypeVersion>("version-a");
  const [invitations, setInvitations] = useState<PrototypeInvitation[]>(INITIAL_INVITATIONS);
  const { resolvedTheme, setTheme } = useTheme();

  const handleAddInvitation = (
    newInv: Omit<PrototypeInvitation, "id" | "invitedAt" | "expiresAt" | "token">
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const expiry = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    const token = `wophoto_inv_${Math.random().toString(36).substring(2, 9)}`;

    setInvitations((prev) => [
      {
        id: `inv-${Date.now()}`,
        invitedAt: today,
        expiresAt: expiry,
        token,
        ...newInv,
      },
      ...prev,
    ]);
  };

  const handleRevoke = (id: string) => {
    setInvitations((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top Prototype Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Left: Back Link & Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/manager/invitations"
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Current Invitations</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Mail className="size-4" />
              </span>
              <span className="font-semibold text-sm">Team Invitations Prototypes</span>
            </div>
          </div>

          {/* Right: Theme Toggle */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="size-3.5 text-amber-500" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="size-3.5 text-blue-500" />
                  <span>Dark Mode</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Version Switcher Bar */}
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Layers className="size-3.5 text-primary" />
              <span>Select Variation:</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { id: "version-a", label: "Version A", subtitle: "Studio Roster & Modal" },
                { id: "version-b", label: "Version B", subtitle: "Split Workspace Composer" },
                { id: "version-c", label: "Version C", subtitle: "Role-Tiered & Batch Hub" },
                { id: "version-d", label: "Version D", subtitle: "Minimalist Command" },
              ].map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVersion(v.id as PrototypeVersion)}
                  className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs transition-all ${
                    selectedVersion === v.id
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                  }`}
                >
                  <span>{v.label}</span>
                  <span className="hidden sm:inline text-[10px] opacity-80">({v.subtitle})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Description Callout for Active Version */}
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6">
        <div className="flex items-start gap-3 rounded-2xl border bg-muted/30 p-4 text-xs text-muted-foreground">
          <Info className="size-4 shrink-0 text-primary mt-0.5" />
          <div>
            {selectedVersion === "version-a" && (
              <p>
                <strong className="text-foreground">Version A (Studio Roster & Modal):</strong> Focuses on team visibility and dense record management (like Linear / Vercel). The invitations list is a scannable table with status badges and quick copy buttons, while new invites are created via a focused modal.
              </p>
            )}
            {selectedVersion === "version-b" && (
              <p>
                <strong className="text-foreground">Version B (Split Workspace Composer):</strong> Side-by-side design where managers have a persistent invitation composer on the left with instant link copy and live access summaries, alongside a live activity feed on the right.
              </p>
            )}
            {selectedVersion === "version-c" && (
              <p>
                <strong className="text-foreground">Version C (Role-Tiered & Batch Hub):</strong> Built for onboarding multiple creatives or clients simultaneously. Visual role cards let you toggle between Worker and Client tiers, with support for batch email dispatch and link validity options.
              </p>
            )}
            {selectedVersion === "version-d" && (
              <p>
                <strong className="text-foreground">Version D (Minimalist Command):</strong> Ultra-clean and compact layout matching the app's `rounded-full` pills and orange theme. Includes interactive top KPI filter cards, an inline collapsible form, and segmented status tabs.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {selectedVersion === "version-a" && (
          <VersionA
            invitations={invitations}
            onAddInvitation={handleAddInvitation}
            onRevoke={handleRevoke}
          />
        )}
        {selectedVersion === "version-b" && (
          <VersionB
            invitations={invitations}
            onAddInvitation={handleAddInvitation}
            onRevoke={handleRevoke}
          />
        )}
        {selectedVersion === "version-c" && (
          <VersionC
            invitations={invitations}
            onAddInvitation={handleAddInvitation}
            onRevoke={handleRevoke}
          />
        )}
        {selectedVersion === "version-d" && (
          <VersionD
            invitations={invitations}
            onAddInvitation={handleAddInvitation}
            onRevoke={handleRevoke}
          />
        )}
      </main>
    </div>
  );
}
