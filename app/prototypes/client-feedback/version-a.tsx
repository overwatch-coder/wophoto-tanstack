"use client";

import { useState } from "react";
import {
  FolderKanban,
  CheckCircle2,
  Clock,
  Camera,
  Star,
  Send,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Plus,
  RotateCcw,
  Layers,
  Shield,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ClientFeedbackItem,
  ClientProjectSummary,
  FeedbackType,
} from "./types";

export function VersionA({
  projects,
  feedbackItems,
  onAddFeedback,
  onResolveFeedback,
  roleView,
}: {
  projects: ClientProjectSummary[];
  feedbackItems: ClientFeedbackItem[];
  onAddFeedback: (item: Omit<ClientFeedbackItem, "id" | "createdAt" | "status">) => void;
  onResolveFeedback: (id: string, responseNote: string) => void;
  roleView: "CLIENT" | "MANAGER";
}) {
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");
  const [activeTab, setActiveTab] = useState<"THREAD" | "DELIVERABLES">("THREAD");
  const [type, setType] = useState<FeedbackType>("REVISION");
  const [score, setScore] = useState<number>(5);
  const [commentText, setCommentText] = useState("");
  const [selectedDeliverableId, setSelectedDeliverableId] = useState("");

  // Manager resolve state
  const [replyId, setReplyId] = useState<string | null>(null);
  const [managerReplyText, setManagerReplyText] = useState("");

  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];
  const projectFeedbacks = feedbackItems.filter((i) => i.projectId === activeProject?.id);

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeProject) return;

    const del = activeProject.deliverables.find((d) => d.id === selectedDeliverableId);

    onAddFeedback({
      projectId: activeProject.id,
      projectName: activeProject.name,
      taskId: del ? del.id : undefined,
      taskTitle: del ? del.title : undefined,
      clientName: "Marcus Vance",
      clientEmail: "marcus.vance@voguecreative.com",
      type,
      score,
      title: type === "REVISION" ? "Revision Request" : type === "REVIEW" ? "Client Review" : "Client Issue",
      details: commentText,
    });

    setCommentText("");
  };

  const handleManagerResolve = (id: string) => {
    if (!managerReplyText.trim()) return;
    onResolveFeedback(id, managerReplyText);
    setReplyId(null);
    setManagerReplyText("");
  };

  const progress = activeProject
    ? Math.round((activeProject.completedDeliverables / activeProject.totalDeliverables) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-5xl">
      {/* 2-Column Split: Main Stage (Left) & Mini Sidebar (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Main Content Area (70% width on desktop) */}
        <div className="lg:col-span-8 space-y-4">
          {/* Active Project Header Card */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>{activeProject?.category}</span>
                <span>•</span>
                <span>
                  Lead: <strong className="text-foreground">{activeProject?.leadPhotographer}</strong>
                </span>
              </div>
              <span className="font-semibold text-primary">
                {activeProject?.completedDeliverables}/{activeProject?.totalDeliverables} Sets Delivered ({progress}%)
              </span>
            </div>

            <div>
              <h2 className="text-xl font-bold tracking-tight text-foreground">
                {activeProject?.name}
              </h2>
              <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>

            {/* View Switcher Tabs on Main Stage */}
            <div className="flex items-center justify-between border-t pt-3">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setActiveTab("THREAD")}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                    activeTab === "THREAD"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  Feedback & Revisions ({projectFeedbacks.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("DELIVERABLES")}
                  className={`rounded-full px-3.5 py-1 text-xs font-medium transition-all ${
                    activeTab === "DELIVERABLES"
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                  }`}
                >
                  Deliverables Checklist ({activeProject?.deliverables.length})
                </button>
              </div>

              <span className="text-[11px] text-muted-foreground">
                {roleView === "CLIENT" ? "Client View" : "Manager Triage"}
              </span>
            </div>
          </div>

          {/* Tab 1: Feedback Thread */}
          {activeTab === "THREAD" && (
            <div className="rounded-2xl border bg-card shadow-xs overflow-hidden flex flex-col min-h-[420px] justify-between">
              {/* Thread History */}
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">
                {projectFeedbacks.length === 0 ? (
                  <div className="py-16 text-center text-xs text-muted-foreground">
                    <MessageSquare className="size-6 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="font-medium text-foreground">No feedback logged yet for this campaign.</p>
                    <p className="text-[11px] mt-0.5">Use the bar below to submit revision instructions or leave a review.</p>
                  </div>
                ) : (
                  projectFeedbacks.map((item) => {
                    const isResolved = item.status === "RESOLVED";

                    return (
                      <div key={item.id} className="space-y-2 border-b border-border/50 pb-4 last:border-0 last:pb-0">
                        {/* Header */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2">
                            <Avatar size="sm" className="ring-1 ring-border">
                              <AvatarFallback className="text-[10px] font-bold">MV</AvatarFallback>
                            </Avatar>
                            <div>
                              <span className="font-semibold text-foreground text-sm">{item.clientName}</span>
                              {item.taskTitle && (
                                <span className="text-[11px] text-muted-foreground ml-2">
                                  re: {item.taskTitle}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center text-amber-500">
                              {Array.from({ length: 5 }).map((_, i) => (
                                <Star
                                  key={i}
                                  className={`size-2.5 ${i < item.score ? "fill-amber-500 text-amber-500" : "text-muted/40"}`}
                                />
                              ))}
                            </div>
                            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                              isResolved ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            }`}>
                              {isResolved ? "Resolved" : "Open Request"}
                            </span>
                          </div>
                        </div>

                        {/* Request Content */}
                        <div className="rounded-xl bg-muted/30 px-3.5 py-2.5 text-xs text-foreground leading-relaxed">
                          {item.details}
                        </div>

                        {/* Studio Resolution Note */}
                        {item.managerResponse && (
                          <div className="ml-5 flex items-start gap-2.5 pt-1">
                            <Avatar size="sm" className="ring-1 ring-primary/40 mt-0.5">
                              <AvatarFallback className="text-[10px] bg-primary/10 text-primary font-bold">
                                {activeProject?.leadPhotographer.split(" ").map(n => n[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 space-y-1 text-xs">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="font-medium text-foreground flex items-center gap-1">
                                  <Sparkles className="size-3 text-primary" />
                                  Resolution from {item.managerResponse.authorName}
                                </span>
                                <span className="text-muted-foreground text-[10px]">{item.managerResponse.respondedAt}</span>
                              </div>
                              <div className="rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-xs text-foreground leading-relaxed">
                                {item.managerResponse.note}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Manager triage button */}
                        {!item.managerResponse && roleView === "MANAGER" && (
                          <div className="ml-5 pt-1">
                            {replyId === item.id ? (
                              <div className="space-y-2 rounded-xl border bg-muted/20 p-2.5 text-xs">
                                <Textarea
                                  rows={2}
                                  placeholder="Type resolution update for the client..."
                                  value={managerReplyText}
                                  onChange={(e) => setManagerReplyText(e.target.value)}
                                  className="text-xs rounded-lg"
                                />
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setReplyId(null)}
                                    className="h-7 text-xs rounded-full"
                                  >
                                    Cancel
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleManagerResolve(item.id)}
                                    className="h-7 text-xs rounded-full bg-primary font-medium text-primary-foreground"
                                  >
                                    Resolve
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setReplyId(item.id)}
                                className="text-[11px] text-primary hover:underline font-medium"
                              >
                                + Post Studio Resolution
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* Bottom Quick-Reply Bar */}
              {roleView === "CLIENT" ? (
                <form onSubmit={handleSendFeedback} className="border-t bg-muted/20 p-3 sm:p-4 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1">
                      {(["REVISION", "REVIEW", "COMPLAINT"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setType(t)}
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all ${
                            type === t
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "border border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {t === "REVISION" ? "Revision" : t === "REVIEW" ? "Review" : "Issue"}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-1 text-[11px]">
                      <span className="text-muted-foreground">Attach to:</span>
                      <select
                        value={selectedDeliverableId}
                        onChange={(e) => setSelectedDeliverableId(e.target.value)}
                        className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px] max-w-[150px] truncate"
                      >
                        <option value="">General Campaign</option>
                        {activeProject?.deliverables.map((del) => (
                          <option key={del.id} value={del.id}>
                            {del.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-0.5 text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <button key={s} type="button" onClick={() => setScore(s)} className="p-0.5">
                          <Star className={`size-3.5 ${s <= score ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Input
                      placeholder={`Send a revision instruction to ${activeProject?.leadPhotographer}...`}
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      className="h-10 rounded-full text-xs px-4"
                    />
                    <Button
                      type="submit"
                      disabled={!commentText.trim()}
                      className="size-10 rounded-full bg-primary p-0 text-primary-foreground shrink-0 shadow-xs"
                    >
                      <Send className="size-4" />
                      <span className="sr-only">Send</span>
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
          )}

          {/* Tab 2: Deliverables Checklist */}
          {activeTab === "DELIVERABLES" && (
            <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
              <h3 className="font-semibold text-sm text-foreground">Photography Deliverables</h3>
              <div className="divide-y divide-border/60">
                {activeProject?.deliverables.map((del) => (
                  <div key={del.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="space-y-0.5">
                      <p className="font-medium text-foreground text-sm">{del.title}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {del.format} • {del.photoCount} High-Res Frames
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">
                        {del.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedDeliverableId(del.id);
                          setActiveTab("THREAD");
                        }}
                        className="rounded-full text-xs h-7"
                      >
                        Request Retouch
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Mini Sidebar (30% width on desktop) */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">

          {/* Section 1: Active Campaigns Switcher */}
          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                My Campaigns
              </h3>
              <span className="text-[11px] text-muted-foreground">{projects.length} Total</span>
            </div>

            <div className="space-y-1.5">
              {projects.map((proj) => {
                const isSelected = proj.id === selectedProjectId;
                const projProgress = Math.round((proj.completedDeliverables / proj.totalDeliverables) * 100);

                return (
                  <button
                    key={proj.id}
                    type="button"
                    onClick={() => {
                      setSelectedProjectId(proj.id);
                      setSelectedDeliverableId("");
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs">{proj.name}</p>
                      <p className={`text-[10px] mt-0.5 ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                        {proj.category} • {projProgress}%
                      </p>
                    </div>

                    <ChevronRight className={`size-3.5 shrink-0 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Section 2: Studio Contact Info */}
          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-2 text-xs">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <Camera className="size-3.5 text-primary" />
              <span>Assigned Studio Lead</span>
            </h4>
            <div className="flex items-center gap-2.5 pt-1">
              <Avatar size="sm" className="ring-1 ring-border">
                <AvatarFallback className="text-[10px] font-bold">
                  {activeProject?.leadPhotographer.split(" ").map(n => n[0]).join("")}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="font-medium text-foreground">{activeProject?.leadPhotographer}</p>
                <p className="text-[11px] text-muted-foreground">Lead Photographer & Retoucher</p>
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground pt-1 border-t">
              Revision turnaround target: <strong>Within 24–48 hours</strong>
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
