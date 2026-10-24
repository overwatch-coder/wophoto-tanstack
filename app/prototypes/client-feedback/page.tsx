"use client";

import { useState } from "react";
import Link from "next/link";
import { useTheme } from "next-themes";
import {
  ArrowLeft,
  MessageSquareText,
  Sun,
  Moon,
  Info,
  Layers,
  User,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ClientFeedbackItem,
  ClientProjectSummary,
  PrototypeVersion,
} from "./types";
import { PROTOTYPE_CLIENT_PROJECTS, INITIAL_FEEDBACK_ITEMS } from "./data";
import { VersionA } from "./version-a";
import { VersionB } from "./version-b";
import { VersionC } from "./version-c";

export default function ClientFeedbackPrototypePage() {
  const [selectedVersion, setSelectedVersion] = useState<PrototypeVersion>("version-a");
  const [roleView, setRoleView] = useState<"CLIENT" | "MANAGER">("CLIENT");
  const [feedbackItems, setFeedbackItems] = useState<ClientFeedbackItem[]>(INITIAL_FEEDBACK_ITEMS);
  const [projects] = useState<ClientProjectSummary[]>(PROTOTYPE_CLIENT_PROJECTS);
  const { resolvedTheme, setTheme } = useTheme();

  const handleAddFeedback = (
    newFeedback: Omit<ClientFeedbackItem, "id" | "createdAt" | "status">
  ) => {
    const today = new Date().toISOString().split("T")[0];
    const newItem: ClientFeedbackItem = {
      id: `fb-${Date.now()}`,
      status: "NEW",
      createdAt: today,
      ...newFeedback,
    };
    setFeedbackItems((prev) => [newItem, ...prev]);
  };

  const handleResolveFeedback = (id: string, responseNote: string) => {
    const now = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    setFeedbackItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              status: "RESOLVED",
              managerResponse: {
                authorName: "Elena Rostova (Lead)",
                note: responseNote,
                respondedAt: `Today at ${now}`,
              },
            }
          : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      {/* Top Prototype Navigation */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {/* Left: Back Link & Title */}
          <div className="flex items-center gap-3">
            <Link
              href="/client"
              className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" />
              <span>Back to Client Workspace</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <MessageSquareText className="size-4" />
              </span>
              <span className="font-semibold text-sm">Feedback & Revision Prototypes</span>
            </div>
          </div>

          {/* Right Controls: Role Simulation + Theme Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-full border bg-muted/40 p-1">
              <button
                onClick={() => setRoleView("CLIENT")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  roleView === "CLIENT"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <User className="size-3" />
                <span>Client View</span>
              </button>
              <button
                onClick={() => setRoleView("MANAGER")}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  roleView === "MANAGER"
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ShieldCheck className="size-3" />
                <span>Manager Triage</span>
              </button>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              className="h-8 gap-1.5 rounded-full px-3 text-xs"
            >
              {resolvedTheme === "dark" ? (
                <>
                  <Sun className="size-3.5 text-amber-500" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="size-3.5 text-blue-500" />
                  <span>Dark</span>
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Version Switcher Bar */}
        <div className="border-t border-border/60 bg-muted/20 px-4 py-2 sm:px-6">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Layers className="size-3.5 text-primary" />
              <span>Select Design:</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: "version-a", label: "Option 1: Campaign Rail", subtitle: "Right sidebar switches campaigns" },
                { id: "version-b", label: "Option 2: Deliverable Inspector", subtitle: "Right sidebar switches photo sets" },
                { id: "version-c", label: "Option 3: Request Triage Dock", subtitle: "Right sidebar switches revision tickets" },
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
                  <span className="font-medium">{v.label}</span>
                  <span className="hidden md:inline text-[10px] opacity-80">({v.subtitle})</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* Description Callout */}
      <div className="mx-auto max-w-5xl px-4 pt-6">
        <div className="flex items-start gap-2.5 rounded-xl border bg-muted/20 p-3 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0 text-primary mt-0.5" />
          <p>
            {selectedVersion === "version-a" && (
              <>
                <strong>Option 1 (Campaign Rail):</strong> The mini sidebar on the right lists all client campaigns. Clicking a campaign switches the active shoot on the main stage, showing its deliverables, revision conversation, and instant reply composer.
              </>
            )}
            {selectedVersion === "version-b" && (
              <>
                <strong>Option 2 (Deliverables & Proofing Inspector):</strong> The mini sidebar on the right lists the photo deliverables (Monochrome Portraits, Macro Shots, etc.). Clicking a deliverable switches the main stage to that set&apos;s frame contact sheet, approval button, and deliverable-specific retouch thread.
              </>
            )}
            {selectedVersion === "version-c" && (
              <>
                <strong>Option 3 (Request Triage Dock):</strong> The mini sidebar on the right acts as an interactive ticket queue of client requests and feedback. Clicking a ticket loads its full discussion, SLA timeline, and studio resolution, with a &ldquo;+ New Request&rdquo; composer built into the dock.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="mx-auto px-4 py-6">
        {selectedVersion === "version-a" && (
          <VersionA
            projects={projects}
            feedbackItems={feedbackItems}
            onAddFeedback={handleAddFeedback}
            onResolveFeedback={handleResolveFeedback}
            roleView={roleView}
          />
        )}
        {selectedVersion === "version-b" && (
          <VersionB
            projects={projects}
            feedbackItems={feedbackItems}
            onAddFeedback={handleAddFeedback}
            onResolveFeedback={handleResolveFeedback}
            roleView={roleView}
          />
        )}
        {selectedVersion === "version-c" && (
          <VersionC
            projects={projects}
            feedbackItems={feedbackItems}
            onAddFeedback={handleAddFeedback}
            onResolveFeedback={handleResolveFeedback}
            roleView={roleView}
          />
        )}
      </main>
    </div>
  );
}
