"use client";

import { useState } from "react";
import {
  MessageSquareText,
  Plus,
  CheckCircle2,
  Clock,
  Sparkles,
  Star,
  AlertCircle,
  LayoutGrid,
  List as TableIcon,
  Search,
  ChevronRight,
  Filter,
  Check,
  FolderKanban,
  ExternalLink,
  Shield,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ClientFeedbackItem,
  ClientProjectSummary,
  FeedbackType,
  FeedbackStatus,
} from "./types";

export function VersionC({
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
  // View Layout Mode: "cards" (normal column grid) or "table" (table view)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [filterType, setFilterType] = useState<"ALL" | FeedbackType>("ALL");
  const [filterProject, setFilterProject] = useState<string>("ALL");

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeDetailItem, setActiveDetailItem] = useState<ClientFeedbackItem | null>(null);

  // Form states for creating request
  const [newProjectId, setNewProjectId] = useState<string>(projects[0]?.id || "");
  const [newTaskId, setNewTaskId] = useState<string>("");
  const [newType, setNewType] = useState<FeedbackType>("REVISION");
  const [newScore, setNewScore] = useState<number>(5);
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  // Form states for manager resolution
  const [managerReplyText, setManagerReplyText] = useState("");

  const currentProjectForNew =
    projects.find((p) => p.id === newProjectId) || projects[0];

  const resetCreateForm = () => {
    setNewTitle("");
    setNewDetails("");
    setNewType("REVISION");
    setNewScore(5);
    setNewTaskId("");
    setCreateError(null);
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectId || !newTitle.trim() || !newDetails.trim() || !currentProjectForNew) {
      setCreateError("Please fill out all required fields.");
      return;
    }

    const del = currentProjectForNew.deliverables.find((d) => d.id === newTaskId);

    onAddFeedback({
      projectId: currentProjectForNew.id,
      projectName: currentProjectForNew.name,
      taskId: del ? del.id : undefined,
      taskTitle: del ? del.title : undefined,
      clientName: "Marcus Vance",
      clientEmail: "marcus.vance@voguecreative.com",
      type: newType,
      score: newScore,
      title: newTitle.trim(),
      details: newDetails.trim(),
    });

    setIsCreateModalOpen(false);
    resetCreateForm();
  };

  const handleResolveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem || !managerReplyText.trim()) return;

    onResolveFeedback(activeDetailItem.id, managerReplyText.trim());
    setActiveDetailItem((prev) =>
      prev
        ? {
            ...prev,
            status: "RESOLVED",
            managerResponse: {
              authorName: "Elena Rostova (Lead)",
              note: managerReplyText.trim(),
              respondedAt: "Just now",
            },
          }
        : null
    );
    setManagerReplyText("");
  };

  const resolvedCount = feedbackItems.filter((i) => i.status === "RESOLVED").length;
  const openCount = feedbackItems.length - resolvedCount;
  const avgScore =
    feedbackItems.length > 0
      ? Number((feedbackItems.reduce((sum, f) => sum + f.score, 0) / feedbackItems.length).toFixed(1))
      : 5.0;

  // Filter feedbacks
  const filteredFeedbacks = feedbackItems.filter((item) => {
    if (filterStatus === "OPEN" && item.status === "RESOLVED") return false;
    if (filterStatus === "RESOLVED" && item.status !== "RESOLVED") return false;
    if (filterType !== "ALL" && item.type !== filterType) return false;
    if (filterProject !== "ALL" && item.projectId !== filterProject) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title.toLowerCase().includes(q);
      const matchProject = item.projectName.toLowerCase().includes(q);
      const matchDeliverable = item.taskTitle?.toLowerCase().includes(q);
      const matchDetails = item.details.toLowerCase().includes(q);
      if (!matchTitle && !matchProject && !matchDeliverable && !matchDetails) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header Actions: Stats + New Request Modal Trigger */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            {roleView === "CLIENT" ? "Client Feedback & Revisions" : "Studio Reviews & Triage"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {roleView === "CLIENT"
              ? "Track active requests, collaborate with your studio team, and review deliverable adjustments."
              : "Review incoming client feedback, manage retouching requests, and post studio resolution notes."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <span className="text-muted-foreground">Open in Studio:</span>
              <span className="font-semibold text-primary">{openCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <span className="text-muted-foreground">Resolved:</span>
              <span className="font-semibold text-foreground">{resolvedCount}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <Star className="size-3 text-amber-500 fill-amber-500" />
              <span className="font-semibold text-foreground">{avgScore}</span>
            </div>
          </div>

          {roleView === "CLIENT" && (
            <Button
              onClick={() => {
                resetCreateForm();
                setIsCreateModalOpen(true);
              }}
              className="gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <Plus className="size-4" />
              <span>New Request</span>
            </Button>
          )}
        </div>
      </div>

      {/* Toolbar: Search, Filters & View Switcher */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2 flex-1 max-w-xl">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by subject, notes, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-full pl-8 pr-3 text-xs"
            />
          </div>

          {projects.length > 1 && (
            <select
              value={filterProject}
              onChange={(e) => setFilterProject(e.target.value)}
              className="h-8 rounded-full border border-border bg-card px-3 text-xs font-medium text-foreground"
            >
              <option value="ALL">All Campaigns</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Pills */}
          <div className="flex items-center rounded-full border bg-muted/30 p-0.5 text-xs">
            {(
              [
                { id: "ALL", label: `All (${feedbackItems.length})` },
                { id: "OPEN", label: `Open (${openCount})` },
                { id: "RESOLVED", label: `Resolved (${resolvedCount})` },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setFilterStatus(filter.id)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
                  filterStatus === filter.id
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>

          {/* Type Filter Dropdown */}
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as "ALL" | FeedbackType)}
            className="h-8 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground"
          >
            <option value="ALL">All Types</option>
            <option value="REVISION">Revisions</option>
            <option value="REVIEW">Reviews</option>
            <option value="COMPLAINT">Issues</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center rounded-full border bg-muted/30 p-0.5">
            <button
              onClick={() => setViewMode("cards")}
              title="Column Cards View"
              className={`flex items-center justify-center size-7 rounded-full transition-all ${
                viewMode === "cards"
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="size-3.5" />
            </button>
            <button
              onClick={() => setViewMode("table")}
              title="Table View"
              className={`flex items-center justify-center size-7 rounded-full transition-all ${
                viewMode === "table"
                  ? "bg-card text-foreground shadow-2xs font-bold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <TableIcon className="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Reviews Container */}
      {filteredFeedbacks.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center shadow-xs space-y-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-muted/60 mx-auto text-muted-foreground">
            <MessageSquareText className="size-6 text-muted-foreground/60" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold text-sm text-foreground">
              {feedbackItems.length === 0
                ? "No feedback or revision requests yet"
                : "No requests match the selected filters"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {feedbackItems.length === 0
                ? "Submit revision instructions, adjustments, or project milestone feedback to the studio team."
                : "Try clearing your search query or selecting a different status filter."}
            </p>
          </div>

          {feedbackItems.length === 0 && roleView === "CLIENT" ? (
            <Button
              onClick={() => {
                resetCreateForm();
                setIsCreateModalOpen(true);
              }}
              className="gap-1.5 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground shadow-xs hover:bg-primary/90"
            >
              <Plus className="size-4" />
              <span>Create First Request</span>
            </Button>
          ) : null}
        </div>
      ) : viewMode === "cards" ? (
        /* Column Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeedbacks.map((item) => {
            const isResolved = item.status === "RESOLVED";

            return (
              <div
                key={item.id}
                onClick={() => setActiveDetailItem(item)}
                className="group cursor-pointer rounded-2xl border bg-card p-4 shadow-xs transition-all hover:border-border/80 hover:shadow-sm flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={isResolved ? "default" : "secondary"}
                        className="rounded-full text-[10px] px-2 py-0"
                      >
                        {item.status}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        {item.type}
                      </Badge>
                    </div>

                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`size-2.5 ${
                            idx < item.score ? "fill-amber-500 text-amber-500" : "text-muted/40"
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors line-clamp-1">
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5 truncate">
                      <span>{item.projectName}</span>
                      {item.taskTitle && (
                        <>
                          <span>•</span>
                          <span className="truncate">{item.taskTitle}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                    {item.details}
                  </p>
                </div>

                <div className="border-t pt-2.5 space-y-2 text-xs">
                  {item.managerResponse ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-medium text-foreground">
                        <span className="flex items-center gap-1">
                          <Sparkles className="size-3 text-primary" />
                          <span>{item.managerResponse.authorName}</span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {item.managerResponse.respondedAt}
                        </span>
                      </div>
                      <p className="line-clamp-1 text-muted-foreground">{item.managerResponse.note}</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-primary" />
                        <span>In studio review queue</span>
                      </span>
                      <span>{item.createdAt}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-0.5 text-[11px]">
                    <span className="text-muted-foreground">by {item.clientName}</span>
                    <span className="font-medium text-primary group-hover:underline flex items-center gap-0.5">
                      <span>{roleView === "MANAGER" && !isResolved ? "Review & Resolve" : "View Details"}</span>
                      <ChevronRight className="size-3" />
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[110px] text-xs">Status</TableHead>
                <TableHead className="text-xs">Request Subject & Details</TableHead>
                <TableHead className="text-xs">Campaign & Set</TableHead>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Rating</TableHead>
                <TableHead className="text-xs">Logged</TableHead>
                <TableHead className="text-right text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.map((item) => {
                const isResolved = item.status === "RESOLVED";

                return (
                  <TableRow
                    key={item.id}
                    onClick={() => setActiveDetailItem(item)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="align-top py-3">
                      <Badge
                        variant={isResolved ? "default" : "secondary"}
                        className="rounded-full text-[10px] px-2 py-0"
                      >
                        {item.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top py-3 max-w-sm">
                      <p className="font-semibold text-xs text-foreground line-clamp-1">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {item.details}
                      </p>
                    </TableCell>

                    <TableCell className="align-top py-3 text-xs text-muted-foreground max-w-[200px] truncate">
                      <p className="font-medium text-foreground truncate">{item.projectName}</p>
                      {item.taskTitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.taskTitle}</p>
                      )}
                    </TableCell>

                    <TableCell className="align-top py-3 text-xs">
                      <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        {item.type}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-top py-3 text-xs">
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`size-2.5 ${
                              idx < item.score ? "fill-amber-500 text-amber-500" : "text-muted/40"
                            }`}
                          />
                        ))}
                      </div>
                    </TableCell>

                    <TableCell className="align-top py-3 text-xs text-muted-foreground whitespace-nowrap">
                      {item.createdAt}
                    </TableCell>

                    <TableCell className="align-top py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDetailItem(item);
                        }}
                        className="h-7 rounded-full text-xs px-2.5 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {roleView === "MANAGER" && !isResolved ? "Resolve" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* 1. SHORT SHADCN MODAL: CREATE REQUEST FORM (Requested by user) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MessageSquareText className="size-4 text-primary" />
              <span>New Revision or Feedback Request</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Submit revision instructions, adjustments, or project feedback to the studio team.
            </DialogDescription>
          </DialogHeader>

          {createError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>{createError}</span>
            </div>
          )}

          <form onSubmit={handleCreateSubmit} className="space-y-4 text-xs py-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="m-proj" className="text-xs font-medium">Campaign / Shoot</Label>
                <select
                  id="m-proj"
                  value={newProjectId}
                  onChange={(e) => {
                    setNewProjectId(e.target.value);
                    setNewTaskId("");
                  }}
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label htmlFor="m-task" className="text-xs font-medium">Specific Deliverable (Optional)</Label>
                <select
                  id="m-task"
                  value={newTaskId}
                  onChange={(e) => setNewTaskId(e.target.value)}
                  className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs text-foreground"
                >
                  <option value="">Whole Shoot / General Campaign</option>
                  {currentProjectForNew?.deliverables.map((del) => (
                    <option key={del.id} value={del.id}>
                      {del.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div className="space-y-1">
                <Label className="text-xs font-medium">Request Type</Label>
                <div className="flex items-center gap-1.5">
                  {(["REVISION", "REVIEW", "COMPLAINT"] as const).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewType(t)}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                        newType === t
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t === "REVISION" ? "Revision" : t === "REVIEW" ? "Review" : "Issue"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-medium">Satisfaction Rating</Label>
                <div className="flex items-center gap-1 text-amber-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setNewScore(s)}
                      className="p-0.5 hover:scale-110 transition-transform"
                    >
                      <Star
                        className={`size-3.5 ${
                          s <= newScore ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                  <span className="text-[11px] text-muted-foreground ml-1.5">
                    {newScore === 5 ? "Exceptional" : `${newScore} / 5 Stars`}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-title" className="text-xs font-medium">Request Subject</Label>
              <Input
                id="m-title"
                required
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Tone down highlight exposure on portrait #04"
                className="h-9 rounded-xl text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="m-details" className="text-xs font-medium">Instructions & Notes</Label>
              <Textarea
                id="m-details"
                required
                rows={3}
                value={newDetails}
                onChange={(e) => setNewDetails(e.target.value)}
                placeholder="Provide specific details, frame numbers, color codes, or crop requests..."
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="h-8 rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="h-8 rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                Submit Request to Studio
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* 2. SHADCN MODAL: REVIEW DETAIL & STUDIO TRIAGE                */}
      {/* ------------------------------------------------------------- */}
      <Dialog
        open={Boolean(activeDetailItem)}
        onOpenChange={(open) => {
          if (!open) {
            setActiveDetailItem(null);
            setManagerReplyText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {activeDetailItem && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={activeDetailItem.status === "RESOLVED" ? "default" : "secondary"}
                      className="rounded-full text-[10px] px-2 py-0"
                    >
                      {activeDetailItem.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                      {activeDetailItem.type}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center text-amber-500">
                      {Array.from({ length: 5 }).map((_, idx) => (
                        <Star
                          key={idx}
                          className={`size-3 ${
                            idx < activeDetailItem.score ? "fill-amber-500 text-amber-500" : "text-muted/40"
                          }`}
                        />
                      ))}
                    </div>
                    <span>•</span>
                    <span>{activeDetailItem.createdAt}</span>
                  </div>
                </div>

                <DialogTitle className="text-base font-bold text-foreground pt-1">
                  {activeDetailItem.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  <span>Campaign: <strong className="text-foreground">{activeDetailItem.projectName}</strong></span>
                  {activeDetailItem.taskTitle && (
                    <>
                      <span> • Deliverable: <strong className="text-foreground">{activeDetailItem.taskTitle}</strong></span>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                <div className="rounded-xl border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar size="sm" className="ring-1 ring-border">
                      <AvatarFallback className="text-[10px] font-bold">
                        {activeDetailItem.clientName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-foreground">{activeDetailItem.clientName}</p>
                      <p className="text-[10px] text-muted-foreground">{activeDetailItem.clientEmail}</p>
                    </div>
                  </div>

                  <p className="text-foreground leading-relaxed whitespace-pre-wrap pl-0.5">
                    {activeDetailItem.details}
                  </p>
                </div>

                <div className="rounded-xl border bg-card p-3 space-y-2">
                  <div className="flex items-center justify-between border-b pb-1.5">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>Studio Resolution & Update</span>
                    </span>
                    {activeDetailItem.managerResponse && (
                      <span className="text-[10px] text-muted-foreground">
                        {activeDetailItem.managerResponse.respondedAt}
                      </span>
                    )}
                  </div>

                  {activeDetailItem.managerResponse ? (
                    <div className="space-y-1.5 pt-1">
                      <span className="font-medium text-foreground">
                        {activeDetailItem.managerResponse.authorName}
                      </span>
                      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                        {activeDetailItem.managerResponse.note}
                      </div>
                    </div>
                  ) : roleView === "MANAGER" ? (
                    <form onSubmit={handleResolveSubmit} className="space-y-2.5 pt-1">
                      <Textarea
                        rows={3}
                        required
                        placeholder="State what retouches were applied, adjustments made, or updated download link..."
                        value={managerReplyText}
                        onChange={(e) => setManagerReplyText(e.target.value)}
                        className="text-xs rounded-xl"
                      />
                      <div className="flex justify-end gap-2">
                        <Button
                          type="submit"
                          size="sm"
                          className="h-8 rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs"
                        >
                          Resolve Ticket & Notify Client
                        </Button>
                      </div>
                    </form>
                  ) : (
                    <div className="py-4 text-center text-xs text-muted-foreground">
                      <Clock className="size-4 mx-auto mb-1 text-muted-foreground/40" />
                      <p>In queue with studio photographer.</p>
                      <p className="text-[10px] mt-0.5">Turnaround target: 24–48 hours.</p>
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setActiveDetailItem(null)}
                  className="rounded-full text-xs h-8"
                >
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
