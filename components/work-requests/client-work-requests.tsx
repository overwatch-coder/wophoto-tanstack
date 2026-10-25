"use client"

import { useActionState, useState } from "react"
import { Check, CircleHelp, Clock3, FolderPlus, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  createWorkRequest,
  respondToWorkRequest,
  type WorkRequestActionState,
} from "@/app/actions/work-requests"
import type {
  getClientWorkRequests,
  getClientWorkRequestOptions,
} from "@/lib/work-requests"

type ClientRequestPage = Awaited<ReturnType<typeof getClientWorkRequests>>
type ClientOptions = Awaited<ReturnType<typeof getClientWorkRequestOptions>>
type WorkRequestItem = ClientRequestPage["items"][number]

const initial: WorkRequestActionState = {}
const statusLabel: Record<string, string> = {
  SUBMITTED: "Submitted",
  NEEDS_INFO: "Needs your reply",
  DECLINED: "Declined",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
}
const fieldClass =
  "w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"

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

function RequestForm({ projects }: ClientOptions) {
  const [type, setType] = useState("WORK")
  const [state, action, pending] = useActionState(createWorkRequest, initial)
  return (
    <form
      action={action}
      className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5"
    >
      <div>
        <h2 className="text-lg font-semibold">Submit a request</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The studio will review it before work is assigned.
        </p>
      </div>
      <label className="grid gap-1.5 text-sm font-medium">
        Request type
        <select
          name="type"
          value={type}
          onChange={(event) => setType(event.target.value)}
          className={fieldClass}
        >
          <option value="WORK">Work for an existing project</option>
          <option value="PROJECT">Request a new project</option>
        </select>
      </label>
      {type === "WORK" && (
        <label className="grid gap-1.5 text-sm font-medium">
          Project
          <select
            name="projectId"
            required
            className={fieldClass}
            defaultValue=""
          >
            <option value="" disabled>
              Select a project
            </option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      )}
      {type === "PROJECT" && (
        <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
          A manager will review your proposal and create the project and its
          first assigned task if approved.
        </p>
      )}
      <label className="grid gap-1.5 text-sm font-medium">
        {type === "PROJECT" ? "Proposed project name" : "Request title"}
        <input
          name="title"
          required
          minLength={2}
          maxLength={160}
          className={fieldClass}
          placeholder={
            type === "PROJECT"
              ? "e.g. Spring campaign"
              : "e.g. Retouch the product images"
          }
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Details
        <textarea
          name="details"
          required
          minLength={10}
          maxLength={5000}
          rows={4}
          className={fieldClass}
          placeholder="Describe what you need, including important context."
        />
      </label>
      <label className="grid gap-1.5 text-sm font-medium">
        Requested due date{" "}
        <span className="font-normal text-muted-foreground">Optional</span>
        <input type="date" name="requestedDueAt" className={fieldClass} />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="submit"
          disabled={pending || (type === "WORK" && projects.length === 0)}
        >
          <Send className="mr-2 size-4" />
          {pending ? "Sending…" : "Submit request"}
        </Button>
        <ActionMessage state={state} />
      </div>
      {type === "WORK" && projects.length === 0 && (
        <p className="text-sm text-muted-foreground">
          You do not have a project yet. Submit a new project request above.
        </p>
      )}
    </form>
  )
}

function ReplyForm({ request }: { request: WorkRequestItem }) {
  const [state, action, pending] = useActionState(respondToWorkRequest, initial)
  return (
    <form
      action={action}
      className="mt-4 grid gap-3 rounded-lg border border-border bg-background p-3"
    >
      <input type="hidden" name="requestId" value={request.id} />
      <label className="grid gap-1 text-sm">
        Update title
        <input
          name="title"
          defaultValue={request.title}
          required
          minLength={2}
          maxLength={160}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Add the requested information
        <textarea
          name="details"
          defaultValue={request.details}
          required
          minLength={10}
          maxLength={5000}
          rows={3}
          className={fieldClass}
        />
      </label>
      <label className="grid gap-1 text-sm">
        Requested due date
        <input
          type="date"
          name="requestedDueAt"
          defaultValue={request.requestedDueAt?.slice(0, 10) ?? ""}
          className={fieldClass}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send updated request"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

function RequestCard({
  request,
  focused = false,
}: {
  request: WorkRequestItem
  focused?: boolean
}) {
  const requestProject = request.project ?? request.createdProject
  return (
    <article
      id={`request-${request.id}`}
      className={`scroll-mt-20 rounded-xl border bg-card p-4 sm:p-5 ${focused ? "border-primary" : "border-border"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">
            {request.type === "PROJECT"
              ? "New project request"
              : (requestProject?.name ?? "Project request")}
          </p>
          <h3 className="mt-1 font-semibold break-words">{request.title}</h3>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-xs font-medium">
          <Clock3 className="size-3.5" />
          {statusLabel[request.status]}
        </span>
      </div>
      <p className="mt-3 text-sm break-words whitespace-pre-wrap text-muted-foreground">
        {request.details}
      </p>
      {request.requestedDueAt && (
        <p className="mt-2 text-xs text-muted-foreground">
          Requested by {new Date(request.requestedDueAt).toLocaleDateString()}
        </p>
      )}
      {request.createdTask && (
        <div className="mt-3 rounded-lg bg-muted/50 p-3 text-sm">
          <p className="font-medium">
            Assigned work: {request.createdTask.title}
          </p>
          <p className="mt-1 text-muted-foreground">
            {request.createdTask.assignees
              .map(
                (assignment) => assignment.user.name || assignment.user.email
              )
              .join(", ")}{" "}
            ·{" "}
            {statusLabel[request.createdTask.status] ??
              request.createdTask.status}
          </p>
        </div>
      )}
      {request.managerNote && (
        <div className="mt-3 flex gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
          <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="break-words whitespace-pre-wrap">
            {request.managerNote}
          </p>
        </div>
      )}
      {request.status === "NEEDS_INFO" && <ReplyForm request={request} />}
      {request.status === "COMPLETED" && (
        <p className="mt-3 flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <Check className="size-4" />
          The studio marked the assigned work complete.
        </p>
      )}
    </article>
  )
}

export function ClientWorkRequests({
  data,
  options,
  nextHref,
  previousHref,
  focusRequest,
}: {
  data: ClientRequestPage
  options: ClientOptions
  nextHref?: string
  previousHref?: string
  focusRequest?: WorkRequestItem | null
}) {
  const items = focusRequest
    ? [
        focusRequest,
        ...data.items.filter((request) => request.id !== focusRequest.id),
      ]
    : data.items
  return (
    <main className="mx-auto grid w-full max-w-6xl gap-6 py-6 lg:grid-cols-[minmax(300px,0.8fr)_minmax(0,1.2fr)]">
      <div className="grid content-start gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Work requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ask the studio for work or propose a new project, then follow its
            progress.
          </p>
        </div>
        <RequestForm projects={options.projects} />
      </div>
      <section className="grid content-start gap-4">
        <div>
          <h2 className="text-lg font-semibold">Your requests</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Status updates from your studio manager appear here.
          </p>
        </div>
        {items.length ? (
          <div className="grid gap-3">
            {items.map((request) => (
              <RequestCard
                key={request.id}
                request={request}
                focused={request.id === focusRequest?.id}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            <FolderPlus className="mx-auto mb-2 size-5" />
            No requests yet.
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
      </section>
    </main>
  )
}
