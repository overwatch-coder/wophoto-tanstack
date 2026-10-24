"use client";

import { useState } from "react";
import {
  CheckCircle2,
  Clock,
  Camera,
  Star,
  Send,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Eye,
  Check,
  AlertCircle,
  FileImage,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  ClientDeliverable,
  ClientFeedbackItem,
  ClientProjectSummary,
  FeedbackType,
} from "./types";

export function VersionB({
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
  const activeProject = projects.find((p) => p.id === selectedProjectId) || projects[0];

  const [selectedDeliverableId, setSelectedDeliverableId] = useState<string>(
    activeProject?.deliverables[0]?.id || ""
  );
  const activeDeliverable =
    activeProject?.deliverables.find((d) => d.id === selectedDeliverableId) ||
    activeProject?.deliverables[0];

  // Specific selected frame inside deliverable
  const [selectedFrame, setSelectedFrame] = useState<string | null>(null);

  // Form states
  const [type, setType] = useState<FeedbackType>("REVISION");
  const [score, setScore] = useState<number>(5);
  const [commentText, setCommentText] = useState("");

  // Manager reply state
  const [replyId, setReplyId] = useState<string | null>(null);
  const [managerReplyText, setManagerReplyText] = useState("");

  // Approved deliverables local toggle state for prototype interactivity
  const [approvedDeliverables, setApprovedDeliverables] = useState<Record<string, boolean>>({
    "del-01": true,
    "del-02": true,
    "del-10": true,
    "del-11": true,
    "del-12": true,
    "del-20": true,
  });

  const isCurrentDeliverableApproved = Boolean(
    activeDeliverable && approvedDeliverables[activeDeliverable.id]
  );

  const deliverableFeedbacks = feedbackItems.filter(
    (i) => i.projectId === activeProject?.id && i.taskId === activeDeliverable?.id
  );

  const handleSendFeedback = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !activeProject || !activeDeliverable) return;

    const frameTag = selectedFrame ? ` [Frame ${selectedFrame}]` : "";

    onAddFeedback({
      projectId: activeProject.id,
      projectName: activeProject.name,
      taskId: activeDeliverable.id,
      taskTitle: activeDeliverable.title,
      clientName: "Marcus Vance",
      clientEmail: "marcus.vance@voguecreative.com",
      type,
      score,
      title: `${type === "REVISION" ? "Revision" : type === "REVIEW" ? "Review" : "Issue"}: ${activeDeliverable.title}${frameTag}`,
      details: selectedFrame ? `(Regarding Frame ${selectedFrame}) ${commentText}` : commentText,
    });

    setCommentText("");
    setSelectedFrame(null);
  };

  const handleManagerResolve = (id: string) => {
    if (!managerReplyText.trim()) return;
    onResolveFeedback(id, managerReplyText);
    setReplyId(null);
    setManagerReplyText("");
  };

  const toggleApproval = (delId: string) => {
    setApprovedDeliverables((prev) => ({
      ...prev,
      [delId]: !prev[delId],
    }));
  };

  // Mock contact sheet frames for the active deliverable
  const mockFrames = [
    { id: "01", label: "#01 Full View", status: "Approved" },
    { id: "02", label: "#02 3/4 Angle", status: "Approved" },
    { id: "03", label: "#03 Macro Crop", status: activeDeliverable?.status === "IN_REVIEW" ? "Needs Note" : "Approved" },
    { id: "04", label: "#04 Detail Texture", status: activeDeliverable?.status === "IN_REVIEW" ? "Revision Open" : "Approved" },
    { id: "05", label: "#05 Alternative Grade", status: "In Queue" },
    { id: "06", label: "#06 Export Master", status: "Draft" },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      {/* Top Project Selector Bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b pb-3">
        <div className="flex items-center gap-2">
          <Label htmlFor="proj-select" className="text-xs font-semibold text-muted-foreground">
            Active Campaign:
          </Label>
          <select
            id="proj-select"
            value={selectedProjectId}
            onChange={(e) => {
              const newProjId = e.target.value;
              setSelectedProjectId(newProjId);
              const targetProj = projects.find((p) => p.id === newProjId);
              if (targetProj && targetProj.deliverables.length > 0) {
                setSelectedDeliverableId(targetProj.deliverables[0].id);
              }
              setSelectedFrame(null);
            }}
            className="h-8 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground shadow-xs"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.category})
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <span>Lead Photographer: <strong className="text-foreground">{activeProject?.leadPhotographer}</strong></span>
        </div>
      </div>

      {/* 2-Column Split: Main Deliverable Stage (Left) & Deliverables Mini Rail (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Main Content Area (67% width) */}
        <div className="lg:col-span-8 space-y-4">

          {/* Deliverable Header Card */}
          <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {activeDeliverable?.title}
                </h2>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{activeDeliverable?.format}</span>
                  <span>•</span>
                  <span>{activeDeliverable?.photoCount} Master Frames</span>
                  <span>•</span>
                  <Badge variant={isCurrentDeliverableApproved ? "default" : "outline"} className="text-[10px] rounded-full">
                    {isCurrentDeliverableApproved ? "Approved" : activeDeliverable?.status}
                  </Badge>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {roleView === "CLIENT" ? (
                  <Button
                    size="sm"
                    variant={isCurrentDeliverableApproved ? "outline" : "default"}
                    onClick={() => activeDeliverable && toggleApproval(activeDeliverable.id)}
                    className="h-8 rounded-full text-xs font-medium shadow-xs"
                  >
                    {isCurrentDeliverableApproved ? (
                      <>
                        <Check className="size-3.5 mr-1 text-emerald-500" />
                        <span>Deliverable Approved</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="size-3.5 mr-1" />
                        <span>Sign Off & Approve</span>
                      </>
                    )}
                  </Button>
                ) : (
                  <Badge variant="secondary" className="text-xs rounded-full px-3 py-1">
                    Manager Review Mode
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Contact Sheet / Frame Proofing Grid */}
          <div className="rounded-2xl border bg-card p-4 sm:p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-xs tracking-tight text-foreground">
                  Frame Contact Sheet
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Select any frame below to tie your revision note directly to that shot.
                </p>
              </div>
              {selectedFrame && (
                <button
                  onClick={() => setSelectedFrame(null)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  Clear Selection (Frame {selectedFrame})
                </button>
              )}
            </div>

            {/* Photo Tiles Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {mockFrames.map((frame) => {
                const isSelected = selectedFrame === frame.id;
                return (
                  <div
                    key={frame.id}
                    onClick={() => setSelectedFrame(isSelected ? null : frame.id)}
                    className={`group relative rounded-xl border p-2 cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                        : "hover:border-border/80 bg-muted/20"
                    }`}
                  >
                    {/* Visual aspect ratio container */}
                    <div className="relative aspect-4/3 w-full rounded-lg bg-linear-to-br from-muted/80 to-muted/40 overflow-hidden flex flex-col items-center justify-center border border-border/40">
                      <FileImage className="size-6 text-muted-foreground/40 group-hover:scale-105 transition-transform" />
                      <span className="text-[10px] font-mono text-muted-foreground mt-1">
                        FRAME {frame.id}
                      </span>

                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 size-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                          <Check className="size-2.5" />
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex items-center justify-between text-[11px]">
                      <span className="font-medium text-foreground truncate">{frame.label}</span>
                      <span className="text-[10px] text-muted-foreground">{frame.status}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Deliverable-Scoped Revision Feed */}
          <div className="rounded-2xl border bg-card shadow-xs flex flex-col overflow-hidden min-h-[300px] justify-between">
            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex items-center justify-between border-b pb-2">
                <h3 className="font-semibold text-xs tracking-tight text-foreground flex items-center gap-1.5">
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>Deliverable Revision Notes ({deliverableFeedbacks.length})</span>
                </h3>
                <span className="text-[11px] text-muted-foreground">
                  Lead retoucher: {activeProject?.leadPhotographer}
                </span>
              </div>

              {deliverableFeedbacks.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <p>No revision requests logged for this specific deliverable.</p>
                  <p className="text-[11px] mt-0.5">Use the input below if you need color or cropping adjustments on this set.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {deliverableFeedbacks.map((item) => (
                    <div key={item.id} className="space-y-2 rounded-xl border bg-muted/20 p-3 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{item.clientName}</span>
                          <Badge variant="outline" className="text-[10px] rounded-full">
                            {item.type}
                          </Badge>
                          <Badge
                            variant={item.status === "RESOLVED" ? "default" : "secondary"}
                            className="text-[10px] rounded-full"
                          >
                            {item.status}
                          </Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground">{item.createdAt}</span>
                      </div>

                      <p className="text-foreground leading-relaxed font-normal">{item.details}</p>

                      {/* Studio Resolution Note */}
                      {item.managerResponse && (
                        <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 p-2.5 space-y-1">
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="font-medium text-foreground flex items-center gap-1">
                              <Sparkles className="size-3 text-primary" />
                              {item.managerResponse.authorName}
                            </span>
                            <span className="text-muted-foreground">{item.managerResponse.respondedAt}</span>
                          </div>
                          <p className="text-xs text-foreground/90">{item.managerResponse.note}</p>
                        </div>
                      )}

                      {/* Manager reply button in manager view */}
                      {!item.managerResponse && roleView === "MANAGER" && (
                        <div className="pt-1">
                          {replyId === item.id ? (
                            <div className="space-y-2 rounded-lg border bg-card p-2 text-xs">
                              <Textarea
                                rows={2}
                                placeholder="State what adjustments were applied..."
                                value={managerReplyText}
                                onChange={(e) => setManagerReplyText(e.target.value)}
                                className="text-xs"
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
                                  Mark Resolved
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
                  ))}
                </div>
              )}
            </div>

            {/* Bottom Composer Bar */}
            {roleView === "CLIENT" ? (
              <form onSubmit={handleSendFeedback} className="border-t bg-muted/20 p-3 sm:p-4 space-y-2">
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

                  {selectedFrame && (
                    <span className="text-[11px] font-medium text-primary">
                      Tagged: Frame #{selectedFrame}
                    </span>
                  )}

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
                    placeholder={
                      selectedFrame
                        ? `Describe retouch needed for Frame #${selectedFrame}...`
                        : `Leave retouch feedback for ${activeDeliverable?.title}...`
                    }
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

        </div>

        {/* Right Mini Sidebar: Deliverable Selector Rail (33% width) */}
        <div className="lg:col-span-4 space-y-4 sticky top-20">

          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                Photo Deliverables
              </h3>
              <span className="text-[11px] text-muted-foreground">
                {activeProject?.deliverables.length} Sets
              </span>
            </div>

            {/* List of deliverables on the right rail */}
            <div className="space-y-1.5">
              {activeProject?.deliverables.map((del) => {
                const isSelected = del.id === activeDeliverable?.id;
                const isApproved = approvedDeliverables[del.id];

                return (
                  <button
                    key={del.id}
                    type="button"
                    onClick={() => {
                      setSelectedDeliverableId(del.id);
                      setSelectedFrame(null);
                    }}
                    className={`w-full flex items-center justify-between rounded-xl px-3 py-2.5 text-left text-xs transition-all ${
                      isSelected
                        ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "hover:bg-muted/50 text-foreground border border-transparent"
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <p className="truncate text-xs">{del.title}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className={`text-[10px] ${isSelected ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
                          {del.photoCount} Frames
                        </span>
                        <span className={`text-[10px] ${isSelected ? "text-primary-foreground/60" : "text-muted-foreground"}`}>•</span>
                        <span className={`text-[10px] ${isSelected ? "text-primary-foreground/90 font-medium" : "text-muted-foreground"}`}>
                          {isApproved ? "Approved" : del.status}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      {isApproved ? (
                        <Check className={`size-3.5 ${isSelected ? "text-primary-foreground" : "text-emerald-500"}`} />
                      ) : (
                        <ChevronRight className={`size-3.5 ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`} />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shoot Retouch Guidelines Card */}
          <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-2 text-xs">
            <h4 className="font-semibold text-foreground flex items-center gap-1.5 text-xs">
              <SlidersHorizontal className="size-3.5 text-primary" />
              <span>Retouching Protocol</span>
            </h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Click any photo set above to review frames. Approving locks the master download link for your production team.
            </p>
            <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
              <span>Color Profile:</span>
              <span className="font-mono text-foreground font-medium">sRGB / Display P3</span>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}