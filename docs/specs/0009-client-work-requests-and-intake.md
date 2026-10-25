# Spec 0009: Client Work Requests and Intake

**Status**: Complete
**Date**: 2026-10-25
**Scope**: Client work and project intake, manager triage, task creation, and Copilot drafting

## Summary

Clients can request work for a project they own or propose a new project, then see whether the studio has received, needs more information about, declined, or started the request. Managers can review requests and turn approved requests into a project and assigned task. Copilot can prepare the request and show a confirmation card, but it only submits after the client clicks the card action.

## Context

The current task workflow is manager owned, while client feedback is intended for reviews and revisions. Reusing feedback for general work intake would mix two different jobs and their status rules. This feature adds a separate request record and keeps project creation and task assignment under manager control.

## Options considered

1. Reuse client feedback records. This is quick and avoids a migration, but requests would share review and revision semantics and manager tools that do not fit them.
2. Add a separate intake record for either existing-project work or a new project, and create project/task records only after manager approval. This needs one migration and a small workflow, while keeping ownership and status clear.
3. Let clients create projects and tasks directly, with manager assignment afterward. This puts unreviewed studio work in active lists and makes ownership and worker queues harder to reason about.

## Decision

Use a separate `WorkRequest` entity with two request types: `WORK` for an existing project and `PROJECT` for a proposed new project. A client submits or responds to a request. The manager is derived from the project's manager for `WORK`, or from the client's accepted invitation sender for `PROJECT`. Only that manager can request more information, decline, or accept the request. Acceptance creates the initial assigned task, and for a `PROJECT` request also creates the project, in one transaction. The manager controls worker assignment using the existing assigned task rules.

Copilot uses a client-only draft tool and an explicit submit button. The existing `createClientFeedback` action is not reused, and manager-only AI proposal confirmation is not broadened to clients.

**Implementation skills**: `ai-sdk` (`vercel/ai`, `.agents/skills/ai-sdk/`) for the existing AI SDK v4 tool and chat integration.

## Requirements

- **AC-1**: An authenticated client can submit either a work request for a project they own or a new project request. Each request has a title, details, and an optional requested due date; a work request requires its owned project, while a project request has no existing project.
- **AC-2**: Clients can view their own requests and current status, and can update request details only when the manager has asked for more information.
- **AC-3**: A manager can view and filter requests only for projects managed by that manager.
- **AC-4**: A manager can request more information or decline a submitted request, with a manager note visible to that project's client.
- **AC-5**: A manager can convert a submitted work request into exactly one assigned task, choosing at least one active worker. Creating and linking the task changes the request to in progress atomically.
- **AC-6**: A manager can accept a submitted new project request by creating its project and initial assigned task with at least one active worker. The project, task, request links, and in-progress status are committed atomically.
- **AC-7**: When the linked assigned task is approved as completed, its request becomes completed. Invalid or repeated transitions do not create duplicate projects or tasks.
- **AC-8**: The client and manager receive role-scoped in-app notifications when a request is submitted or its status changes.
- **AC-9**: A client can ask Copilot to draft either kind of request. Copilot shows the request type, project when relevant, title, details, and requested date in an inline card; submission occurs only after an explicit click and passes through the same ownership validation as the regular form.
- **AC-10**: Client and manager request lists are paginated and do not fetch the full request history at once.

## Rationale

One request record preserves an auditable boundary between what a client asked for and work the manager approved and assigned. Linking a request to at most one project and one task makes the handoff visible and prevents repeated confirmation clicks from creating duplicate work. The simpler alternative, extending feedback, would force unrelated request states into the review workflow. Direct client project/task creation would put unreviewed work in active studio lists.

## Feature design

**Data model sketch**:
- `WorkRequest`: `id`, `type`, `title`, `details`, optional `requestedDueAt`, `status`, optional `managerNote`, `clientId`, `managerId`, optional `projectId` (existing project for `WORK`), optional unique `createdProjectId` (new project created from `PROJECT`), optional unique `createdTaskId`, `createdAt`, `updatedAt`, and optional `reviewedAt`.
- `WorkRequestType`: `WORK` or `PROJECT`.
- `WorkRequestStatus`: `SUBMITTED`, `NEEDS_INFO`, `DECLINED`, `IN_PROGRESS`, and `COMPLETED`.
- `WorkRequest.clientId` and `managerId` reference `User`; `projectId`, `createdProjectId`, and linked `Task` references are optional. Unique `createdProjectId` and `createdTaskId` prevent duplicate acceptance results. A client request's project reference is set only for `WORK`; `PROJECT` uses `createdProjectId` only after manager approval.
- A task may reference one work request through the optional unique relationship. New project requests use the manager from the client's accepted invitation.

**State transitions**:
```text
SUBMITTED -> NEEDS_INFO -> SUBMITTED
SUBMITTED -> DECLINED
SUBMITTED -> IN_PROGRESS (manager creates and links task; also creates project for PROJECT type)
IN_PROGRESS -> COMPLETED (manager approves linked task)
```

