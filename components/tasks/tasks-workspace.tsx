"use client";

import { useEffect, useState, useTransition } from "react";
import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { CalendarDays, Check, Eye, GripVertical, Plus, Trash2 } from "lucide-react";
import { Specialization, TaskPriority, TaskStatus, TaskType } from "@/generated/prisma/browser";
import { createAssignedTask, createDailyEntry, filterTasks, loadMoreTasks, reviewTask, softDeleteTask, updateAssignedTask, updateDailyEntry, updateAssignmentStatus, type TaskActionState } from "@/app/actions/tasks";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

type TasksResult = Awaited<ReturnType<typeof loadMoreTasks>>;
type TaskItem = TasksResult["tasks"][number];
type Options = {
  projects: { id: string; name: string; clientId?: string; clientName?: string | null }[];
  clients: { id: string; name: string }[];
  workers: { id: string; name: string | null; email: string }[];
};
const initial: TaskActionState = {};
const labels: Record<TaskStatus, string> = { TODO: "To do", IN_PROGRESS: "In progress", IN_REVIEW: "In review", COMPLETED: "Completed" };
const dateText = (date: Date | string | null) => date ? new Date(date).toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }) : "No date";

const statusFilterItems = [
  { value: "ALL", label: "All statuses" },
  ...Object.values(TaskStatus).map((state) => ({ value: state, label: labels[state] })),
];

const priorityFilterItems = [
  { value: "ALL", label: "All priorities" },
  ...Object.values(TaskPriority).map((value) => ({
    value,
    label: value.charAt(0) + value.slice(1).toLowerCase(),
  })),
];

const prioritySelectItems = Object.values(TaskPriority).map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
}));

export function TasksWorkspace({ role, initialData, options }: { role: "MANAGER" | "WORKER"; initialData: TasksResult; options: Options }) {
  const [data, setData] = useState<TasksResult>(initialData);
  const [prevInitialData, setPrevInitialData] = useState<TasksResult>(initialData);
  if (initialData !== prevInitialData) {
    setPrevInitialData(initialData);
    setData(initialData);
  }
  const [status, setStatus] = useState("ALL");
  const [priority, setPriority] = useState("ALL");
  const [view, setView] = useState("table");
  const [loading, startLoading] = useTransition();
  const visible = data.tasks.filter((task) => (status === "ALL" || (role === "WORKER" ? task.myStatus : task.status) === status) && (priority === "ALL" || task.priority === priority));
  function applyFilters(nextStatus: string, nextPriority: string) {
    setStatus(nextStatus); setPriority(nextPriority);
    startLoading(async () => setData(await filterTasks(nextStatus === "ALL" ? undefined : nextStatus, nextPriority === "ALL" ? undefined : nextPriority)));
  }
  function loadMore() {
    if (!data.nextCursor) return;
    startLoading(async () => { const next = await loadMoreTasks(data.nextCursor!, status === "ALL" ? undefined : status, priority === "ALL" ? undefined : priority); setData((current) => ({ ...current, tasks: [...current.tasks, ...next.tasks], nextCursor: next.nextCursor })); });
  }
  return <main className="mx-auto w-full max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
    <header className="flex flex-wrap items-end justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight">{role === "MANAGER" ? "Team Workboard" : "Workboard"}</h1><p className="mt-2 text-sm text-muted-foreground">Assigned work and daily entries in one view.</p></div><CreateTaskDialog role={role} options={options} /></header>
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{([TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.COMPLETED] as const).map((state) => <button key={state} type="button" onClick={() => applyFilters(status === state ? "ALL" : state, priority)} className={`rounded-md border bg-card px-4 py-3 text-left ${status === state ? "border-primary" : ""}`}><span className="block text-xs text-muted-foreground">{labels[state]}</span><span className="mt-1 block text-xl font-semibold">{data.counts[state] ?? 0}</span></button>)}</div>
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(value) => applyFilters(value ?? "ALL", priority)} items={statusFilterItems}>
          <SelectTrigger id="task-status-filter" aria-label="Filter by status" className="h-10 w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            {statusFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priority} onValueChange={(value) => applyFilters(status, value ?? "ALL")} items={priorityFilterItems}>
          <SelectTrigger id="task-priority-filter" aria-label="Filter by priority" className="h-10 w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            {priorityFilterItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Tabs value={view} onValueChange={(value) => setView(value ?? "table")}>
        <TabsList><TabsTrigger value="table">Table</TabsTrigger><TabsTrigger value="board">Board</TabsTrigger><TabsTrigger value="daybook">Daybook</TabsTrigger></TabsList>
      </Tabs>
    </div>
    <Tabs value={view} onValueChange={(v) => setView(v ?? "table")}><TabsContent value="table"><TaskTable tasks={visible} role={role} options={options} /></TabsContent><TabsContent value="board"><TaskBoard tasks={visible} role={role} options={options} /></TabsContent><TabsContent value="daybook"><Daybook tasks={visible} role={role} options={options} /></TabsContent></Tabs>
    {data.nextCursor ? <div className="flex justify-center"><Button variant="outline" disabled={loading} onClick={loadMore}>{loading ? "Loading…" : "Load more"}</Button></div> : null}<ReviewDialog tasks={visible} />
  </main>;
}

