# 0004. Task Management and Daily Work Log

**Date**: 2026-10-22
**Status**: Accepted

## Summary

Managers and workers will use one Tasks area for assigned work and daily entries. Table, Board, and Daybook are three views of the same task data, with controls that follow each user's role. A worker submits work for review, and a manager approves it or returns selected assignees with a note.

## Context

The current application has a shared role aware workspace but no task screens or task actions. The database already has projects, tasks, task assignments, priorities, due dates, and a soft delete field. It does not yet record whether a task is assigned work or a daily entry, a daily work date, or each assignee's review progress.

The feature must support manager assigned work and worker created daily entries without maintaining two competing task lists. It must also preserve each assignee's progress when a task has more than one worker. The chosen screen design uses the existing WoPhoto theme and gives both roles a shared list, board, and daybook with role specific actions.

## Requirements

**User stories**:
- As a manager, I want to assign project work to one or more workers and review what each worker submits so that I can track delivery.
- As a worker, I want to update my assigned work and log my own daily work so that my manager can see what I am doing.
- As a manager or worker, I want to switch between a table, kanban board, and daybook so that I can use the view that fits the work at hand.

**Acceptance criteria**:
- **AC-1**: Managers can create tasks for projects they manage, assign one or more active workers, and edit task details. Start and due dates are optional. When both are set, the due date cannot be before the start date.
- **AC-2**: Workers can see assigned tasks only for their own assignments and can update their own progress. Assigned task details remain manager controlled.
- **AC-3**: Workers can create daily entries for projects where they have an assigned task. A daily entry belongs to its worker, has a UTC work date that defaults to today, allows any past date, and rejects future dates.
- **AC-4**: Workers can edit their own daily entry before submission (`TODO` or `IN_PROGRESS`). A daily entry becomes locked when submitted for manager review and becomes editable again if the manager returns it.
- **AC-5**: A task can have several assignees. Each assignment has its own status and submission time. The shared task enters review only after every assignee submits.
- **AC-6**: Managers can approve a task in review, completing it for all assignees, or return it to in progress. A return requires selecting at least one assignee to resubmit and a nonempty manager note. Only the selected assignees see that note and need to resubmit.
- **AC-7**: Managers can soft delete a task after confirming in a shadcn AlertDialog. Deleted tasks are excluded from active task views and cannot be updated by workers.
- **AC-8**: Managers and workers can view the same authorized task records in Table, Board, or Daybook view. Each view supports status and priority filters and shows project, assignee, due date, and task status where applicable. Managers filter by shared task status; workers filter by their own assignment status. Daybook groups daily entries by work date and assigned tasks by due date, falling back to start date and then creation date; tasks without any date appear in an Unscheduled group.
- **AC-9**: In Board view, workers can move their own assignment between permitted progress states by dragging cards. Managers can use drag or accessible controls to open explicit approval or return actions for tasks in review. Accessible controls provide the same permitted progress changes without dragging. Managers cannot directly change worker progress.
- **AC-10**: Unauthorized users cannot read or change task data outside their role and project assignments. Task reads and writes use server side queries and Server Actions with authorization checked on every operation.

## Options considered

### Option 1: One task model with an explicit entry type and per worker assignments

Keep assigned work and daily entries in `Task`, distinguish them with a type, and store each worker's progress on `TaskAssignee`.

**Pros**:
- All views use one task list, one filter model, and one review workflow.
- Individual progress remains queryable and consistent for tasks with several workers.

**Cons**:
- The task model needs conditional rules for daily entries and assigned work.
- Shared task state must be updated together with per worker state.

### Option 2: Separate task and daily entry models

Create a standalone model for each kind of work, joining them only in the interface.

**Pros**:
- Each record type has only the fields it needs.
- Daily entry date requirements are direct in the database model.

**Cons**:
- The three views must combine two data sources and reconcile their statuses.
- Shared assignment and review behavior becomes duplicated or more abstract.

### Option 3: Store assignment progress as a JSON value on each task

