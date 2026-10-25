"use client"

import { useActionState, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useDebounce } from "@uidotdev/usehooks"
import { Check, CircleHelp, FolderKanban, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  acceptWorkRequest,
  reviewWorkRequest,
  type WorkRequestActionState,
} from "@/app/actions/work-requests"
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

function RequestCard({
  request,
  workers,
  focused = false,
}: {
  request: WorkRequestItem
  workers: ManagerOptions["workers"]
  focused?: boolean
}) {
  const project = request.project ?? request.createdProject
  return (
    <article
      id={`request-${request.id}`}
      className={`grid scroll-mt-20 gap-4 rounded-xl border bg-card p-4 sm:p-5 ${focused ? "border-primary" : "border-border"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {request.type === "PROJECT"
              ? "New project request"
              : (project?.name ?? "Work request")}
          </p>
          <h3 className="mt-1 font-semibold break-words">{request.title}</h3>
          <p className="mt-1 text-sm break-all text-muted-foreground">
            {request.client.name || "Client"} · {request.client.email}
          </p>
        </div>
        <span className="rounded-full border border-border px-2.5 py-1 text-xs font-medium">
          {statusLabels[request.status]}
        </span>
      </div>
      <p className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
        {request.details}
      </p>
      {request.requestedDueAt && (
        <p className="text-xs text-muted-foreground">
          Requested due date:{" "}
          {new Date(request.requestedDueAt).toLocaleDateString()}
        </p>
      )}
      {request.managerNote && (
        <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <p className="text-xs font-medium text-muted-foreground">
            Previous studio response
          </p>
          <p className="mt-1 whitespace-pre-wrap">{request.managerNote}</p>
        </div>
      )}
      {request.createdProject && (
        <p className="flex items-center gap-2 text-sm">
          <FolderKanban className="size-4 text-primary" />
          Project created:{" "}
          <span className="font-medium">{request.createdProject.name}</span>
        </p>
      )}
      {request.createdTask && (
        <div className="rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">
            {request.createdTask.title} ·{" "}
            {statusLabels[request.createdTask.status] ??
              request.createdTask.status}
          </p>
          <p className="mt-1 text-muted-foreground">
            Assigned to{" "}
            {request.createdTask.assignees
              .map(
                (assignment) => assignment.user.name || assignment.user.email
              )
              .join(", ") || "No worker"}
          </p>
        </div>
      )}
      {request.status === "SUBMITTED" && (
        <div className="grid gap-3 border-t border-border pt-4">
          <AcceptActions request={request} workers={workers} />
          <ReviewActions request={request} />
        </div>
      )}
    </article>
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
  const debouncedSearch = useDebounce(searchTerm, 350)
  useEffect(() => {
    const normalizedQuery = debouncedSearch.trim()
    if (filterStatus === status && normalizedQuery === query) return
    const search = new URLSearchParams()
    if (filterStatus !== "ALL") search.set("status", filterStatus)
    if (normalizedQuery) search.set("q", normalizedQuery)
    router.replace(`/manager/work-requests${search.size ? `?${search}` : ""}`, {
      scroll: false,
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
      {items.length ? (
        <div className="grid gap-4">
          {items.map((request) => (
            <RequestCard
              key={request.id}
              request={request}
              workers={options.workers}
              focused={request.id === focusRequest?.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
          No requests match these filters.
        </div>
      )}
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