function CreateTaskDialog({ role, options }: { role: "MANAGER" | "WORKER"; options: Options }) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const action = role === "MANAGER" ? createAssignedTask : createDailyEntry;
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>("");

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setSelectedClientId("");
      setSelectedProjectId("");
      setError("");
      setFormKey((k) => k + 1);
    }
  };

  const handleClientChange = (clientId: string) => {
    setSelectedClientId(clientId);
    const clientProjects = options.projects.filter((p) => p.clientId === clientId);
    if (clientProjects.length === 1) {
      setSelectedProjectId(clientProjects[0].id);
    } else {
      setSelectedProjectId("");
    }
  };

  const clientItems = options.clients.map((client) => ({
    value: client.id,
    label: client.name,
  }));

  const filteredProjects = role === "MANAGER"
    ? options.projects.filter((p) => !selectedClientId || p.clientId === selectedClientId)
    : options.projects;

  const projectItems = filteredProjects.map((project) => ({
    value: project.id,
    label: project.name,
  }));

  const handleSubmit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      const res = await action(initial, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
        setSelectedClientId("");
        setSelectedProjectId("");
        setError("");
        setFormKey((k) => k + 1);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button><Plus className="size-4" />{role === "MANAGER" ? "Assign task" : "Log daily work"}</Button>} />
      <DialogContent className="max-h-[90svh] grid-rows-[auto_minmax(0,1fr)] overflow-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{role === "MANAGER" ? "Assign a task" : "Log daily work"}</DialogTitle>
        </DialogHeader>
        <form key={formKey} action={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <div className="min-h-0 space-y-5 overflow-y-auto px-0.5 pb-1">
            {role === "MANAGER" ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="new-task-client">Client</Label>
                  <Select
                    value={selectedClientId}
                    onValueChange={(val) => handleClientChange(val ?? "")}
                    items={clientItems}
                  >
                    <SelectTrigger id="new-task-client" className="h-10 w-full">
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientItems.map((client) => (
                        <SelectItem key={client.value} value={client.value}>
                          {client.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-task-project">Project</Label>
                  <Select
                    name="projectId"
                    required
                    value={selectedProjectId}
                    onValueChange={(val) => setSelectedProjectId(val ?? "")}
                    disabled={!selectedClientId}
                    items={projectItems}
                  >
                    <SelectTrigger id="new-task-project" className="h-10 w-full">
                      <SelectValue
                        placeholder={
                          !selectedClientId
                            ? "Choose client first"
                            : projectItems.length === 0
                              ? "No projects found"
                              : "Choose a project"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {projectItems.map((project) => (
                        <SelectItem key={project.value} value={project.value}>
                          {project.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="new-task-project">Project</Label>
                <Select name="projectId" required items={projectItems}>
                  <SelectTrigger id="new-task-project" className="h-10 w-full">
                    <SelectValue placeholder="Choose a project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectItems.map((project) => (
                      <SelectItem key={project.value} value={project.value}>
                        {project.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-task-title">Title</Label>
              <Input id="new-task-title" name="title" required maxLength={160} placeholder="What needs to get done?" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="new-task-description" name="description" maxLength={5000} rows={3} placeholder="Add details or instructions" className="min-h-24 resize-y" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-task-priority">Priority</Label>
              <Select name="priority" defaultValue="MEDIUM" items={prioritySelectItems}>
                <SelectTrigger id="new-task-priority" className="h-10 w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {prioritySelectItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>{item.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {role === "MANAGER" ? (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2"><Label htmlFor="new-task-start">Start date <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="new-task-start" name="startAt" type="date" className="h-10" /></div>
                  <div className="space-y-2"><Label htmlFor="new-task-due">Due date <span className="font-normal text-muted-foreground">(optional)</span></Label><Input id="new-task-due" name="dueAt" type="date" className="h-10" /></div>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Assign workers</legend>
                  <div className="max-h-36 divide-y overflow-y-auto rounded-md border">
                    {options.workers.length ? options.workers.map((worker) => (
                      <label key={worker.id} className="flex min-h-11 cursor-pointer items-center gap-3 px-3 text-sm hover:bg-muted/50">
                        <input type="checkbox" name="workerId" value={worker.id} className="size-4 accent-primary" />
                        <span className="min-w-0 flex-1 truncate">{worker.name || worker.email}</span>
                      </label>
                    )) : <p className="px-3 py-4 text-sm text-muted-foreground">No active workers available.</p>}
                  </div>
                </fieldset>
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Specializations <span className="font-normal text-muted-foreground">(optional)</span></legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {Object.values(Specialization).map((specialization) => (
                      <label key={specialization} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                        <input type="checkbox" name="specialization" value={specialization} className="size-4 accent-primary" />
                        <span>{specialization.replaceAll("_", " ").toLowerCase()}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </>
            ) : (
              <div className="space-y-2"><Label htmlFor="new-task-work-date">Work date</Label><Input id="new-task-work-date" name="workDate" type="date" max={new Date().toISOString().slice(0, 10)} className="h-10" /></div>
            )}
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          </div>
          <DialogFooter className="-mx-4 -mb-4 border-t bg-muted/40 px-4 py-3 sm:flex-row">
            <DialogClose render={<Button type="button" variant="outline" disabled={pending}>Cancel</Button>} />
            <Button type="submit" disabled={pending}>{pending ? "Saving…" : role === "MANAGER" ? "Assign task" : "Save entry"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ViewTaskDialog({ task }: { task: TaskItem }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="h-8 gap-1.5 px-2.5">
            <Eye className="size-3.5" />
            <span>View</span>
          </Button>
        }
      />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="pr-10">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {task.type === TaskType.DAILY_ENTRY ? "Daily entry" : "Assigned task"}
            </span>
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
              {labels[task.status]}
            </span>
            <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground">
              {task.priority.toLowerCase()} priority
            </span>
          </div>
          <DialogTitle className="mt-2 text-xl font-semibold leading-snug">
            {task.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Project</span>
                <p className="font-medium text-foreground">{task.project.name}</p>
              </div>
              {task.project.client?.name ? (
                <div>
                  <span className="text-xs text-muted-foreground">Client</span>
                  <p className="font-medium text-foreground">{task.project.client.name}</p>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Description</h4>
            {task.description ? (
              <div className="rounded-md border bg-background p-3 text-sm whitespace-pre-wrap leading-relaxed text-foreground">
                {task.description}
              </div>
            ) : (
              <p className="text-sm italic text-muted-foreground">No description provided.</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            {task.type === TaskType.DAILY_ENTRY ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Work Date</span>
                <p className="font-medium">{dateText(task.workDate)}</p>
              </div>
            ) : (
              <>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Start Date</span>
                  <p className="font-medium">{dateText(task.startAt)}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-xs text-muted-foreground">Due Date</span>
                  <p className="font-medium">{dateText(task.dueAt)}</p>
                </div>
              </>
            )}
          </div>

          {task.assignees.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Assignees</h4>
              <div className="divide-y divide-border rounded-md border border-border bg-background">
                {task.assignees.map((a) => {
                  const displayName = a.user.name || a.user.email || "Unknown";
                  const initial = displayName.charAt(0).toUpperCase();
                  const colorClass = getAssigneeColor(displayName);

                  return (
                    <div key={a.userId} className="flex items-center justify-between p-2.5 text-sm">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${colorClass}`}
                        >
                          {a.user.image ? (
                            <img
                              src={a.user.image}
                              alt={displayName}
                              className="size-full rounded-full object-cover"
                            />
                          ) : (
                            initial
                          )}
                        </span>
                        <div>
                          <p className="font-medium text-foreground">{displayName}</p>
                          {a.managerNote ? (
                            <p className="text-xs text-destructive">Manager note: {a.managerNote}</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}

          {task.specializations && task.specializations.length > 0 ? (
            <div className="space-y-1.5">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Specializations</h4>
              <div className="flex flex-wrap gap-1.5">
                {task.specializations.map((item) => (
                  <span key={item.specialization} className="inline-flex items-center rounded-md border bg-muted/40 px-2.5 py-1 text-xs capitalize">
                    {item.specialization.replaceAll("_", " ").toLowerCase()}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <DialogFooter className="-mx-4 -mb-4 mt-4 border-t bg-muted/40 px-4 py-3">
          <DialogClose render={<Button variant="outline">Close</Button>} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const AVATAR_COLORS = [
  "bg-orange-600 text-white",
  "bg-blue-600 text-white",
  "bg-purple-600 text-white",
  "bg-emerald-600 text-white",
  "bg-rose-600 text-white",
  "bg-amber-600 text-white",
  "bg-indigo-600 text-white",
  "bg-teal-600 text-white",
];

function getAssigneeColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function AssigneeAvatars({
  assignees,
}: {
  assignees: Array<{
    userId: string;
    user: { name: string | null; email: string | null; image?: string | null };
    managerNote?: string | null;
  }>;
}) {
  if (assignees.length === 0) {
    return <span className="text-xs italic text-muted-foreground">Unassigned</span>;
  }

  // Single assignee
  if (assignees.length === 1) {
    const a = assignees[0];
    const displayName = a.user.name || a.user.email || "Unknown";
    const initial = displayName.charAt(0).toUpperCase();
    const colorClass = getAssigneeColor(displayName);

    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span
            className={`flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${colorClass}`}
          >
            {a.user.image ? (
              <img
                src={a.user.image}
                alt={displayName}
                className="size-full rounded-full object-cover"
              />
            ) : (
              initial
            )}
          </span>
          <span className="font-medium text-sm text-foreground">{displayName}</span>
        </div>
        {a.managerNote ? (
          <p className="max-w-48 text-xs text-destructive">Manager note: {a.managerNote}</p>
        ) : null}
      </div>
    );
  }

  // Multiple assignees: shadcn stacked avatar grouping
  const visible = assignees.slice(0, 3);
  const remaining = assignees.length - 3;
  const allNames = assignees.map((a) => a.user.name || a.user.email).join(", ");

  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2">
        <div className="flex -space-x-2 overflow-hidden py-0.5" title={allNames}>
          {visible.map((a) => {
            const displayName = a.user.name || a.user.email || "Unknown";
            const initial = displayName.charAt(0).toUpperCase();
            const colorClass = getAssigneeColor(displayName);

            return (
              <span
                key={a.userId}
                title={displayName}
                className={`relative inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-card text-[10px] font-bold ${colorClass}`}
              >
                {a.user.image ? (
                  <img
                    src={a.user.image}
                    alt={displayName}
                    className="size-full rounded-full object-cover"
                  />
                ) : (
                  initial
                )}
              </span>
            );
          })}
          {remaining > 0 ? (
            <span
              title={allNames}
              className="relative inline-flex size-6 shrink-0 items-center justify-center rounded-full ring-2 ring-card bg-muted text-[10px] font-semibold text-muted-foreground"
            >
              +{remaining}
            </span>
          ) : null}
        </div>
        <span className="text-xs text-muted-foreground truncate max-w-[130px]" title={allNames}>
          {allNames}
        </span>
      </div>

      {assignees.some((a) => a.managerNote) && (
        <div className="space-y-0.5">
          {assignees
            .filter((a) => a.managerNote)
            .map((a) => (
              <p key={a.userId} className="max-w-48 text-xs text-destructive">
                {a.user.name || a.user.email}: {a.managerNote}
              </p>
            ))}
        </div>
      )}
    </div>
  );
}

function TaskTable({ tasks, role, options }: { tasks: TaskItem[]; role: "MANAGER" | "WORKER"; options: Options }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
          <tr>
            {["Task", "Project", "Assignees", "Priority", "Due date", "Status", "Actions"].map((h) => (
              <th key={h} className="px-4 py-3 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {tasks.map((task) => (
            <tr key={task.id} className="align-top">
              <td className="max-w-xs px-4 py-4">
                <div className="space-y-1">
                  <p className="font-medium text-foreground">{task.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {task.type === TaskType.DAILY_ENTRY
                      ? `Daily entry · ${dateText(task.workDate)}`
                      : "Assigned task"}
                  </p>
                </div>
              </td>
              <td className="px-4 py-4">
                <p className="font-medium">{task.project.name}</p>
                {task.project.client?.name ? (
                  <p className="text-xs text-muted-foreground">{task.project.client.name}</p>
                ) : null}
              </td>
              <td className="px-4 py-4">
                <AssigneeAvatars assignees={task.assignees} />
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium capitalize text-muted-foreground">
                  {task.priority.toLowerCase()}
                </span>
              </td>
              <td className="px-4 py-4 text-sm text-muted-foreground">
                {dateText(task.type === TaskType.DAILY_ENTRY ? task.workDate : task.dueAt)}
              </td>
              <td className="px-4 py-4">
                <span className="inline-flex rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  {labels[role === "WORKER" ? task.myStatus ?? task.status : task.status]}
                </span>
              </td>
              <td className="px-4 py-4">
                <TaskControls task={task} role={role} options={options} />
              </td>
            </tr>
          ))}
          {tasks.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-14 text-center text-muted-foreground">
                No tasks match these filters.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function TaskControls({ task, role, options }: { task: TaskItem; role: "MANAGER" | "WORKER"; options: Options }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const own = task.myStatus;
  const update = (next: TaskStatus) =>
    start(async () => {
      const result = await updateAssignmentStatus(task.id, next);
      setError(result.error ?? "");
    });

  if (role === "WORKER") {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <ViewTaskDialog task={task} />
        {own === TaskStatus.TODO ? (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => update(TaskStatus.IN_PROGRESS)}>
              Start
            </Button>
            <Button size="sm" disabled={pending} onClick={() => update(TaskStatus.IN_REVIEW)}>
              Submit
            </Button>
          </>
        ) : null}
        {own === TaskStatus.IN_PROGRESS ? (
          <>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => update(TaskStatus.TODO)}>
              To do
            </Button>
            <Button size="sm" disabled={pending} onClick={() => update(TaskStatus.IN_REVIEW)}>
              Submit
            </Button>
          </>
        ) : null}
        {task.type === TaskType.DAILY_ENTRY && (own === TaskStatus.TODO || own === TaskStatus.IN_PROGRESS) ? (
          <EditTaskDialog task={task} role={role} options={options} />
        ) : null}
        {error ? <span role="alert" className="text-xs text-destructive">{error}</span> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <ViewTaskDialog task={task} />
      {task.type === TaskType.ASSIGNED && task.status !== TaskStatus.COMPLETED ? (
        <EditTaskDialog task={task} role={role} options={options} />
      ) : null}
      {task.status === TaskStatus.IN_REVIEW ? (
        <Button size="sm" onClick={() => document.dispatchEvent(new CustomEvent("task-review", { detail: task.id }))}>
          Review
        </Button>
      ) : null}
      <DeleteTask taskId={task.id} />
    </div>
  );
}

function EditTaskDialog({ task, role, options }: { task: TaskItem; role: "MANAGER" | "WORKER"; options: Options }) {
  const [open, setOpen] = useState(false);
  const action = role === "MANAGER" ? updateAssignedTask.bind(null, task.id) : updateDailyEntry.bind(null, task.id);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const defaultDate = (value: Date | string | null) => (value ? new Date(value).toISOString().slice(0, 10) : "");

  const handleSubmit = (formData: FormData) => {
    setError("");
    startTransition(async () => {
      const res = await action(initial, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setOpen(false);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(""); }}>
      <DialogTrigger render={<Button size="sm" variant="outline">Edit</Button>} />
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit task</DialogTitle>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          <label className="block space-y-1.5 text-sm font-medium">
            Title
            <input name="title" required maxLength={160} defaultValue={task.title} className="h-10 w-full rounded-md border bg-background px-3 font-normal" />
          </label>
          <label className="block space-y-1.5 text-sm font-medium">
            Description
            <textarea name="description" maxLength={5000} rows={3} defaultValue={task.description ?? ""} className="w-full rounded-md border bg-background p-3 font-normal" />
          </label>
          <div className="space-y-2">
            <Label htmlFor={`edit-task-priority-${task.id}`}>Priority</Label>
            <Select name="priority" defaultValue={task.priority} items={prioritySelectItems}>
              <SelectTrigger id={`edit-task-priority-${task.id}`} className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {prioritySelectItems.map((value) => (
                  <SelectItem key={value.value} value={value.value}>
                    {value.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {role === "MANAGER" ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1.5 text-sm font-medium">
                  Start date
                  <input name="startAt" type="date" defaultValue={defaultDate(task.startAt)} className="h-10 w-full rounded-md border bg-background px-3 font-normal" />
                </label>
                <label className="space-y-1.5 text-sm font-medium">
                  Due date
                  <input name="dueAt" type="date" defaultValue={defaultDate(task.dueAt)} className="h-10 w-full rounded-md border bg-background px-3 font-normal" />
                </label>
              </div>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Assign workers</legend>
                <div className="max-h-40 space-y-2 overflow-auto rounded-md border p-3">
                  {options.workers.map((worker) => (
                    <label key={worker.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="workerId" value={worker.id} defaultChecked={task.assignees.some((a) => a.userId === worker.id)} />
                      {worker.name || worker.email}
                    </label>
                  ))}
                </div>
              </fieldset>
              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">Specializations</legend>
                <div className="grid gap-2 sm:grid-cols-2">
                  {Object.values(Specialization).map((specialization) => (
                    <label key={specialization} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-md border px-3 text-sm transition-colors hover:bg-muted/50 has-[:checked]:border-primary/50 has-[:checked]:bg-primary/5">
                      <input type="checkbox" name="specialization" value={specialization} defaultChecked={task.specializations.some((item) => item.specialization === specialization)} className="size-4 accent-primary" />
                      <span>{specialization.replaceAll("_", " ").toLowerCase()}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            </>
          ) : (
            <label className="block space-y-1.5 text-sm font-medium">
              Work date
              <input name="workDate" type="date" max={new Date().toISOString().slice(0, 10)} required defaultValue={defaultDate(task.workDate)} className="h-10 w-full rounded-md border bg-background px-3 font-normal" />
            </label>
          )}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" disabled={pending}>{pending ? "Saving…" : "Save changes"}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteTask({ taskId }: { taskId: string }) {
  const [open, setOpen] = useState(false); const [pending, start] = useTransition(); const [error, setError] = useState("");
  return <AlertDialog open={open} onOpenChange={setOpen}><AlertDialogTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Delete task"><Trash2 className="size-4" /></Button>} /><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this task?</AlertDialogTitle><AlertDialogDescription>The task will leave active task views and cannot be restored here.</AlertDialogDescription></AlertDialogHeader>{error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}<AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); start(async () => { const result = await softDeleteTask(taskId); if (result.error) setError(result.error); else setOpen(false); }); }} disabled={pending}>{pending ? "Deleting…" : "Delete task"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>;
}

function Daybook({ tasks, role, options }: { tasks: TaskItem[]; role: "MANAGER" | "WORKER"; options: Options }) {
  const groups = new Map<string, TaskItem[]>();
  for (const task of tasks) { const date = task.type === TaskType.DAILY_ENTRY ? task.workDate : task.dueAt ?? task.startAt; const key = date ? dateText(date) : "Unscheduled"; groups.set(key, [...(groups.get(key) ?? []), task]); }
  return <div className="space-y-5">{[...groups.entries()].sort(([a], [b]) => a === "Unscheduled" ? 1 : b === "Unscheduled" ? -1 : new Date(b).getTime() - new Date(a).getTime()).map(([date, items]) => <section key={date} className="rounded-md border bg-card"><h2 className="flex items-center gap-2 border-b px-4 py-3 font-medium"><CalendarDays className="size-4 text-primary" />{date}</h2><ul className="divide-y">{items.map((task) => <li key={task.id} className="flex flex-wrap items-center justify-between gap-3 p-4"><div><p className="font-medium">{task.title}</p><p className="text-xs text-muted-foreground">{task.project.name} · {labels[role === "WORKER" ? task.myStatus ?? task.status : task.status]}</p>{task.assignees.find((a) => a.isCurrentUser && a.managerNote)?.managerNote ? <p className="mt-1 text-xs text-destructive">Manager note: {task.assignees.find((a) => a.isCurrentUser)?.managerNote}</p> : null}</div><TaskControls task={task} role={role} options={options} /></li>)}</ul></section>)}</div>;
}

function TaskBoard({ tasks, role, options }: { tasks: TaskItem[]; role: "MANAGER" | "WORKER"; options: Options }) {
  const columns = role === "MANAGER" ? [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW, TaskStatus.COMPLETED] : [TaskStatus.TODO, TaskStatus.IN_PROGRESS, TaskStatus.IN_REVIEW];
  function move(taskId: string, next: TaskStatus) { const task = tasks.find((item) => item.id === taskId); if (!task) return; if (role === "MANAGER") { if (task.status === TaskStatus.IN_REVIEW && (next === TaskStatus.IN_PROGRESS || next === TaskStatus.COMPLETED)) document.dispatchEvent(new CustomEvent("task-review", { detail: task.id })); return; } void updateAssignmentStatus(taskId, next); }
  return <DragDropProvider onDragEnd={(event) => { if (!event.canceled) { const taskId = String(event.operation.source?.id ?? ""); const next = event.operation.target?.id as TaskStatus | undefined; if (taskId && next) move(taskId, next); } }}><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{columns.map((status) => <BoardColumn key={status} status={status} tasks={tasks.filter((task) => (role === "WORKER" ? task.myStatus : task.status) === status)} role={role} options={options} />)}</div></DragDropProvider>;
}

function BoardColumn({ status, tasks, role, options }: { status: TaskStatus; tasks: TaskItem[]; role: "MANAGER" | "WORKER"; options: Options }) {
  const { ref, isDropTarget } = useDroppable({ id: status, data: { status } });
  return <section ref={ref} className={`min-h-52 rounded-md border p-3 ${isDropTarget ? "border-primary bg-primary/5" : "bg-muted/20"}`}><h2 className="mb-3 flex items-center justify-between font-medium">{labels[status]}<span className="text-xs text-muted-foreground">{tasks.length}</span></h2><div className="space-y-2">{tasks.map((task) => <BoardCard key={task.id} task={task} role={role} options={options} />)}{tasks.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Drop tasks here</p> : null}</div></section>;
}

function BoardCard({ task, role, options }: { task: TaskItem; role: "MANAGER" | "WORKER"; options: Options }) {
  const status = role === "WORKER" ? task.myStatus : task.status;
  const canDrag = role === "WORKER" ? status === TaskStatus.TODO || status === TaskStatus.IN_PROGRESS : status === TaskStatus.IN_REVIEW;
  const { ref, handleRef, isDragging } = useDraggable({ id: task.id, data: { taskId: task.id }, disabled: !canDrag });
  return <article ref={ref} className={`rounded-md border bg-card p-3 ${isDragging ? "opacity-50" : ""}`}><div className="flex items-start gap-2"><button ref={handleRef} type="button" disabled={!canDrag} aria-label={`Drag ${task.title}`} className="mt-0.5 cursor-grab text-muted-foreground disabled:cursor-default"><GripVertical className="size-4" /></button><div className="min-w-0 flex-1"><h3 className="font-medium">{task.title}</h3><p className="mt-1 text-xs text-muted-foreground">{task.project.name} · due {dateText(task.dueAt)}</p><p className="mt-2 text-xs text-muted-foreground">{task.assignees.map((a) => a.user.name || a.user.email).join(", ")}</p>{task.assignees.find((a) => a.isCurrentUser && a.managerNote)?.managerNote ? <p className="mt-1 text-xs text-destructive">Manager note: {task.assignees.find((a) => a.isCurrentUser)?.managerNote}</p> : null}<TaskControls task={task} role={role} options={options} /></div></div></article>;
}

function ReviewDialog({ tasks }: { tasks: TaskItem[] }) {
  const [task, setTask] = useState<TaskItem | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    const listener = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      setTask(tasks.find((item) => item.id === id) ?? null);
      setError("");
    };
    window.addEventListener("task-review", listener);
    return () => window.removeEventListener("task-review", listener);
  }, [tasks]);

  const handleReview = (formData: FormData) => {
    if (!task) return;
    setError("");
    startTransition(async () => {
      const res = await reviewTask(task.id, initial, formData);
      if (res.error) {
        setError(res.error);
      } else {
        setTask(null);
      }
    });
  };

  return (
    <Dialog open={Boolean(task)} onOpenChange={(open) => { if (!open) setTask(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review {task?.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">Approve for everyone, or select workers who need to resubmit.</p>
          <form action={handleReview} className="space-y-3">
            <input type="hidden" name="decision" value="approve" />
            <Button type="submit" disabled={pending}><Check className="size-4" />Approve task</Button>
          </form>
          <form action={handleReview} className="space-y-3">
            <input type="hidden" name="decision" value="return" />
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Ask to resubmit</legend>
              {task?.assignees.map((a) => (
                <label key={a.userId} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="returnUserId" value={a.userId} />
                  {a.user.name || a.user.email}
                </label>
              ))}
            </fieldset>
            <textarea name="managerNote" required maxLength={3000} placeholder="Explain what needs to change" className="w-full rounded-md border bg-background p-3 text-sm" />
            {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
            <Button type="submit" variant="outline" disabled={pending}>Return selected</Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