Keep assignment state as a nested field on `Task` rather than in relational rows.

**Pros**:
- Fewer relational queries for small task cards.

**Cons**:
- Database constraints and per worker filtering become harder to enforce.
- Concurrent updates from multiple workers can overwrite each other's progress.

## Decision

**Chosen option**: Option 1: One task model with an explicit entry type and per worker assignments.

Use the existing `Task` model for both assigned work and daily entries. Extend `TaskAssignee` to store each worker's status, submission time, and current manager return note. Managers can edit an assigned task's title, description, priority, start and due dates, specializations, and assignees; the project cannot be changed, and completed tasks cannot be edited. Retained assignees keep their states; added assignees start at `TODO`; removed assignees are removed from the task. Recompute the shared status atomically after an assignee change. Use the current WoPhoto design, with Table, Board, and Daybook as view tabs in one role aware Tasks area. Use dnd-kit for board dragging, with visible status controls as an accessible alternative.

**Implementation skills**: `develop` (`OpenAI`, `.agents/skills/develop/`) · `test` (`OpenAI`, `.agents/skills/test/`) · `check` (`OpenAI`, `.agents/skills/check/`)

## Rationale

The project already has `Task` and `TaskAssignee` tables, and workers need to move between the same assigned work and daily work views. One task model avoids separate filtering, review, and deletion implementations. Per worker assignment rows let the database identify exactly who submitted and who must resubmit.

The task board needs pointer, touch, and keyboard input. The current dnd-kit React packages support those input sensors and provide accessibility support. The board will still expose status controls, since a drag gesture cannot be the only way to change state. The smaller browser native implementation used in the prototype is suitable for demonstrating the flow, but needs more custom support for touch and accessibility.

## Feature design

**Data model sketch**:

| Entity | Fields and rules | Relationships |
|---|---|---|
| `Project` | Existing `id`, `name`, `managerId`, and `clientId` | One project has many tasks. Only its manager may create or change assigned tasks. |
| `Task` | Keep existing fields, including `completedAt`. Add required `type` (`ASSIGNED` or `DAILY_ENTRY`) and nullable `workDate` stored as a date. `workDate` is required for daily entries and null for assigned tasks. Keep `startAt`, `dueAt`, and `deletedAt`. | One project, one creator, one or more `TaskAssignee` rows; existing `TaskSpecialization` rows hold selected specializations. |
| `TaskAssignee` | Keep `taskId`, `userId`, and `assignedAt`. Add `status` using the task workflow status enum, `submittedAt` nullable, and `managerNote` nullable text. The note is set only on selected assignments during a return and cleared when that worker resubmits. | Many workers per task. The existing `(taskId, userId)` primary key prevents duplicate assignments. |

Daily entries use one self assignment. Assigned tasks require at least one worker. Specialization choices come from the existing `Specialization` enum and are stored in the existing `TaskSpecialization` relation. A manager return note is stored on each selected assignment so other assignees do not receive it. No review history is retained in this MVP; the field represents the current resubmission request.

**State transitions**:

| Event | Assignment status | Shared task status |
|---|---|---|
| Create assigned task or daily entry | `TODO` | `TODO` |
| Worker starts work (`TODO` → `IN_PROGRESS`) | `IN_PROGRESS` | `IN_PROGRESS`, unless other assignments remain `TODO` or `IN_REVIEW`; then recompute below |
| Worker returns own work (`IN_PROGRESS` → `TODO`) | `TODO` | Recompute below |
| One worker submits (`TODO` or `IN_PROGRESS` → `IN_REVIEW`) while others have not | `IN_REVIEW` | Recompute below |
| All assignees submit | `IN_REVIEW` | `IN_REVIEW` |
| Manager approves | All assignments become `COMPLETED` | `COMPLETED` |
| Manager returns selected workers | Selected become `IN_PROGRESS`, their `submittedAt` clears, and their `managerNote` is set. Others remain `IN_REVIEW`. | `IN_PROGRESS` |
| Selected worker resubmits | `IN_REVIEW`, `submittedAt` is set, and `managerNote` clears | `IN_REVIEW` when every assignment is submitted again |
| Manager soft deletes | No status change | `deletedAt` is set; the task leaves active views |

