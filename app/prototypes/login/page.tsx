"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  LogIn,
  Layers,
  Sparkles,
  Camera,
  Sun,
  Moon,
  Info,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { VersionA } from "./version-a";
import { VersionB } from "./version-b";
import { VersionC } from "./version-c";
import { PrototypeVersion, LoginSimulatedState } from "./types";

export default function LoginPrototypesPage() {
  const [selectedVersion, setSelectedVersion] =
    useState<PrototypeVersion>("version-a");
  const [simulatedState, setSimulatedState] =
    useState<LoginSimulatedState>("normal");
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top Prototype Controls Banner */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Left: Back Link & Info */}
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Current Login</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/20 text-orange-600 dark:text-orange-400">
                <LogIn className="size-4" />
              </span>
              <div>
                <h1 className="text-sm font-semibold tracking-tight text-foreground">
                  Login Page Prototypes
                </h1>
                <p className="text-[11px] text-muted-foreground">
                  Compare 3 distinct variations of the WoPhoto studio sign-in experience
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: Version Switcher & Theme Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Version Switcher Tabs */}
            <div className="flex items-center rounded-xl border border-border bg-muted/40 p-1 text-xs">
              <button
                type="button"
                onClick={() => setSelectedVersion("version-a")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-a"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Camera className="size-3.5" />
                <span>Version A: Studio Editorial</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedVersion("version-b")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-b"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Layers className="size-3.5" />
                <span>Version B: Minimal Canvas</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedVersion("version-c")}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-all ${
                  selectedVersion === "version-c"
                    ? "bg-orange-600 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="size-3.5" />
                <span>Version C: Creative Command</span>
              </button>
            </div>

            {/* Dark / Light Mode Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-8 w-8 p-0"
              title="Toggle Light / Dark Mode"
            >
              {resolvedTheme === "dark" ? (
                <Sun className="size-4 text-orange-400" />
              ) : (
                <Moon className="size-4 text-slate-700" />
              )}
            </Button>
          </div>
        </div>

        {/* Sub-banner: State Simulator & Version Description */}
        <div className="border-t border-border bg-muted/20 px-4 py-2.5 text-xs sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            {/* Version Description */}
            <div className="flex items-center gap-2">
              <Info className="size-3.5 text-orange-500 shrink-0" />
              {selectedVersion === "version-a" && (
                <span>
                  <strong className="text-foreground">Version A (Studio Editorial):</strong>{" "}
                  Immersive split layout with photography backdrop, darkroom aperture styling, camera EXIF tag, client quote, and clean sign-in card.
                </span>
              )}
              {selectedVersion === "version-b" && (
                <span>
                  <strong className="text-foreground">Version B (Minimal Canvas):</strong>{" "}
                  Distraction-free centered card with delicate architectural dot grid, ambient radial aura, brand emblem, and expandable studio FAQs.
                </span>
              )}
              {selectedVersion === "version-c" && (
                <span>
                  <strong className="text-foreground">Version C (Creative Command):</strong>{" "}
                  Split card with an interactive 3-role live preview (Manager, Crew Member, Client) illustrating the workspace before logging in.
                </span>
              )}
            </div>

            {/* Simulated State Toggle Pills */}
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[11px] text-muted-foreground mr-1">Simulate:</span>
              <button
                type="button"
                onClick={() => setSimulatedState("normal")}
                className={`rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  simulatedState === "normal"
                    ? "bg-foreground text-background font-semibold"
                    : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                Standard
              </button>
              <button
                type="button"
                onClick={() => setSimulatedState("invite-accepted")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  simulatedState === "invite-accepted"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "bg-muted text-muted-foreground hover:text-emerald-600"
                }`}
              >
                <CheckCircle2 className="size-3" />
                <span>Invite Accepted</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulatedState("invite-invalid")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  simulatedState === "invite-invalid"
                    ? "bg-destructive text-destructive-foreground font-semibold"
                    : "bg-muted text-muted-foreground hover:text-destructive"
                }`}
              >
                <AlertTriangle className="size-3" />
                <span>Invalid Link</span>
              </button>
              <button
                type="button"
                onClick={() => setSimulatedState("error-suspended")}
                className={`flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ${
                  simulatedState === "error-suspended"
                    ? "bg-amber-600 text-white font-semibold"
                    : "bg-muted text-muted-foreground hover:text-amber-600"
                }`}
              >
                <ShieldAlert className="size-3" />
                <span>Suspended</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Prototype Canvas */}
      <main className="w-full">
        {selectedVersion === "version-a" && (
          <VersionA state={simulatedState} onStateChange={setSimulatedState} />
        )}
        {selectedVersion === "version-b" && (
          <VersionB state={simulatedState} onStateChange={setSimulatedState} />
        )}
        {selectedVersion === "version-c" && (
          <VersionC state={simulatedState} onStateChange={setSimulatedState} />
        )}
      </main>
    </div>
  );
}
