
import { useActionState, useState } from "react"
import { Check, CircleHelp, Eye, FilePlus2, Send } from "lucide-react"
import { createWorkRequest, respondToWorkRequest, type WorkRequestActionState } from "@/src/server/actions/work-requests"
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
import type { getClientWorkRequests, getClientWorkRequestOptions } from "@/lib/work-requests"

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

function RequestForm({
  projects,
  onClose,
}: ClientOptions & { onClose: () => void }) {
  const [type, setType] = useState("WORK")
  const [state, action, pending] = useActionState(createWorkRequest, initial)
  return (
    <form action={action} className="grid gap-4">
      {state.success ? (
        <div className="grid justify-items-start gap-4 rounded-lg border border-border bg-muted/30 p-4">
          <p className="text-sm text-foreground">{state.success}</p>
          <Button type="button" onClick={onClose}>
            Done
          </Button>
        </div>
      ) : (
        <>
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
              rows={5}
              className={fieldClass}
              placeholder="Describe what you need, including important context."
            />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            Requested due date{" "}
            <span className="font-normal text-muted-foreground">Optional</span>
            <input type="date" name="requestedDueAt" className={fieldClass} />
          </label>
          {type === "WORK" && projects.length === 0 && (
            <p className="text-sm text-muted-foreground">
              You do not have a project yet. Choose “Request a new project” to
              send a project proposal.
            </p>
          )}
          <div className="grid gap-3 border-t border-border pt-4">
            <Button
              type="submit"
              disabled={pending || (type === "WORK" && projects.length === 0)}
            >
              <Send className="mr-2 size-4" />
              {pending ? "Sending…" : "Submit request"}
            </Button>
            <ActionMessage state={state} />
          </div>
        </>
      )}
    </form>
  )
}

function ReplyForm({ request }: { request: WorkRequestItem }) {
  const [state, action, pending] = useActionState(respondToWorkRequest, initial)
  return state.success ? (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-3">
      <ActionMessage state={state} />
    </div>
  ) : (
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
      <div className="grid gap-3">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Sending…" : "Send updated request"}
        </Button>
        <ActionMessage state={state} />
      </div>
    </form>
  )
}