Workers may transition `TODO` to `IN_PROGRESS` or `IN_REVIEW`, and `IN_PROGRESS` to `TODO` or `IN_REVIEW`. They cannot change an assignment out of `IN_REVIEW` or `COMPLETED`; a manager must return work before it can be edited or resubmitted. Recompute shared task status after every assignment mutation: `COMPLETED` only after manager approval; otherwise `IN_REVIEW` when every assignment is `IN_REVIEW`, `TODO` when every assignment is `TODO`, and `IN_PROGRESS` for any other combination.

**API surface**:

Read actions run in server rendered pages and database query functions. Mutations use Next.js Server Actions; this feature adds no public REST endpoints.

| Server function | Inputs | Outputs | Auth | Key errors |
|---|---|---|---|---|
| `getTasks` | role scoped filters, optional cursor | task rows, counts, next cursor | Manager or worker | invalid filter, database failure |
| `getTaskFormOptions` | none | Manager: managed projects and active workers. Worker: eligible projects. | Manager or worker | unauthenticated, database failure |
| `createAssignedTask` | project, title, optional description, priority, optional start and due dates, worker IDs, optional specializations | created task and assignments | Manager | project not managed, invalid worker, invalid dates, no assignees |
| `updateAssignedTask` | task ID, title, description, priority, start/due dates, worker IDs, specializations | updated task and assignments | Manager of task project | not managed, completed or deleted task, invalid workers/dates, no assignees |
| `createDailyEntry` | project, title, optional description, optional work date, priority | created task and self assignment | Worker | project not eligible, future date, invalid fields |
| `updateDailyEntry` | task ID, title, description, priority, work date | updated entry | Owning worker | not found, wrong owner, locked after submission, future date |
| `updateAssignmentStatus` | task ID, next assignment status | updated assignment and shared task status | Assigned worker | invalid transition, not assigned, task deleted |
| `reviewTask` | task ID, approve or return, selected worker IDs and required note on return | updated task and assignments | Manager of task project | not managed, not in review, empty selection or note, invalid assignee |
| `softDeleteTask` | task ID | deleted task ID | Manager of task project | not managed, already deleted, database failure |

Task list queries use cursor pagination with a page size of 50 and stable `(createdAt, id)` ordering in all three views. Each view has an explicit Load more control and continues from the same authorized query; Daybook keeps date groups intact in the UI when more rows are loaded. Filters are status and priority, with role-specific status semantics described in AC-8. The selected view is a presentation choice and does not change the task query's authorization scope. For existing rows, migration sets `Task.type` to `ASSIGNED` and `workDate` to null. Each existing assignment receives the current parent task status; for tasks already in `IN_REVIEW`, `submittedAt` is backfilled from the parent's `updatedAt` as the closest available timestamp. Existing records did not capture per-worker submission times, so those backfilled timestamps are approximate.

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Load task views | tasks, project names, assignee display names/statuses, priority, dates, and recipient-scoped return notes | `Task`, `Project`, and `TaskAssignee` records, scoped by role and authenticated user; a worker sees their own assignment status and only their own return note, while the manager sees all assignment statuses and notes |
| Load task form options | manager's projects and active workers; worker's eligible projects | Managed `Project` rows; `User` rows with `role = WORKER` and `status = ACTIVE`; for workers, distinct projects with a prior nondeleted `ASSIGNED` task linked to their `TaskAssignee` |
| Show summary counts | TODO, in progress, review, and completed counts | Count of nondeleted tasks in the same authorized project or assignment scope; workers' counts use their own assignment status |
| Create or edit assigned task | creator, project ownership, assignees, initial status, specializations | Authenticated manager session, `Project.managerId`, submitted IDs validated against active worker users, initial status `TODO`, existing `Specialization` enum and `TaskSpecialization` relation |
| Create daily entry | creator, assignment, project eligibility, work date | Authenticated worker session, projects with a prior assignment for that worker, submitted past date or current UTC date |
| Show task date | start and due date | `Task.startAt` and `Task.dueAt`, formatted as UTC calendar dates for the date based task controls |
| Show daily entry date | work date | `Task.workDate`, a UTC calendar date |
| Submit assignment | submission timestamp and parent task status | Server time in UTC and all assignment statuses read inside the database transaction |
| Return task | selected recipients and visible note | Validated assignment IDs, manager input, `TaskAssignee.managerNote` |
| Approve task | completion timestamp and final statuses | Manager decision and server UTC time written to the existing `Task.completedAt` field |
| Delete task | active list membership | `Task.deletedAt`; null means active, timestamp means deleted |