**API surface**:
| Endpoint or action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createWorkRequest` | Server Action | type, optional `projectId`, title, details, optional `requestedDueAt` | request id and status | Client | project not owned, no accepted manager for new project, invalid fields |
| `respondToWorkRequest` | Server Action | `requestId`, updated title/details/date | request id and status | Owning client, only in `NEEDS_INFO` | request not owned, request not awaiting information |
| `getClientWorkRequests` | Server query | cursor and page size | page of client requests and next cursor | Client | invalid cursor |
| `getManagerWorkRequests` | Server query | status, search, cursor, page size | page of manager requests and next cursor | Manager | invalid filters |
| `reviewWorkRequest` | Server Action | `requestId`, `NEEDS_INFO` or `DECLINED`, manager note | request id and status | Project manager | request not managed, invalid transition |
| `acceptWorkRequest` | Server Action | request id, worker ids, priority, optional due date | request id, task id, optional new project id | Project manager | unavailable worker, request already accepted, request not submitted |
| Copilot request card | Server Action `createWorkRequest` | type, optional owned project id, title, details, optional date | request id and status | Client | invalid draft, project not owned |

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Submit request | client identity | authenticated session, never request input |
| Submit request | manager identity | project `managerId` loaded from the client owned project |
| Submit request | title, details, requested date | validated client form or Copilot draft, reviewed by client before submit |
| Client list | request status and manager note | request record owned by the signed-in client |
| Manager list | project, client, request status | request rows scoped by `managerId` matching the signed-in manager; existing project or accepted project relation supplies the project label |
| Accept request | task title, description, date | request fields; manager selected priority, worker ids, and for `PROJECT` a project description from request details |
| Complete request | status | linked task transition to `COMPLETED`, approved by manager |

**Key invariants**:
- The client is the owner of the selected project at submission time; new project requests use the manager who invited that client.
- Only the request's manager can read or change it.
- Only the manager creates projects and assigned tasks; request acceptance, record creation, and links are transactional and unique.
- `WORK` requires `projectId` and no `createdProjectId`. `PROJECT` requires no `projectId`; acceptance sets `createdProjectId`.
- `IN_PROGRESS` requires a linked task. `COMPLETED` requires that linked task to be completed.
- Client list results never include another client's requests, and manager list results never include another manager's projects.
- Copilot cannot submit a request without the same explicit client action and server checks used by the form.

**Security model**:
Every query and mutation derives identity from the authenticated session and validates project ownership. Client request bodies contain identifiers and editable values only; callers cannot supply client, manager, or status identity fields. New project requests route to the manager on the client's accepted invitation. Manager actions require request ownership. Worker role has no request read or write access. Copilot submission calls the same client only server action as the form.

**Critical test scenarios**:
- Happy path: client submits for an owned project, manager converts to a task, worker is assigned, manager approves task, client sees completed status; verifies AC-1, AC-3, AC-5, AC-6.
- Failure case: two simultaneous conversion requests create at most one task and only one request link; verifies AC-5.
- Auth/permission: another client and another manager cannot read or mutate the request; a worker cannot access request pages or actions; verifies AC-1, AC-3, AC-4, AC-5.
- Copilot: draft card displays request details, no record is created until the client confirms, and submission rejects a project not owned by the client; verifies AC-9.
- Pagination: requests beyond the page cap are available by cursor without returning all rows; verifies AC-9.

## Build plan

1. Add request type and status enums, the `WorkRequest` model, unique project/task links, indexes, migration, and typed validation, satisfying **AC-1**, **AC-5**, **AC-6**, **AC-7**, **AC-10**.
2. Implement client submission, response, and cursor based status queries with ownership checks, satisfying **AC-1**, **AC-2**, **AC-10**.
3. Implement manager paginated triage, request status updates, transactional work/project acceptance, completion sync, and notifications, satisfying **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**.
4. Build client and manager request pages with status display and actions, satisfying **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**.
5. Add the client Copilot draft tool, focused tool routing, inline card, and explicit call to the client request action, satisfying **AC-9**.
6. Add authorization, transition, pagination, and request flow tests; verify the client and manager browser paths, satisfying **AC-1** through **AC-10**.

## Consequences

**Positive**:
- Client requested work stays separate from reviews and approved tasks.
- Clients can see the studio's response and whether a request became active work.
- Managers retain control of worker assignment and existing task rules.

**Negative / tradeoffs**:
- The feature adds a request table and a database migration.
- A request converts to one initial assigned task. Bundled multi-task requests need a later design.

**Neutral**:
- Existing feedback and task workflows remain separate, with a single optional relation connecting an approved request to its task.

## Follow-up

- [ ] Consider multi-task conversion if clients need one request to represent a bundle of deliverables.