function RequestStatus({ status }: { status: string }) {
  const stateClass = status === "COMPLETED"
    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : status === "DECLINED"
      ? "border-border bg-muted text-muted-foreground"
      : status === "NEEDS_INFO"
        ? "border-primary/30 bg-primary/5 text-primary"
        : "border-border bg-background text-foreground"
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${stateClass}`}>
      {statusLabel[status] ?? status}
    </span>
  )
}

function RequestDetails({ request }: { request: WorkRequestItem }) {
  const project = request.project ?? request.createdProject
  return (
    <div className="grid gap-5">
      <div className="grid gap-3 rounded-lg border border-border p-4">
        <div>
          <p className="text-xs text-muted-foreground">
            {request.type === "PROJECT" ? "New project request" : "Work request"}
          </p>
          <h3 className="mt-1 break-words font-semibold">{request.title}</h3>
        </div>
        {project && (
          <dl className="grid gap-1 text-sm">
            <dt className="text-xs text-muted-foreground">Project</dt>
            <dd>{project.name}</dd>
          </dl>
        )}
        <dl className="grid gap-1 text-sm">
          <dt className="text-xs text-muted-foreground">Request status</dt>
          <dd><RequestStatus status={request.status} /></dd>
        </dl>
        <dl className="grid gap-1 text-sm">
          <dt className="text-xs text-muted-foreground">Details</dt>
          <dd className="whitespace-pre-wrap break-words">{request.details}</dd>
        </dl>
        <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
          <dl className="grid gap-1">
            <dt className="text-xs text-muted-foreground">Submitted</dt>
            <dd>{new Date(request.createdAt).toLocaleDateString()}</dd>
          </dl>
          {request.requestedDueAt && (
            <dl className="grid gap-1">
              <dt className="text-xs text-muted-foreground">Requested due date</dt>
              <dd>{new Date(request.requestedDueAt).toLocaleDateString()}</dd>
            </dl>
          )}
        </div>
      </div>

      {request.managerNote && (
        <div className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex items-start gap-2">
            <CircleHelp className="mt-0.5 size-4 shrink-0 text-primary" />
            <div>
              <h3 className="text-sm font-medium">Studio response</h3>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                {request.managerNote}
              </p>
            </div>
          </div>
        </div>
      )}

      {request.createdProject && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Project created</h3>
          <p className="mt-1 text-sm text-muted-foreground">{request.createdProject.name}</p>
        </div>
      )}

      {request.createdTask && (
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-medium">Assigned work</h3>
          <p className="mt-1 text-sm">{request.createdTask.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {request.createdTask.assignees
              .map((assignment) => assignment.user.name || assignment.user.email)
              .join(", ") || "No worker assigned"}
            {" · "}{statusLabel[request.createdTask.status] ?? request.createdTask.status}
          </p>
        </div>
      )}

      {request.status === "NEEDS_INFO" && <ReplyForm request={request} />}
      {request.status === "COMPLETED" && (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <Check className="size-4" />
          The studio marked the assigned work complete.
        </p>
      )}
    </div>
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
  const [addRequestOpen, setAddRequestOpen] = useState(false)
  const [selectedRequestId, setSelectedRequestId] = useState(focusRequest?.id ?? null)
  const selectedRequest = selectedRequestId
    ? focusRequest?.id === selectedRequestId
      ? focusRequest
      : data.items.find((request) => request.id === selectedRequestId) ?? null
    : null

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-5 py-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Work requests</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Ask the studio for work or propose a new project, then follow its progress.
          </p>
        </div>
        <Button onClick={() => setAddRequestOpen(true)}>
          <FilePlus2 className="mr-2 size-4" />
          Add request
        </Button>
      </header>

      <section aria-labelledby="your-requests-heading" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 id="your-requests-heading" className="text-lg font-semibold">Your requests</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Status updates from your studio manager appear here.
            </p>
          </div>
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {data.items.length} {data.items.length === 1 ? "request" : "requests"} on this page
          </p>
        </div>

        {data.items.length ? (
          <div className="max-w-full overflow-hidden rounded-xl border border-border bg-card">
            <Table className="min-w-[760px]">
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="min-w-[220px] px-4">Request</TableHead>
                  <TableHead className="min-w-[150px]">Project</TableHead>
                  <TableHead className="min-w-[125px]">Requested due date</TableHead>
                  <TableHead className="min-w-[145px]">Status</TableHead>
                  <TableHead className="min-w-[115px]">Submitted</TableHead>
                  <TableHead className="w-24 px-4 text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.items.map((request) => {
                  const project = request.project ?? request.createdProject
                  return (
                    <TableRow key={request.id} id={`request-${request.id}`}>
                      <TableCell className="max-w-[340px] px-4 py-3 align-middle">
                        <p className="truncate font-medium">{request.title}</p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                          {request.details}
                        </p>
                      </TableCell>
                      <TableCell className="max-w-[200px] py-3 align-middle text-sm">
                        <p className="truncate">{project?.name ?? "New project request"}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {request.type === "PROJECT" ? "New project" : "Existing project"}
                        </p>
                      </TableCell>
                      <TableCell className="py-3 align-middle text-sm whitespace-nowrap text-muted-foreground">
                        {request.requestedDueAt
                          ? new Date(request.requestedDueAt).toLocaleDateString()
                          : "Not specified"}
                      </TableCell>
                      <TableCell className="py-3 align-middle">
                        <RequestStatus status={request.status} />
                      </TableCell>
                      <TableCell className="py-3 align-middle text-sm whitespace-nowrap text-muted-foreground">
                        {new Date(request.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right align-middle">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          aria-label={`View request: ${request.title}`}
                          onClick={() => setSelectedRequestId(request.id)}
                        >
                          <Eye className="mr-1.5 size-3.5" />
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border px-6 py-12 text-center">
            <FilePlus2 className="mx-auto mb-3 size-5 text-muted-foreground" />
            <h3 className="font-medium">No requests yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Submit a work request or propose a new project to get started.
            </p>
            <Button className="mt-4" variant="outline" onClick={() => setAddRequestOpen(true)}>
              Add request
            </Button>
          </div>
        )}

        <div className="flex justify-between">
          {previousHref ? (
            <a className="text-sm text-primary hover:underline" href={previousHref}>
              Newer requests
            </a>
          ) : <span />}
          {nextHref ? (
            <a className="text-sm text-primary hover:underline" href={nextHref}>
              Older requests
            </a>
          ) : null}
        </div>
      </section>

      <Sheet open={addRequestOpen} onOpenChange={setAddRequestOpen}>
        <SheetContent
          side="right"
          className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(96vw,36rem)] data-[side=right]:sm:max-w-xl"
        >
          <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
            <SheetTitle className="text-lg">Add a work request</SheetTitle>
            <SheetDescription>
              The studio manager will review your request before assigning work.
            </SheetDescription>
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
            <RequestForm projects={options.projects} onClose={() => setAddRequestOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={selectedRequest !== null}
        onOpenChange={(open) => {
          if (!open) setSelectedRequestId(null)
        }}
      >
        <SheetContent
          side="right"
          className="gap-0 overflow-hidden p-0 data-[side=right]:w-full data-[side=right]:sm:w-[min(96vw,36rem)] data-[side=right]:sm:max-w-xl"
        >
          {selectedRequest && (
            <>
              <SheetHeader className="shrink-0 border-b border-border px-5 py-5 pr-14 text-left sm:px-6">
                <SheetTitle className="break-words">{selectedRequest.title}</SheetTitle>
                <SheetDescription>
                  Follow the studio&apos;s response and the work created from your request.
                </SheetDescription>
              </SheetHeader>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
                <RequestDetails request={selectedRequest} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </main>
  )
}
