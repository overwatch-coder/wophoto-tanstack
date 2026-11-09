import { useActionState, useEffect, useState } from "react"
import { useRouter } from "@tanstack/react-router"
import { useDebounce } from "@uidotdev/usehooks"
import { CalendarDays, Check, CircleHelp, Eye, FolderKanban, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  acceptWorkRequest,
  reviewWorkRequest,
  type WorkRequestActionState,
} from "@/src/server/actions/work-requests"
import type {
  getManagerWorkRequests,
  getManagerWorkRequestOptions,
} from "@/lib/work-requests"

type ManagerRequestPage = Awaited<ReturnType<typeof getManagerWorkRequests>>
type ManagerOptions = Awaited<ReturnType<typeof getManagerWorkRequestOptions>>
type WorkRequestItem = ManagerRequestPage["items"][number]
const initial: WorkRequestActionState = {}
const inputClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
const statusLabels: Record<string, string> = {
  SUBMITTED: "Submitted",
  NEEDS_INFO: "Needs information",
  DECLINED: "Declined",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
}

function ActionMessage({ state }: { state: WorkRequestActionState }) {
  if (!state.error && !state.success) return null
  return (
    <p
      role="status"
      className={`text-sm ${state.error ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}`}
    >
      {state.error ?? state.success}
    </p>
  )
}