**Key invariants**:
- A task belongs to exactly one project and has exactly one creator.
- An assigned task has at least one worker. A daily entry has exactly one assignment, owned by its creator.
- `workDate` is set only for daily entries. It cannot be in the future when compared as a UTC calendar date.
- A due date cannot be before a start date when both are present.
- A task enters `IN_REVIEW` only when every assignment is submitted.
- A task can be approved only from `IN_REVIEW`. A return must target one or more of its assignments and include a note.
- Managers can edit only noncompleted assigned tasks. The project stays fixed; retained assignments keep their state, added assignments start at `TODO`, and removed assignments are deleted. An assigned task must retain at least one worker. After assignee edits, shared status is recomputed using the rule above.
- Only the manager who owns the project can change assigned task details, review, or soft delete its tasks.
- Only the assigned worker can change their own assignment status, following the permitted transitions above. Workers can edit daily entry details only while their assignment is `TODO` or `IN_PROGRESS`.
- Deleted tasks cannot be updated or included in active task views.
- Assignment status, parent status, review, assignee changes, and deletion mutations lock the parent task row and run in one database transaction. Each mutation rechecks that `deletedAt` is null inside the transaction to prevent concurrent submits, edits, reviews, or deletion from leaving inconsistent state.

**Security model**:
- Require an authenticated Auth.js session for every page query and Server Action.
- Managers read tasks from projects where `Project.managerId` is their user ID. They can create, edit, review, and soft delete tasks only in those projects.
- Workers read tasks with an assignment row for their user ID. They can update only their own assignment status and daily entry details. A daily entry project must have at least one previously assigned, nondeleted task for that worker; the prior task's completion status does not remove project eligibility.
- Clients cannot access this task area in this feature. Their project view and feedback are part of the later client portal feature.
- Check authorization and submitted values inside every Server Action. Do not trust hidden form fields or client supplied role, owner, status, or assignee membership.
- Return co-assignee display names and statuses for a shared task, but project `managerNote` as null for workers other than its selected recipient. Managers of the project can read all assignment notes. Never expose a return note to an unselected worker.

**Configuration required**:

No new environment variables or third party credentials. Use the existing PostgreSQL connection and Prisma setup.

