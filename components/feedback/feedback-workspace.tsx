"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  FolderKanban,
  Wrench,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
import { FeedbackType, FeedbackStatus } from "@/generated/prisma/browser";
import {
  ClientFeedbackViewItem,
  FeedbackWorkspaceData,
} from "@/lib/feedback";
import {
  createClientFeedback,
  updateClientFeedback,
  resolveFeedback,
  delegateFeedbackToWorker,
  submitWorkerRevision,
} from "@/app/actions/feedback";
import { getProfileImageSrc } from "@/lib/profile-image";
import { Pagination } from "@/components/ui/pagination";
import { useDebounce } from "@uidotdev/usehooks";
import {
  clearClientFeedbackDraft,
  getClientFeedbackDraftSnapshot,
  parseClientFeedbackDraftJson,
  subscribeClientFeedbackDraft,
} from "@/lib/client-feedback-draft";

export function FeedbackWorkspace({
  initialData,
  roleView,
}: {
  initialData: FeedbackWorkspaceData;
  roleView: "CLIENT" | "MANAGER" | "WORKER";
}) {
  const { feedbacks, projects, workers = [], stats } = initialData;
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentSearch = searchParams.toString();
  const targetFeedbackId = searchParams.get("feedbackId");
  const shouldOpenNewFeedback = searchParams.get("newFeedback") === "1";
  const clientFeedbackDraftRaw = useSyncExternalStore(
    subscribeClientFeedbackDraft,
    getClientFeedbackDraftSnapshot,
    () => null,
  );
  const clientReviewDraft = roleView === "CLIENT" && shouldOpenNewFeedback && clientFeedbackDraftRaw
    ? parseClientFeedbackDraftJson(clientFeedbackDraftRaw, projects)
    : null;
  const initialTargetFeedback = targetFeedbackId
    ? feedbacks.find((item) => item.id === targetFeedbackId) ?? null
    : null;
  const { filters } = initialData;
  const filterStatus = filters.status;
  const filterType = filters.type;
  const filterProject = filters.projectId || "ALL";

  // View Layout Mode: "cards" (normal column grid) or "table" (table view)
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState(filters.query);
  const debouncedSearchQuery = useDebounce(searchQuery, 350);
  const [prevFilterQuery, setPrevFilterQuery] = useState(filters.query);

  if (prevFilterQuery !== filters.query) {
    setPrevFilterQuery(filters.query);
    setSearchQuery(filters.query);
  }

  const updateFilter = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(window.location.search);
    if (!value || value === "ALL") params.delete(key);
    else params.set(key, value);
    params.delete("page");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router]);

  useEffect(() => {
    if (debouncedSearchQuery !== searchQuery) return;
    const query = debouncedSearchQuery.trim().slice(0, 120);
    if (query === (filters.query ?? "")) return;
    updateFilter("q", query);
  }, [debouncedSearchQuery, searchQuery, filters.query, updateFilter]);

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeDetailItem, setActiveDetailItem] = useState<ClientFeedbackViewItem | null>(initialTargetFeedback);
  const [editingFeedbackId, setEditingFeedbackId] = useState<string | null>(null);

  const clearFeedbackTargetFromUrl = () => {
    if (!targetFeedbackId && !shouldOpenNewFeedback) return;
    clearClientFeedbackDraft();
    const params = new URLSearchParams(currentSearch);
    params.delete("feedbackId");
    params.delete("newFeedback");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  // Form states for creating request (Client)
  const [newProjectId, setNewProjectId] = useState<string>(projects[0]?.id || "");
  const [newTaskId, setNewTaskId] = useState<string>("");
  const [newType, setNewType] = useState<FeedbackType>(FeedbackType.REVISION);
  const [newScore, setNewScore] = useState<number>(5);
  const [newTitle, setNewTitle] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, startCreateTransition] = useTransition();
  const activeProjectId = clientReviewDraft?.projectId ?? newProjectId;
  const activeTaskId = clientReviewDraft ? "" : newTaskId;
  const activeType = clientReviewDraft?.type ?? newType;
  const activeScore = clientReviewDraft?.score ?? newScore;
  const activeDetails = clientReviewDraft?.details ?? newDetails;
  const isReviewRequest = activeType === FeedbackType.REVIEW;
  const isCreateDialogOpen = isCreateModalOpen || Boolean(clientReviewDraft);

  // Manager action mode: "resolve" (direct) or "delegate" (give work to worker)
  const [managerActionMode, setManagerActionMode] = useState<"resolve" | "delegate">(
    initialTargetFeedback?.type !== FeedbackType.REVIEW &&
      initialTargetFeedback?.status === FeedbackStatus.ASSIGNED_TO_WORKER
      ? "delegate"
      : "resolve",
  );
  const [managerReplyText, setManagerReplyText] = useState("");
  const [selectedWorkerId, setSelectedWorkerId] = useState<string>(
    initialTargetFeedback?.assignedWorkerId ||
      initialTargetFeedback?.taskAssignees?.[0]?.id ||
      workers[0]?.id ||
      "",
  );
  const [delegationInstructions, setDelegationInstructions] = useState(
    initialTargetFeedback?.delegationNote || "",
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [isActionPending, startActionTransition] = useTransition();

  // Worker revision submission
  const [workerSubmissionNote, setWorkerSubmissionNote] = useState("");
  const [isWorkerSubmitting, startWorkerTransition] = useTransition();


  const closeDetail = () => {
    setActiveDetailItem(null);
    setManagerReplyText("");
    setDelegationInstructions("");
    setWorkerSubmissionNote("");
    setActionError(null);
    setActionSuccess(null);
    clearFeedbackTargetFromUrl();
  };

  const closeCreateModal = () => {
    setIsCreateModalOpen(false);
    clearFeedbackTargetFromUrl();
  };

  const currentProjectForNew =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const materializeClientReviewDraft = () => {
    if (!clientReviewDraft) return;
    setNewProjectId(clientReviewDraft.projectId);
    setNewTaskId("");
    setNewType(FeedbackType.REVIEW);
    setNewScore(clientReviewDraft.score);
    setNewTitle("");
    setNewDetails(clientReviewDraft.details);
    setEditingFeedbackId(null);
    clearClientFeedbackDraft();
  };

  const resetCreateForm = () => {
    clearClientFeedbackDraft();
    setEditingFeedbackId(null);
    setNewTitle("");
    setNewDetails("");
    setNewType(FeedbackType.REVISION);
    setNewScore(5);
    setNewTaskId("");
    setCreateError(null);
  };

  const openEditFeedback = (item: ClientFeedbackViewItem) => {
    clearClientFeedbackDraft();
    setEditingFeedbackId(item.id);
    setNewProjectId(item.projectId);
    setNewTaskId(item.taskId || "");
    setNewType(item.type);
    setNewScore(item.score ?? 5);
    setNewTitle(item.type === FeedbackType.REVIEW ? "" : item.title);
    setNewDetails(item.details);
    setCreateError(null);
    setActiveDetailItem(null);
    setManagerReplyText("");
    setDelegationInstructions("");
    setWorkerSubmissionNote("");
    setActionError(null);
    setActionSuccess(null);
    setIsCreateModalOpen(true);
  };

  const openDetail = useCallback((item: ClientFeedbackViewItem) => {
    setActiveDetailItem(item);
    setManagerReplyText("");
    setActionError(null);
    setActionSuccess(null);
    setWorkerSubmissionNote("");

    // Pre-populate worker delegation if associated task has assignees
    const defaultWorker =
      item.taskAssignees && item.taskAssignees.length > 0
        ? item.taskAssignees[0].id
        : workers[0]?.id || "";
    setSelectedWorkerId(item.assignedWorkerId || defaultWorker);
    setDelegationInstructions(item.delegationNote || "");

    // If item was already delegated, default to delegation view or resolve depending on status
    if (item.status === FeedbackStatus.ASSIGNED_TO_WORKER) {
      setManagerActionMode("delegate");
    } else {
      setManagerActionMode("resolve");
    }
  }, [workers]);

  // Handle Create Request submission inside Modal (Client)
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProjectId || (!isReviewRequest && !newTitle.trim()) || !activeDetails.trim()) {
      setCreateError("Please fill out all required fields.");
      return;
    }

    const formData = new FormData();
    formData.append("projectId", activeProjectId);
    if (activeTaskId) formData.append("taskId", activeTaskId);
    formData.append("type", activeType);
    if (isReviewRequest) formData.append("score", String(activeScore));
    else formData.append("title", newTitle.trim());
    formData.append("details", activeDetails.trim());

    if (editingFeedbackId) formData.append("feedbackId", editingFeedbackId);

    startCreateTransition(async () => {
      const result = editingFeedbackId
        ? await updateClientFeedback({}, formData)
        : await createClientFeedback({}, formData);
      if (result.error) {
        setCreateError(result.error);
      } else {
        closeCreateModal();
        resetCreateForm();
      }
    });
  };

  // Handle Direct Manager Resolution
  const handleDirectResolve = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem || !managerReplyText.trim()) {
      setActionError("Resolution note cannot be empty.");
      return;
    }

    const formData = new FormData();
    formData.append("feedbackId", activeDetailItem.id);
    formData.append("responseNote", managerReplyText.trim());

    startActionTransition(async () => {
      const result = await resolveFeedback({}, formData);
      if (result.error) {
        setActionError(result.error);
      } else {
        closeDetail();
      }
    });
  };

  // Handle Delegating Revision to Worker (Manager)
  const handleDelegateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem) return;
    if (!selectedWorkerId) {
      setActionError("Please choose a worker to delegate this revision to.");
      return;
    }
    if (!delegationInstructions.trim()) {
      setActionError("Please add instructions for the worker.");
      return;
    }

    const formData = new FormData();
    formData.append("feedbackId", activeDetailItem.id);
    formData.append("workerId", selectedWorkerId);
    formData.append("delegationNote", delegationInstructions.trim());

    startActionTransition(async () => {
      const result = await delegateFeedbackToWorker({}, formData);
      if (result.error) {
        setActionError(result.error);
      } else {
        closeDetail();
      }
    });
  };

  // Handle Worker Submitting Revision back to Manager
  const handleWorkerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDetailItem || !workerSubmissionNote.trim()) {
      setActionError("Please explain what adjustments were performed.");
      return;
    }

    const formData = new FormData();
    formData.append("feedbackId", activeDetailItem.id);
    formData.append("workerNote", workerSubmissionNote.trim());

    startWorkerTransition(async () => {
      const result = await submitWorkerRevision({}, formData);
      if (result.error) {
        setActionError(result.error);
      } else {
        closeDetail();
      }
    });
  };

  const filteredFeedbacks = feedbacks;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {roleView === "CLIENT"
              ? "Project Feedback & Revisions"
              : roleView === "MANAGER"
              ? "Client Reviews & Studio Triage"
              : "Assigned Revision Requests"}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {roleView === "CLIENT"
              ? "Track active requests, collaborate with your studio team, and review deliverable adjustments."
              : roleView === "MANAGER"
              ? "Review incoming client feedback, resolve directly, or delegate revision work to team members."
              : "Review retouching and revision instructions assigned to you by the studio manager."}
          </p>
        </div>

        {/* Header Actions: Stats + New Request Modal Trigger */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <span className="text-muted-foreground">Open:</span>
              <span className="font-semibold text-primary">{stats.open}</span>
            </div>
            {stats.delegated > 0 && (
              <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
                <span className="text-muted-foreground">With Workers:</span>
                <span className="font-semibold text-amber-500">{stats.delegated}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <span className="text-muted-foreground">Resolved:</span>
              <span className="font-semibold text-foreground">{stats.resolved}</span>
            </div>
            <div className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1">
              <Star className={`size-3 ${stats.avgScore === null ? "text-muted-foreground/50" : "fill-amber-500 text-amber-500"}`} />
              <span className="font-semibold text-foreground">{stats.avgScore ?? "—"}</span>
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
              type="search"
              placeholder="Search by subject, notes, worker, or campaign..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 rounded-full pl-8 pr-3 text-xs"
            />
          </div>

          {projects.length > 1 && (
            <select
              value={filterProject}
              onChange={(e) => updateFilter("project", e.target.value)}
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
                { id: "ALL", label: `All (${stats.total})` },
                { id: "OPEN", label: `Open (${stats.open})` },
                { id: "DELEGATED", label: `With Worker (${stats.delegated})` },
                { id: "RESOLVED", label: `Resolved (${stats.resolved})` },
              ] as const
            ).map((filter) => (
              <button
                key={filter.id}
                onClick={() => updateFilter("status", filter.id)}
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
            onChange={(e) => updateFilter("type", e.target.value)}
            className="h-8 rounded-full border border-border bg-card px-2.5 text-xs font-medium text-foreground"
          >
            <option value="ALL">All Types</option>
            <option value={FeedbackType.REVISION}>Revisions</option>
            <option value={FeedbackType.REVIEW}>Reviews</option>
            <option value={FeedbackType.COMPLAINT}>Issues</option>
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
              {stats.total === 0
                ? "No feedback or revision requests yet"
                : "No requests match the selected filters"}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              {stats.total === 0
                ? roleView === "CLIENT"
                  ? "Submit revision instructions, adjustments, or project milestone feedback to the studio team."
                  : "No client feedback entries have been submitted yet."
                : "Try clearing your search query or selecting a different status filter."}
            </p>
          </div>

          {stats.total === 0 && roleView === "CLIENT" ? (
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
          ) : stats.total > 0 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                const params = new URLSearchParams(currentSearch);
                ["q", "status", "type", "project", "page"].forEach((key) => params.delete(key));
                const query = params.toString();
                router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
              }}
              className="rounded-full text-xs"
            >
              Reset Filters
            </Button>
          ) : null}
        </div>
      ) : viewMode === "cards" ? (
        /* Column Cards View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFeedbacks.map((item) => {
            const isResolved = item.status === FeedbackStatus.RESOLVED;
            const isDelegated = item.type !== FeedbackType.REVIEW && item.status === FeedbackStatus.ASSIGNED_TO_WORKER;
            const isInReview = item.type !== FeedbackType.REVIEW && item.status === FeedbackStatus.IN_REVIEW;

            return (
              <div
                key={item.id}
                onClick={() => openDetail(item)}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openDetail(item);
                  }
                }}
                className="group flex min-w-0 cursor-pointer flex-col justify-between space-y-3 rounded-2xl border bg-card p-4 shadow-xs outline-none transition-[border-color,box-shadow,transform] duration-200 hover:border-primary/30 hover:shadow-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 [@media(hover:hover)]:hover:-translate-y-0.5"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          isResolved
                            ? "default"
                            : isDelegated
                            ? "outline"
                            : isInReview
                            ? "secondary"
                            : "secondary"
                        }
                        className={`rounded-full text-[10px] px-2 py-0 ${
                          isDelegated ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10" : ""
                        }`}
                      >
                        {isDelegated
                          ? "With Worker"
                          : isInReview
                          ? "Review Ready"
                          : item.type === FeedbackType.REVIEW
                          ? "Received"
                          : item.status}
                      </Badge>
                      <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        {item.type}
                      </Badge>
                    </div>

                    {item.type === FeedbackType.REVIEW && (
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: 5 }).map((_, idx) => (
                          <Star
                            key={idx}
                            className={`size-2.5 ${
                              idx < (item.score ?? 0) ? "fill-amber-500 text-amber-500" : "text-muted/40"
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="line-clamp-2 break-words text-sm font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <div className="mt-1.5 grid min-w-0 gap-1 text-xs text-muted-foreground">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <FolderKanban className="size-3.5 shrink-0" />
                        <span className="truncate">{item.projectName}</span>
                      </div>
                      {item.taskTitle && (
                        <div className="grid min-w-0 grid-cols-[5.25rem_minmax(0,1fr)] gap-1.5 pl-5">
                          <span className="text-muted-foreground/80">Deliverable</span>
                          <span className="truncate text-foreground/80">{item.taskTitle}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="line-clamp-3 break-words text-[13px] leading-relaxed text-muted-foreground sm:text-sm">
                    {item.details}
                  </p>
                </div>

                {/* Bottom Row: Studio resolution / Delegation info */}
                <div className="border-t pt-2.5 space-y-2 text-xs">
                  {item.responseNote ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-medium text-foreground">
                        <span className="flex items-center gap-1">
                          <Sparkles className="size-3 text-primary" />
                          <span>{item.respondedByName || "Studio Lead"}</span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">{item.respondedAt}</span>
                      </div>
                      <p className="line-clamp-2 break-words text-muted-foreground">{item.responseNote}</p>
                    </div>
                  ) : item.type !== FeedbackType.REVIEW && item.assignedWorkerName ? (
                    <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-2 text-[11px] space-y-0.5">
                      <div className="flex items-center justify-between font-medium text-foreground">
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Wrench className="size-3" />
                          <span>Delegated to {item.assignedWorkerName}</span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">
                          {isInReview ? "Submitted" : "In Progress"}
                        </span>
                      </div>
                      <p className="line-clamp-2 break-words text-muted-foreground">
                        {item.workerNote || item.delegationNote || "Awaiting adjustments"}
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="size-3 text-primary" />
                        <span>{item.type === FeedbackType.REVIEW ? "Review received" : "In studio triage queue"}</span>
                      </span>
                      <span>{item.createdAt}</span>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-0.5 text-[11px]">
                    <span className="min-w-0 truncate text-muted-foreground">by {item.clientName}</span>
                    <span className="flex shrink-0 items-center gap-0.5 font-medium text-primary group-hover:underline group-focus-visible:underline">
                      <span>
                        {roleView === "MANAGER" && item.type !== FeedbackType.REVIEW && !isResolved
                          ? isDelegated
                            ? "View / Manage"
                            : "Triage / Resolve"
                          : roleView === "WORKER" && isDelegated
                          ? "Submit Revision"
                          : "View Details"}
                      </span>
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
        <div className="max-w-full overflow-hidden rounded-2xl border bg-card shadow-xs">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[120px] text-center text-xs">Status</TableHead>
                <TableHead className="text-xs">Request Subject & Details</TableHead>
                <TableHead className="text-xs">Campaign & Set</TableHead>
                <TableHead className="text-center text-xs">Delegated To</TableHead>
                <TableHead className="text-center text-xs">Type</TableHead>
                <TableHead className="text-center text-xs">Rating</TableHead>
                <TableHead className="text-center text-xs">Logged</TableHead>
                <TableHead className="text-center text-xs">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFeedbacks.map((item) => {
                const isResolved = item.status === FeedbackStatus.RESOLVED;
                const isDelegated = item.type !== FeedbackType.REVIEW && item.status === FeedbackStatus.ASSIGNED_TO_WORKER;
                const isInReview = item.type !== FeedbackType.REVIEW && item.status === FeedbackStatus.IN_REVIEW;

                return (
                  <TableRow
                    key={item.id}
                    onClick={() => openDetail(item)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                  >
                    <TableCell className="align-middle py-3 text-center">
                      <Badge
                        variant={
                          isResolved
                            ? "default"
                            : isDelegated
                            ? "outline"
                            : "secondary"
                        }
                        className={`rounded-full text-[10px] px-2 py-0 ${
                          isDelegated ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10" : ""
                        }`}
                      >
                        {isDelegated
                          ? "With Worker"
                          : isInReview
                          ? "Review Ready"
                          : item.type === FeedbackType.REVIEW
                          ? "Received"
                          : item.status}
                      </Badge>
                    </TableCell>

                    <TableCell className="max-w-sm align-middle py-3">
                      <p className="font-semibold text-xs text-foreground line-clamp-1">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                        {item.details}
                      </p>
                    </TableCell>

                    <TableCell className="max-w-[180px] truncate py-3 text-xs text-muted-foreground align-middle">
                      <p className="font-medium text-foreground truncate">{item.projectName}</p>
                      {item.taskTitle && (
                        <p className="text-[11px] text-muted-foreground truncate">{item.taskTitle}</p>
                      )}
                    </TableCell>

                    <TableCell className="align-middle py-3 text-center text-xs">
                      {item.type !== FeedbackType.REVIEW && item.assignedWorkerName ? (
                        <span className="font-medium text-foreground">{item.assignedWorkerName}</span>
                      ) : (
                        <span className="text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>

                    <TableCell className="align-middle py-3 text-center text-xs">
                      <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                        {item.type}
                      </Badge>
                    </TableCell>

                    <TableCell className="align-middle py-3 text-center text-xs">
                      {item.type === FeedbackType.REVIEW ? (
                        <div className="flex items-center justify-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`size-2.5 ${
                                idx < (item.score ?? 0) ? "fill-amber-500 text-amber-500" : "text-muted/40"
                              }`}
                            />
                          ))}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    <TableCell className="whitespace-nowrap py-3 text-center text-xs text-muted-foreground align-middle">
                      {item.createdAt}
                    </TableCell>

                    <TableCell className="align-middle py-3 text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(item);
                        }}
                        className="h-7 rounded-full text-xs px-2.5 text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {roleView === "MANAGER" && item.type !== FeedbackType.REVIEW && !isResolved
                          ? isDelegated
                            ? "Manage"
                            : "Triage"
                          : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Pagination
        pathname={pathname}
        searchParams={initialData.searchParams}
        page={initialData.page}
        totalPages={initialData.totalPages}
        totalItems={initialData.totalItems}
      />

      {/* ------------------------------------------------------------- */}
      {/* 1. SHORT SHADCN MODAL: CREATE REQUEST FORM (Client)           */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isCreateDialogOpen} onOpenChange={(open) => open ? setIsCreateModalOpen(true) : closeCreateModal()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MessageSquareText className="size-4 text-primary" />
              <span>{editingFeedbackId ? "Edit Feedback" : "New Revision or Feedback Request"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingFeedbackId
                ? "Update your feedback before the studio begins working on it."
                : "Share a project review, request a revision, or report an issue to the studio team."}
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
                  value={activeProjectId}
                  onChange={(e) => {
                    materializeClientReviewDraft();
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
                  value={activeTaskId}
                  onChange={(e) => {
                    materializeClientReviewDraft();
                    setNewTaskId(e.target.value);
                  }}
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
                  {(
                    [
                      { value: FeedbackType.REVISION, label: "Revision" },
                      { value: FeedbackType.REVIEW, label: "Review" },
                      { value: FeedbackType.COMPLAINT, label: "Issue" },
                    ] as const
                  ).map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => {
                        materializeClientReviewDraft();
                        setNewType(t.value);
                        setNewTitle("");
                        setNewScore(5);
                        setCreateError(null);
                      }}
                      aria-pressed={activeType === t.value}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium transition-all ${
                        activeType === t.value
                          ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                          : "border border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {isReviewRequest && (
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Satisfaction Rating</Label>
                  <div className="flex items-center gap-1 text-amber-500">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          materializeClientReviewDraft();
                          setNewScore(s);
                        }}
                        aria-label={`Rate this project ${s} out of 5 stars`}
                        aria-pressed={s === activeScore}
                        className="p-0.5 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`size-3.5 ${
                            s <= activeScore ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-1.5 text-[11px] text-muted-foreground">
                      {activeScore === 5 ? "Exceptional" : `${activeScore} / 5 Stars`}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {!isReviewRequest && (
              <div className="space-y-1">
                <Label htmlFor="m-title" className="text-xs font-medium">
                  {activeType === FeedbackType.COMPLAINT ? "Issue Subject" : "Request Subject"}
                </Label>
                <Input
                  id="m-title"
                  required
                  value={newTitle}
                  onChange={(e) => {
                    materializeClientReviewDraft();
                    setNewTitle(e.target.value);
                  }}
                  placeholder={
                    activeType === FeedbackType.COMPLAINT
                      ? "Briefly describe the issue"
                      : "e.g. Tone down highlight exposure on portrait #04"
                  }
                  className="h-9 rounded-xl text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="m-details" className="text-xs font-medium">
                {isReviewRequest
                  ? "Your Review"
                  : activeType === FeedbackType.COMPLAINT
                  ? "Issue Details"
                  : "Revision Instructions"}
              </Label>
              <Textarea
                id="m-details"
                required
                rows={isReviewRequest ? 4 : 3}
                value={activeDetails}
                onChange={(e) => {
                  materializeClientReviewDraft();
                  setNewDetails(e.target.value);
                }}
                placeholder={
                  isReviewRequest
                    ? "Share your experience with this project..."
                    : activeType === FeedbackType.COMPLAINT
                    ? "Describe what happened and what needs attention..."
                    : "Provide specific details, frame numbers, color codes, or crop requests..."
                }
                className="rounded-xl text-xs"
              />
            </div>

            <DialogFooter className="pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={closeCreateModal}
                className="h-8 rounded-full text-xs"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isCreating}
                className="h-8 rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs hover:bg-primary/90"
              >
                {isCreating
                  ? editingFeedbackId ? "Saving..." : "Submitting..."
                  : editingFeedbackId ? "Save Changes" : "Submit Request to Studio"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------------ */}
      {/* 2. SHADCN MODAL: REVIEW DETAIL, WORKER DELEGATION & STUDIO RESOLVE */}
      {/* ------------------------------------------------------------------ */}
      <Dialog
        open={Boolean(activeDetailItem)}
        onOpenChange={(open) => {
          if (!open) {
            closeDetail();
          }
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
          {activeDetailItem && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-start gap-2 border-b pb-3 pr-8 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-1.5">
                    <Badge
                      variant={
                        activeDetailItem.status === FeedbackStatus.RESOLVED
                          ? "default"
                        : activeDetailItem.type !== FeedbackType.REVIEW && activeDetailItem.status === FeedbackStatus.ASSIGNED_TO_WORKER
                          ? "outline"
                          : "secondary"
                      }
                      className={`rounded-full text-[10px] px-2 py-0 ${
                        activeDetailItem.status === FeedbackStatus.ASSIGNED_TO_WORKER
                          ? "border-amber-500/40 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                          : ""
                      }`}
                    >
                        {activeDetailItem.type === FeedbackType.REVIEW
                          ? "Received"
                          : activeDetailItem.status === FeedbackStatus.ASSIGNED_TO_WORKER
                        ? "With Worker"
                        : activeDetailItem.status === FeedbackStatus.IN_REVIEW
                        ? "Review Ready"
                        : activeDetailItem.status}
                    </Badge>
                    <Badge variant="outline" className="rounded-full text-[10px] px-2 py-0">
                      {activeDetailItem.type}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground sm:justify-end">
                    {activeDetailItem.type === FeedbackType.REVIEW && (
                      <>
                        <div className="flex items-center text-amber-500">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`size-3 ${
                                idx < (activeDetailItem.score ?? 0) ? "fill-amber-500 text-amber-500" : "text-muted/40"
                              }`}
                            />
                          ))}
                        </div>
                        <span>•</span>
                      </>
                    )}
                    <span>{activeDetailItem.createdAt}</span>
                  </div>
                </div>

                <DialogTitle className="break-words pt-1 text-base font-bold text-foreground">
                  {activeDetailItem.title}
                </DialogTitle>
                <DialogDescription className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2 sm:gap-x-5 sm:gap-y-2">
                  <span className="min-w-0 break-words">
                    Campaign <strong className="text-foreground">{activeDetailItem.projectName}</strong>
                  </span>
                  {activeDetailItem.taskTitle && (
                    <span className="min-w-0 break-words">
                      Deliverable <strong className="text-foreground">{activeDetailItem.taskTitle}</strong>
                    </span>
                  )}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Feedback Alerts */}
                {actionError && (
                  <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{actionError}</span>
                  </div>
                )}
                {actionSuccess && (
                  <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>{actionSuccess}</span>
                  </div>
                )}

                {/* Client request narrative */}
                <div className="space-y-2 rounded-xl border bg-muted/20 p-3.5">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar size="sm" className="ring-1 ring-border">
                      <AvatarImage
                        src={getProfileImageSrc(activeDetailItem.clientImage, activeDetailItem.projectId) ?? undefined}
                      />
                      <AvatarFallback className="text-[10px] font-bold">
                        {activeDetailItem.clientName.split(" ").map(n => n[0]).join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{activeDetailItem.clientName}</p>
                      <p className="break-all text-[10px] text-muted-foreground">{activeDetailItem.clientEmail}</p>
                    </div>
                  </div>

                  <p className="whitespace-pre-wrap break-words pl-0.5 leading-relaxed text-foreground">
                    {activeDetailItem.details}
                  </p>
                </div>

                {/* Worker Delegation Status Banner (if assigned) */}
                {activeDetailItem.type !== FeedbackType.REVIEW && activeDetailItem.assignedWorkerName && (
                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                        <Wrench className="size-3.5" />
                        <span>Assigned Retoucher: {activeDetailItem.assignedWorkerName}</span>
                      </span>
                      {activeDetailItem.delegatedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          Delegated {activeDetailItem.delegatedAt}
                        </span>
                      )}
                    </div>

                    {activeDetailItem.delegationNote && (
                      <div className="text-[11px] text-foreground/90 bg-card/60 rounded-lg p-2 border border-border/50">
                        <strong className="text-muted-foreground block text-[10px] uppercase font-semibold">
                          Manager Delegation Instructions:
                        </strong>
                        <p className="mt-0.5">{activeDetailItem.delegationNote}</p>
                      </div>
                    )}

                    {activeDetailItem.workerNote && (
                      <div className="text-[11px] text-foreground bg-primary/5 rounded-lg p-2 border border-primary/20 space-y-0.5">
                        <div className="flex items-center justify-between font-medium text-primary text-[10px] uppercase">
                          <span>Worker Submission Update:</span>
                          <span className="text-muted-foreground normal-case font-normal">
                            {activeDetailItem.workerSubmittedAt}
                          </span>
                        </div>
                        <p className="text-foreground">{activeDetailItem.workerNote}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Final Studio Resolution (if already resolved) */}
                {activeDetailItem.responseNote && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-primary/10 pb-1.5">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3.5 text-primary" />
                        <span>Final Studio Resolution</span>
                      </span>
                      {activeDetailItem.respondedAt && (
                        <span className="text-[10px] text-muted-foreground">
                          {activeDetailItem.respondedAt}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">
                      {activeDetailItem.responseNote}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Resolved by <strong>{activeDetailItem.respondedByName || "Studio Lead"}</strong>
                    </p>
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* MANAGER ACTION PANEL: Choose between Direct Resolution or Delegation */}
                {/* ------------------------------------------------------------- */}
                {roleView === "MANAGER" && activeDetailItem.type !== FeedbackType.REVIEW && activeDetailItem.status !== FeedbackStatus.RESOLVED && (
                  <div className="rounded-xl border bg-card p-3.5 space-y-3">
                    <div className="flex flex-col gap-2 border-b pb-2 sm:flex-row sm:items-center sm:justify-between">
                      <span className="font-semibold text-xs text-foreground">Studio Action</span>

                      {/* Segmented Mode Selector */}
                      <div className="grid w-full grid-cols-2 gap-1 rounded-xl border bg-muted/40 p-1 text-xs sm:w-auto sm:rounded-full">
                        <button
                          type="button"
                          onClick={() => setManagerActionMode("resolve")}
                          className={`flex min-h-9 items-center justify-center rounded-lg px-2 py-1 text-center text-[11px] font-medium leading-tight transition-all sm:rounded-full ${
                            managerActionMode === "resolve"
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Resolve Directly
                        </button>
                        <button
                          type="button"
                          onClick={() => setManagerActionMode("delegate")}
                          className={`flex min-h-9 items-center justify-center rounded-lg px-2 py-1 text-center text-[11px] font-medium leading-tight transition-all sm:rounded-full ${
                            managerActionMode === "delegate"
                              ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          Delegate to Worker
                        </button>
                      </div>
                    </div>

                    {managerActionMode === "resolve" ? (
                      /* Mode A: Direct Studio Resolution */
                      <form onSubmit={handleDirectResolve} className="space-y-2.5">
                        <p className="text-[11px] text-muted-foreground">
                          Use this for administrative resolutions, minor clarifications, or when worker retouching is not required.
                        </p>
                        <Textarea
                          rows={3}
                          required
                          placeholder="State resolution note for the client (e.g. adjustments confirmed, download link updated)..."
                          value={managerReplyText}
                          onChange={(e) => setManagerReplyText(e.target.value)}
                          className="text-xs rounded-xl"
                        />
                        <div className="flex justify-end gap-2 pt-1">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isActionPending}
                            className="h-8 rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs hover:bg-primary/90"
                          >
                            {isActionPending ? "Resolving..." : "Approve & Resolve for Client"}
                          </Button>
                        </div>
                      </form>
                    ) : (
                      /* Mode B: Delegate / Return to Worker */
                      <form onSubmit={handleDelegateSubmit} className="space-y-3">
                        <p className="text-[11px] text-muted-foreground">
                          Assign this revision to a retoucher or photographer. The task will update in their work queue.
                        </p>

                        {/* Who originally worked on this task */}
                        {activeDetailItem.taskAssignees && activeDetailItem.taskAssignees.length > 0 && (
                          <div className="flex flex-col items-start gap-2 rounded-lg bg-muted/40 p-2 text-[11px] sm:flex-row sm:items-center sm:justify-between">
                            <span className="min-w-0 break-words text-muted-foreground">
                              Original Deliverable Retoucher:{" "}
                              <strong className="text-foreground">
                                {activeDetailItem.taskAssignees.map((a) => a.name || "Team member").join(", ")}
                              </strong>
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (activeDetailItem.taskAssignees?.[0]?.id) {
                                  setSelectedWorkerId(activeDetailItem.taskAssignees[0].id);
                                }
                              }}
                              className="text-primary hover:underline font-medium text-[10px]"
                            >
                              Select Original Retoucher
                            </button>
                          </div>
                        )}

                        <div className="space-y-1">
                          <Label htmlFor="del-worker" className="text-xs font-medium">Assign To Worker</Label>
                          <select
                            id="del-worker"
                            value={selectedWorkerId}
                            onChange={(e) => setSelectedWorkerId(e.target.value)}
                            className="w-full h-9 rounded-xl border border-border bg-card px-3 text-xs font-medium text-foreground"
                          >
                            <option value="">Choose a team member</option>
                            {workers.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name || "Team member"}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <Label htmlFor="del-notes" className="text-xs font-medium">Manager Instructions for Worker</Label>
                          <Textarea
                            id="del-notes"
                            rows={3}
                            required
                            placeholder="Specify what edits/retouches the worker should perform based on client's review..."
                            value={delegationInstructions}
                            onChange={(e) => setDelegationInstructions(e.target.value)}
                            className="text-xs rounded-xl"
                          />
                        </div>

                        <div className="flex justify-stretch gap-2 pt-1 sm:justify-end">
                          <Button
                            type="submit"
                            size="sm"
                            disabled={isActionPending}
                            className="h-9 w-full rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs hover:bg-primary/90 sm:w-auto"
                          >
                            {isActionPending ? "Delegating..." : "Delegate Revision to Worker"}
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* ------------------------------------------------------------- */}
                {/* WORKER ACTION PANEL: Submit Completed Revision to Manager    */}
                {/* ------------------------------------------------------------- */}
                {roleView === "WORKER" && activeDetailItem.type !== FeedbackType.REVIEW && activeDetailItem.status === FeedbackStatus.ASSIGNED_TO_WORKER && (
                  <div className="rounded-xl border bg-card p-3.5 space-y-3">
                    <div className="border-b pb-1.5">
                      <span className="font-semibold text-xs text-foreground">Submit Revision to Studio Manager</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Once you finish retouching or adjustments, record your notes and submit for manager review.
                      </p>
                    </div>

                    <form onSubmit={handleWorkerSubmit} className="space-y-2.5">
                      <Textarea
                        rows={3}
                        required
                        placeholder="Explain adjustments made (e.g. exposure reduced by 0.5 EV on frames 014-022, exported 8K TIFFs)..."
                        value={workerSubmissionNote}
                        onChange={(e) => setWorkerSubmissionNote(e.target.value)}
                        className="text-xs rounded-xl"
                      />
                      <div className="flex justify-end gap-2 pt-1">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={isWorkerSubmitting}
                          className="h-8 rounded-full bg-primary font-medium text-xs text-primary-foreground shadow-xs hover:bg-primary/90"
                        >
                          {isWorkerSubmitting ? "Submitting..." : "Submit Revision for Manager Review"}
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>

              <DialogFooter>
                {roleView === "CLIENT" &&
                  activeDetailItem.status === FeedbackStatus.NEW && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEditFeedback(activeDetailItem)}
                      className="gap-1.5 rounded-full text-xs h-8"
                    >
                      <Pencil className="size-3.5" />
                      Edit Feedback
                    </Button>
                  )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={closeDetail}
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
