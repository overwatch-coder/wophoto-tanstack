"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import {
  Briefcase,
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  FolderKanban,
  FolderPlus,
  Layers,
  Plus,
  Search,
  Sparkles,
  User,
  X,
} from "lucide-react";
import { createProject, type ProjectActionState } from "@/app/actions/projects";
import { cleanClientName } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export type ClientOption = { id: string; name: string | null; email?: string | null };

export type ProjectTask = {
  id: string;
  status: "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  dueAt: Date | string | null;
};

export type ProjectItem = {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
  client: {
    id: string;
    name: string | null;
    email?: string | null;
  };
  tasks?: ProjectTask[];
};

function getClientAvatarColor(name: string): string {
  const colors = [
    "bg-orange-600 text-white",
    "bg-blue-600 text-white",
    "bg-purple-600 text-white",
    "bg-emerald-600 text-white",
    "bg-rose-600 text-white",
    "bg-amber-600 text-white",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function computeProjectStatus(tasks: ProjectTask[] = []): "PLANNING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED" {
  if (tasks.length === 0) return "PLANNING";
  const completed = tasks.filter((t) => t.status === "COMPLETED").length;
  if (completed === tasks.length) return "COMPLETED";
  const inReview = tasks.filter((t) => t.status === "IN_REVIEW").length;
  if (inReview > 0) return "IN_REVIEW";
  const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
  if (inProgress > 0) return "IN_PROGRESS";
  return "IN_PROGRESS";
}

function formatDate(dateValue: Date | string | null | undefined): string {
  if (!dateValue) return "No date set";
  const date = typeof dateValue === "string" ? new Date(dateValue) : dateValue;
  if (Number.isNaN(date.getTime())) return "No date set";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ViewProjectDialog({
  project,
  status,
  completedTasks,
  totalTasks,
  percentComplete,
}: {
  project: ProjectItem;
  status: "PLANNING" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";
  completedTasks: number;
  totalTasks: number;
  percentComplete: number;
}) {
  const [open, setOpen] = useState(false);
  const clientDisplayName = cleanClientName(project.client.name) || "Unnamed client";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2.5 text-xs text-foreground hover:bg-muted"
          >
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">Project Details</span>
            <span className="text-muted-foreground/30">•</span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                status === "COMPLETED"
                  ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                  : status === "IN_REVIEW"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : status === "IN_PROGRESS"
                  ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                  : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
              }`}
            >
              {status.replace("_", " ")}
            </span>
          </div>
          <DialogTitle className="mt-1 text-xl font-semibold leading-snug text-foreground">
            {project.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Client & Date Card */}
          <div className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs">
            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <User className="size-3" />
                <span>Client</span>
              </span>
              <p className="mt-0.5 font-semibold text-foreground">{clientDisplayName}</p>
              {project.client.email && (
                <p className="text-[10px] text-muted-foreground">{project.client.email}</p>
              )}
            </div>

            <div>
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                <Calendar className="size-3" />
                <span>Last Updated</span>
              </span>
              <p className="mt-0.5 font-medium text-foreground">
                {formatDate(project.updatedAt)}
              </p>
            </div>
          </div>

          {/* Progress Section */}
          <div className="space-y-2.5 rounded-lg border border-border bg-card/60 p-3.5 text-xs shadow-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
                <Layers className="size-3.5 text-orange-500" />
                <span>Task Progress</span>
              </span>
              <span className="font-semibold text-foreground">
                {completedTasks} / {totalTasks} tasks ({percentComplete}%)
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted border border-border/60">
              <div
                className="h-full rounded-full bg-orange-600 transition-all duration-300"
                style={{ width: `${percentComplete}%` }}
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Description
            </h4>
            {project.description ? (
              <div className="whitespace-pre-wrap rounded-md border border-border bg-background p-3 text-xs leading-relaxed text-foreground">
                {project.description}
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                No description provided for this project.
              </p>
            )}
          </div>
        </div>

        <DialogFooter className="-mx-4 -mb-4 mt-4 border-t border-border bg-muted/40 px-4 py-3">
          <DialogClose render={<Button variant="outline" className="h-8 text-xs">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectDialog({
  clients,
}: {
  clients: ClientOption[];
}) {
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, setState] = useState<ProjectActionState>({});
  const [pending, startTransition] = useTransition();

  const clientItems = useMemo(
    () =>
      clients.map((client) => ({
        value: client.id,
        label: cleanClientName(client.name) || "Unnamed client",
      })),
    [clients]
  );

  const handleSubmit = (formData: FormData) => {
    setState({});
    startTransition(async () => {
      const res = await createProject({}, formData);
      setState(res);
      if (res.success) {
        formRef.current?.reset();
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button className="h-9 gap-2 rounded-lg bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-orange-700">
            <Plus className="size-4" />
            <span>Add Project</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-10">
          <div className="flex items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg bg-orange-600/15 text-orange-600 dark:text-orange-400">
              <FolderPlus className="size-4" />
            </span>
            <div>
              <DialogTitle className="text-base font-semibold text-foreground">
                Create New Project
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Set up a new production project and assign it to an active client.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {clients.length === 0 ? (
          <div className="my-2 rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">
            No eligible clients found. Go to <strong>Team Invitations</strong> to invite a client
            and ensure they have accepted before creating a project.
          </div>
        ) : (
          <form ref={formRef} action={handleSubmit} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="create-project-name" className="text-xs font-medium text-foreground">
                Project Name <span className="text-rose-500">*</span>
              </Label>
              <Input
                id="create-project-name"
                name="name"
                required
                maxLength={120}
                placeholder="e.g. North Coast Campaign"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-project-client" className="text-xs font-medium text-foreground">
                Client <span className="text-rose-500">*</span>
              </Label>
              <Select name="clientId" required items={clientItems}>
                <SelectTrigger id="create-project-client" className="h-9 w-full text-xs">
                  <SelectValue placeholder="Choose an active client" />
                </SelectTrigger>
                <SelectContent>
                  {clientItems.map((client) => (
                    <SelectItem key={client.value} value={client.value} className="text-xs">
                      {client.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="create-project-desc" className="text-xs font-medium text-foreground">
                Description <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="create-project-desc"
                name="description"
                maxLength={5000}
                rows={4}
                placeholder="Add deliverables, shoot notes, and scope details..."
                className="text-xs leading-relaxed"
              />
            </div>

            {state.error ? (
              <p role="alert" className="text-xs font-medium text-destructive">
                {state.error}
              </p>
            ) : null}

            <DialogFooter className="-mx-4 -mb-4 mt-5 border-t border-border bg-muted/30 px-4 py-3">
              <DialogClose
                render={
                  <Button type="button" variant="outline" className="h-8 px-3 text-xs">
                    Cancel
                  </Button>
                }
              />
              <Button
                type="submit"
                disabled={pending}
                className="h-8 gap-1.5 bg-orange-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-orange-700"
              >
                <Sparkles className="size-3.5" />
                <span>{pending ? "Creating project…" : "Create Project"}</span>
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function ProjectManagement({
  projects,
  clients,
}: {
  projects: ProjectItem[];
  clients: ClientOption[];
}) {
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Calculate project metrics and status
  const projectsWithMeta = useMemo(() => {
    return projects.map((p) => {
      const tasks = p.tasks ?? [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === "COMPLETED").length;
      const percentComplete =
        totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
      const status = computeProjectStatus(tasks);

      // Latest target date
      const taskDueDates = tasks
        .map((t) => (t.dueAt ? new Date(t.dueAt).getTime() : 0))
        .filter((d) => d > 0);
      const latestDueTimestamp =
        taskDueDates.length > 0 ? Math.max(...taskDueDates) : null;
      const targetDateStr = latestDueTimestamp
        ? formatDate(new Date(latestDueTimestamp))
        : formatDate(p.updatedAt);

      return {
        ...p,
        status,
        totalTasks,
        completedTasks,
        percentComplete,
        targetDateStr,
      };
    });
  }, [projects]);

  // Overall KPI metrics
  const activeCount = projectsWithMeta.filter((p) => p.status === "IN_PROGRESS").length;
  const inReviewCount = projectsWithMeta.filter((p) => p.status === "IN_REVIEW").length;
  const completedCount = projectsWithMeta.filter((p) => p.status === "COMPLETED").length;
  const totalTasksCount = projectsWithMeta.reduce((acc, p) => acc + p.totalTasks, 0);
  const totalCompletedTasks = projectsWithMeta.reduce(
    (acc, p) => acc + p.completedTasks,
    0
  );

  // Filtered projects
  const filteredProjects = useMemo(() => {
    return projectsWithMeta.filter((p) => {
      const clientName = cleanClientName(p.client.name) || "";
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.description && p.description.toLowerCase().includes(search.toLowerCase())) ||
        clientName.toLowerCase().includes(search.toLowerCase());

      const matchesClient =
        clientFilter === "ALL" || p.client.id === clientFilter;

      const matchesStatus =
        statusFilter === "ALL" || p.status === statusFilter;

      return matchesSearch && matchesClient && matchesStatus;
    });
  }, [projectsWithMeta, search, clientFilter, statusFilter]);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-xs text-muted-foreground">
            Manage productions, track task progress, and collaborate with assigned clients.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <CreateProjectDialog clients={clients} />
        </div>
      </div>

      {/* KPI Cards Row (Version B) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {/* Metric 1: In Production */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">In Production</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-orange-600/10 text-orange-600 dark:text-orange-400">
              <Briefcase className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {activeCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Active projects
            </span>
          </div>
        </div>

        {/* Metric 2: Awaiting Review */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Awaiting Review</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Clock className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {inReviewCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              With clients
            </span>
          </div>
        </div>

        {/* Metric 3: Task Velocity */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Task Velocity</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Layers className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {totalCompletedTasks}/{totalTasksCount}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              Tasks logged
            </span>
          </div>
        </div>

        {/* Metric 4: Completed */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-xs">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-medium">Completed</span>
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {completedCount}
            </span>
            <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              Delivered
            </span>
          </div>
        </div>
      </div>

      {/* Control Filters Bar */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs lg:flex-row lg:items-center lg:justify-between">
        <div className="relative flex-1 lg:max-w-xs">
          <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects or clients..."
            className="h-8.5 pl-8 pr-8 text-xs bg-background"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Client Filter */}
          <select
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Clients ({clients.length})</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {cleanClientName(c.name) || "Unnamed client"}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs text-foreground outline-none focus:border-orange-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="IN_REVIEW">In Review</option>
            <option value="COMPLETED">Completed</option>
            <option value="PLANNING">Planning</option>
          </select>
        </div>
      </div>

      {/* Projects Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {filteredProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <FolderKanban className="size-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-semibold text-foreground">
              {projects.length === 0 ? "No projects created yet" : "No projects found"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-xs">
              {projects.length === 0
                ? "Click the button below to set up your first production project."
                : "No projects match your current search or filter criteria. Try resetting filters."}
            </p>
            {projects.length === 0 ? (
              <div className="mt-4">
                <CreateProjectDialog clients={clients} />
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearch("");
                  setClientFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="mt-4 text-xs"
              >
                Reset Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border bg-muted/40 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-5 py-3">Project Title</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Progress</th>
                  <th className="px-4 py-3">Target Date / Updated</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredProjects.map((p) => {
                  const clientDisplayName =
                    cleanClientName(p.client.name) || "Unnamed client";
                  const avatarColor = getClientAvatarColor(clientDisplayName);

                  return (
                    <tr key={p.id} className="transition-colors hover:bg-muted/30">
                      {/* Project Title */}
                      <td className="px-5 py-3.5">
                        <div className="space-y-0.5">
                          <span className="font-semibold text-foreground text-sm hover:text-orange-600 dark:hover:text-orange-400 cursor-pointer">
                            {p.name}
                          </span>
                          {p.description ? (
                            <p className="line-clamp-1 max-w-sm text-xs text-muted-foreground">
                              {p.description}
                            </p>
                          ) : (
                            <p className="text-[11px] italic text-muted-foreground/70">
                              No description
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Client with Avatar */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${avatarColor}`}
                          >
                            {clientDisplayName.charAt(0).toUpperCase()}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-foreground">
                              {clientDisplayName}
                            </p>
                            {p.client.email && (
                              <p className="text-[10px] text-muted-foreground">
                                {p.client.email}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            p.status === "COMPLETED"
                              ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                              : p.status === "IN_REVIEW"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : p.status === "IN_PROGRESS"
                              ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                              : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              p.status === "COMPLETED"
                                ? "bg-emerald-500"
                                : p.status === "IN_REVIEW"
                                ? "bg-amber-500"
                                : p.status === "IN_PROGRESS"
                                ? "bg-sky-500"
                                : "bg-slate-400"
                            }`}
                          />
                          {p.status === "IN_PROGRESS"
                            ? "In Progress"
                            : p.status === "IN_REVIEW"
                            ? "In Review"
                            : p.status === "COMPLETED"
                            ? "Completed"
                            : "Planning"}
                        </span>
                      </td>

                      {/* Progress Bar */}
                      <td className="px-4 py-3.5">
                        <div className="w-28 space-y-1">
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span>
                              {p.completedTasks}/{p.totalTasks} tasks
                            </span>
                            <span className="font-semibold text-foreground">
                              {p.percentComplete}%
                            </span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full bg-orange-600 transition-all duration-300"
                              style={{ width: `${p.percentComplete}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* Target Date / Updated */}
                      <td className="px-4 py-3.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="size-3.5 text-muted-foreground/70" />
                          <span>{p.targetDateStr}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right">
                        <ViewProjectDialog
                          project={p}
                          status={p.status}
                          completedTasks={p.completedTasks}
                          totalTasks={p.totalTasks}
                          percentComplete={p.percentComplete}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Table Footer */}
        <div className="flex items-center justify-between border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground">
          <span>
            Showing <strong className="text-foreground">{filteredProjects.length}</strong> of{" "}
            {projects.length} projects
          </span>
          <span className="text-[11px]">Sorted by most recently updated</span>
        </div>
      </div>
    </div>
  );
}