function ReviewActions({ request }: { request: WorkRequestItem }) {
  const [state, action, pending] = useActionState(reviewWorkRequest, initial)
  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-border bg-background p-3"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <label className="grid gap-1.5 text-sm">
        Manager response
        <textarea
          name="managerNote"
          required
          minLength={2}
          maxLength={3000}
          rows={3}
          className={inputClass}
          placeholder="Explain what you need or why the request cannot be accepted."
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          name="nextStatus"
          value="NEEDS_INFO"
          size="sm"
          variant="outline"
          disabled={pending}
        >
          <CircleHelp className="mr-1.5 size-4" />
          Ask for information
        </Button>
        <Button
          type="submit"
          name="nextStatus"
          value="DECLINED"
          size="sm"
          variant="destructive"
          disabled={pending}
        >
          <X className="mr-1.5 size-4" />
          Decline
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

function AcceptActions({
  request,
  workers,
}: {
  request: WorkRequestItem
  workers: ManagerOptions["workers"]
}) {
  const [state, action, pending] = useActionState(acceptWorkRequest, initial)
  const defaultTaskTitle = (
    request.type === "PROJECT"
      ? `Initial work: ${request.title}`
      : request.title
  ).slice(0, 160)
  return (
    <form
      action={action}
      className="grid gap-3 rounded-lg border border-border bg-background p-3"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1.5 text-sm">
          Initial assigned task
          <input
            name="taskTitle"
            required
            minLength={2}
            maxLength={160}
            defaultValue={defaultTaskTitle}
            className={inputClass}
          />
        </label>
        <label className="grid gap-1.5 text-sm">
          Task due date
          <input
            type="date"
            name="dueAt"
            defaultValue={request.requestedDueAt?.slice(0, 10) ?? ""}
            className={inputClass}
          />
        </label>
      </div>
      <label className="grid gap-1.5 text-sm">
        Priority
        <select name="priority" defaultValue="MEDIUM" className={inputClass}>
          <option value="LOW">Low</option>
          <option value="MEDIUM">Medium</option>
          <option value="HIGH">High</option>
        </select>
      </label>
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">
          Assign to at least one active worker
        </legend>
        {workers.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {workers.map((worker) => (
              <label
                key={worker.id}
                className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="workerId"
                  value={worker.id}
                  className="accent-primary"
                />
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {worker.name || worker.email}
                  </span>
                  {worker.name && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {worker.email}
                    </span>
                  )}
                </span>
              </label>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Invite an active worker before accepting work requests.
          </p>
        )}
      </fieldset>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          size="sm"
          disabled={pending || workers.length === 0}
        >
          <Check className="mr-1.5 size-4" />
          {pending
            ? "Accepting…"
            : request.type === "PROJECT"
              ? "Create project and assign"
              : "Accept and assign"}
        </Button>
        <ActionMessage state={state} />
      </div>
      {request.type === "PROJECT" && (
        <p className="text-xs text-muted-foreground">
          This creates the proposed project and its first task in one operation.
        </p>
      )}
    </form>
  )
}

function RequestStatus({ status }: { status: string }) {
  const color = status === "SUBMITTED"
    ? "border-primary/30 bg-primary/5 text-primary"
    : status === "COMPLETED"
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : status === "DECLINED"
        ? "border-border bg-muted text-muted-foreground"
        : "border-border bg-background text-foreground"
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${color}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}

function RequestDetails({
  request,
  workers,
}: {
  request: WorkRequestItem
  workers: ManagerOptions["workers"]
}) {
  const project = request.project ?? request.createdProject
  return (
    <div className="grid gap-5">
      <section className="grid gap-4 rounded-lg border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <dl className="grid min-w-0 gap-1">
            <dt className="text-xs text-muted-foreground">Client</dt>
            <dd className="truncate text-sm font-medium">{request.client.name || request.client.email}</dd>
            {request.client.name && <dd className="truncate text-xs text-muted-foreground">{request.client.email}</dd>}
          </dl>
          <dl className="grid min-w-0 gap-1">
            <dt className="text-xs text-muted-foreground">Request type</dt>
            <dd className="text-sm">{request.type === "PROJECT" ? "New project" : "Existing project work"}</dd>
          </dl>
          {project && (
            <dl className="grid min-w-0 gap-1">
              <dt className="text-xs text-muted-foreground">Project</dt>
              <dd className="truncate text-sm">{project.name}</dd>
            </dl>
          )}
          <dl className="grid min-w-0 gap-1">
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd className="text-sm">{new Date(request.createdAt).toLocaleDateString()}</dd>
          </dl>
          {request.requestedDueAt && (
            <dl className="grid min-w-0 gap-1">
              <dt className="text-xs text-muted-foreground">Requested due date</dt>
              <dd className="text-sm">{new Date(request.requestedDueAt).toLocaleDateString()}</dd>
            </dl>
          )}
          <dl className="grid min-w-0 gap-1">
            <dt className="text-xs text-muted-foreground">Status</dt>
            <dd><RequestStatus status={request.status} /></dd>
          </dl>
        </div>
      </section>

      <section className="grid gap-2">
        <h3 className="text-sm font-semibold">Request details</h3>
        <p className="whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{request.details}</p>
      </section>

      {request.managerNote && (
        <section className="grid gap-2 rounded-lg border border-border bg-muted/30 p-4">
          <h3 className="text-sm font-medium">Previous studio response</h3>
          <p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{request.managerNote}</p>
        </section>
      )}
      {request.createdProject && (
        <section className="flex items-start gap-2 rounded-lg border border-border p-4 text-sm">
          <FolderKanban className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>Project created: <span className="font-medium">{request.createdProject.name}</span></p>
        </section>
      )}
      {request.createdTask && (
        <section className="grid gap-1 rounded-lg border border-border bg-muted/30 p-4 text-sm">
          <h3 className="font-medium">Assigned task</h3>
          <p>{request.createdTask.title}</p>
          <p className="text-muted-foreground">
            {statusLabels[request.createdTask.status] ?? request.createdTask.status} · Assigned to{" "}
            {request.createdTask.assignees
              .map((assignment) => assignment.user.name || assignment.user.email)
              .join(", ") || "No worker"}
          </p>
        </section>
      )}
      {request.status === "SUBMITTED" && (
        <div className="grid gap-5 border-t border-border pt-5">
          <section className="grid gap-3">
            <div>
              <h3 className="text-sm font-semibold">Accept and assign</h3>
              <p className="mt-1 text-sm text-muted-foreground">Choose the initial task details and at least one worker.</p>
            </div>
            <AcceptActions request={request} workers={workers} />
          </section>
          <details className="group rounded-lg border border-border">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              Ask for information or decline
            </summary>
            <div className="px-4 pb-4">
              <ReviewActions request={request} />
            </div>
          </details>
        </div>
      )}
    </div>
  )
}

const filters = [
  "ALL",
  "SUBMITTED",
  "NEEDS_INFO",
  "IN_PROGRESS",
  "COMPLETED",
  "DECLINED",
]

export function ManagerWorkRequests({
  data,
  options,
  status,
  query,
  nextHref,
  previousHref,
  focusRequest,
}: {
  data: ManagerRequestPage
  options: ManagerOptions
  status: string
  query: string
  nextHref?: string
  previousHref?: string
  focusRequest?: WorkRequestItem | null
}) {
  const router = useRouter()
  const [filterStatus, setFilterStatus] = useState(status)
  const [searchTerm, setSearchTerm] = useState(query)
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(
    focusRequest?.id ?? null,
  )
  const debouncedSearch = useDebounce(searchTerm, 350)
  useEffect(() => {
    const normalizedQuery = debouncedSearch.trim()
    if (filterStatus === status && normalizedQuery === query) return
    const search = new URLSearchParams()
    if (filterStatus !== "ALL") search.set("status", filterStatus)
    if (normalizedQuery) search.set("q", normalizedQuery)
    router.navigate({
      href: `/manager/work-requests${search.size ? `?${search}` : ""}`,
      replace: true,
    })
  }, [debouncedSearch, filterStatus, query, router, status])
  const total =
    data.counts.submitted +
    data.counts.needsInfo +
    data.counts.active +
    data.counts.completed +
    data.counts.declined
  const items = focusRequest
    ? [
        focusRequest,
        ...data.items.filter((request) => request.id !== focusRequest.id),
      ]
    : data.items
  const selectedRequest = items.find((request) => request.id === selectedRequestId) ?? null
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 py-6">
      <header>
        <h1 className="text-2xl font-semibold">Client work requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review client requests and create assigned work when you accept them.
        </p>
      </header>
      <section
        className="grid grid-cols-2 gap-3 sm:grid-cols-5"
        aria-label="Request status counts"
      >
        {[
          ["Submitted", data.counts.submitted],
          ["Needs information", data.counts.needsInfo],
          ["In progress", data.counts.active],
          ["Completed", data.counts.completed],
          ["Declined", data.counts.declined],
        ].map(([label, count]) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-3"
          >
            <p className="text-xl font-semibold">{count}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-3 rounded-xl border border-border bg-card p-3 sm:grid-cols-[1fr_auto] sm:items-center">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search client or request"
          aria-label="Search work requests"
          className={inputClass}
        />
        <select
          value={filterStatus}
          onChange={(event) => setFilterStatus(event.target.value)}
          className={inputClass}
          aria-label="Filter requests by status"
        >
          {filters.map((filter) => (
            <option key={filter} value={filter}>
              {filter === "ALL" ? "All statuses" : statusLabels[filter]}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted-foreground sm:col-span-2">
          {total} requests in your studio
        </span>
      </section>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <h2 className="text-sm font-semibold">Request queue</h2>
          <p className="text-xs text-muted-foreground">
            Showing {items.length} on this page · {total} total
          </p>
        </div>
        {items.length ? (
          <Table className="min-w-[880px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[28%]">Request</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Project</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((request) => {
                const project = request.project ?? request.createdProject
                return (
                  <TableRow key={request.id} className={request.id === focusRequest?.id ? "bg-primary/5" : undefined}>
                    <TableCell className="max-w-0">
                      <p className="truncate font-medium text-foreground">{request.title}</p>
                      <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{request.details}</p>
                    </TableCell>
                    <TableCell className="max-w-[180px]">
                      <p className="truncate font-medium">{request.client.name || request.client.email}</p>
                      {request.client.name && <p className="truncate text-xs text-muted-foreground">{request.client.email}</p>}
                    </TableCell>
                    <TableCell className="max-w-[160px]">
                      <p className="truncate">{project?.name ?? (request.type === "PROJECT" ? "New project request" : "—")}</p>
                      <p className="text-xs text-muted-foreground">{request.type === "PROJECT" ? "Project request" : "Existing project"}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {request.requestedDueAt ? (
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5" />{new Date(request.requestedDueAt).toLocaleDateString()}</span>
                      ) : "Not specified"}
                    </TableCell>
                    <TableCell><RequestStatus status={request.status} /></TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{new Date(request.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRequestId(request.id)} aria-label={`Review request: ${request.title}`}>
                        <Eye className="mr-1.5 size-4" />{request.status === "SUBMITTED" ? "Review" : "View"}
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium">{total === 0 ? "No requests yet." : "No requests match these filters."}</p>
            {total > 0 && <p className="mt-1 text-sm text-muted-foreground">Try another search or status filter.</p>}
          </div>
        )}
      </section>
      <Sheet open={selectedRequest !== null} onOpenChange={(open) => { if (!open) setSelectedRequestId(null) }}>
        <SheetContent side="right" className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(96vw,42rem)] data-[side=right]:sm:max-w-2xl">
          {selectedRequest && (
            <>
              <SheetHeader className="border-b border-border pr-12">
                <SheetTitle className="text-lg">{selectedRequest.title}</SheetTitle>
                <SheetDescription>
                  {selectedRequest.status === "SUBMITTED" ? "Review the request and decide how the studio should respond." : "Request details and current studio status."}
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6">
                <RequestDetails request={selectedRequest} workers={options.workers} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
      <div className="flex justify-between">
        {previousHref ? (
          <a
            className="text-sm text-primary hover:underline"
            href={previousHref}
          >
            Newer requests
          </a>
        ) : (
          <span />
        )}
        {nextHref ? (
          <a className="text-sm text-primary hover:underline" href={nextHref}>
            Older requests
          </a>
        ) : null}
      </div>
    </main>
  )
}