**Critical test scenarios**:
- Happy path: manager creates a project task for two workers, each worker submits separately, the shared task enters review only after both submit, and the manager approves it. Verifies **AC-1**, **AC-5**, **AC-6**.
- Daily entry rules: a worker creates an entry for an eligible project using today's UTC date, edits it before review, and is rejected when choosing a future date or an ineligible project. Verifies **AC-3**, **AC-4**.
- Return path: manager returns work to one selected assignee with a note, only that worker sees it, and the task returns to review after resubmission. Verifies **AC-5**, **AC-6**.
- Invalid state: a task cannot be approved before all assignments submit, and concurrent submissions do not lose an assignment update. Verifies **AC-5**, **AC-6**.
- Manager edits: project ownership is enforced; changing workers preserves retained progress, initializes new assignments to `TODO`, removes selected assignments, recalculates shared status, and rejects a completed task or an empty assignment list. Verifies **AC-1**, **AC-5**, **AC-10**.
- Auth and permission: an unassigned worker and a client cannot read the task; a worker cannot edit another worker's assignment; a manager cannot change a task in a project they do not manage. Verifies **AC-2**, **AC-3**, **AC-10**.
- Deleted task: worker updates fail after manager soft deletion, and the record no longer appears in active task views. Verifies **AC-7**.
- Board flow: worker board columns follow that worker's assignment status; manager board columns follow shared task status. Worker drag and accessible controls follow permitted transitions. Manager review cards invoke explicit approve/return actions and managers cannot directly change worker progress. Verifies **AC-9**.
- Views, options, and filters: manager and worker form options are role scoped; Table, Board, and Daybook preserve the authorized task set and status/priority filters, use the role-specific status source, group Daybook dates as specified, and keep Load more pagination consistent. Verifies **AC-8**, **AC-10**.
- Concurrent manager and worker changes: submitting, changing assignees, reviewing, or deleting the same task concurrently cannot update a deleted task or leave task and assignment states inconsistent. Verifies **AC-5**, **AC-6**, **AC-7**, **AC-10**.

## Build plan

1. Add the task type and work date fields, per assignment status, submission time, and return note to the Prisma model, then create one migration. Preserve existing task records as assigned tasks and backfill assignment state from the parent task, using `updatedAt` as the approximate submission time for existing review tasks. Satisfies **AC-1**, **AC-3**, **AC-5**, **AC-6**.
2. Build role scoped task and form-option reads, plus Server Actions for task creation/editing, worker daily entries, and assignment progress. Validate project scope, roles, dates, assignee changes, and task ownership on the server. Satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-10**.
3. Add the shared task review workflow, including locked transactional per-worker submissions, selected worker returns with individual notes, manager approval, and soft deletion with a shadcn AlertDialog. Satisfies **AC-5**, **AC-6**, **AC-7**, **AC-10**.
4. Build the role aware Tasks pages with Table, Board, and Daybook views, role-specific status filters, date grouping, counts, due dates, and Load more pagination. Use dnd-kit for board movement and provide accessible controls for valid status changes. Satisfies **AC-8**, **AC-9**.
5. Add focused action and data tests, run verification against manager and worker sessions, and fix any gaps. Satisfies **AC-1** through **AC-10**.

## Consequences

**Positive**:
- Managers and workers share one set of task records across all three views.
- Assignment progress, return instructions, and submission times are recorded per worker.
- Server side authorization and transactions protect the review workflow.

**Negative / tradeoffs**:
- The task model has conditional requirements for assigned work and daily entries.
- The board adds a drag and drop dependency and needs explicit accessible alternatives.
- Task counts require scoped database queries in addition to the paginated task list.

**Neutral**:
- Existing tasks are migrated as assigned tasks, with no work date.
- Deleted task browsing and restore remain in the later Deleted Tasks work area.
- Review note history is not retained in this MVP; only the current resubmission note is stored per selected assignment.

## Follow-up

- [ ] Build manager and worker task detail pages only if the task list views prove insufficient for descriptions or review notes.

## References

**Project sources**:
- `docs/scope/scope.md`, Task management and daily work log
- `prisma/schema.prisma`, existing `Project`, `Task`, and `TaskAssignee` models
- `lib/authz.ts`, authenticated role checks
- `app/actions/invitations.ts`, current Server Action and Prisma patterns
- `app/prototypes/tasks/`, approved Table, Board, and Daybook direction

**Practices & standards**:
- Server side authorization and input validation for every Server Action
- Database transactions for state changes that update task and assignment records together
- Accessible controls as an alternative to pointer based drag and drop

**Links**:
- dnd-kit React drag and drop provider: https://dndkit.com/react/components/drag-drop-provider/
- dnd-kit input sensors: https://dndkit.com/extend/sensors/
- Atlassian drag and drop accessibility guidelines: https://atlassian.design/components/pragmatic-drag-and-drop/accessibility-guidelines/
