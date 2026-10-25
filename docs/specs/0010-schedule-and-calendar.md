# 0010. Schedule and Calendar for Studio Bookings and Task Milestones

**Date**: 2026-10-25
**Status**: Complete

## Summary

This specification defines an interactive studio scheduling system for WoPhoto. It unifies dedicated studio bookings, photo and video shoot schedules, equipment call times, and task delivery deadlines into a cohesive calendar view. Managers create and manage bookings with soft conflict warnings when locations or workers overlap, while workers view their assigned shoots and upcoming deliverables across month, week, and day views.

## Context

Photography and multimedia production teams juggle fast moving studio schedules. A single commercial campaign involves physical studio bay reservations, crew call times, client review sessions, and firm editing delivery milestones.

Without a shared calendar, teams risk double booking physical studio bays or scheduling photographers across concurrent client shoots. Keeping task deadlines isolated in list views prevents managers from spotting production bottlenecks, while relying on external third party calendar tools disconnects studio bookings from project work and role permissions.

WoPhoto needs a unified scheduling solution built directly into the workspace shell. It must respect studio role permissions, provide clear time filtering, and warn managers when a location or crew member is already committed without blocking emergency operational overrides.

## Requirements

**User stories**:
- As a manager, I want to create, reschedule, and cancel studio bookings and shoot schedules so physical bays and crew times are coordinated.
- As a manager, I want to see soft conflict warnings when a studio space or team member is double booked so I can resolve overlapping commitments quickly.
- As a worker, I want to view my scheduled shoots, call times, and upcoming task deadlines in one calendar so I know where I need to be and what is due.
- As a worker or manager, I want to toggle between month, week, and day agenda views and filter by event category or project so I can focus on relevant work.

**Acceptance criteria**:
- **AC-1**: Managers can create, edit, reschedule, and delete studio schedule events with title, event type, start time, end time, location, optional project link, and assigned workers.
- **AC-2**: End time must be equal to or later than start time, and all day events span the selected calendar dates stored as UTC day bounds.
- **AC-3**: When creating or updating an event, the system checks for overlapping events sharing the same physical location or assigned workers, returning descriptive conflict warnings while allowing the manager to confirm the booking.
- **AC-4**: The schedule interface provides month, week, and day agenda views with a quick Today shortcut and responsive navigation controls.
- **AC-5**: The calendar view dynamically merges dedicated studio bookings and active task deadlines, providing toggle filters to show or hide task deadlines, specific event types, or individual projects.
- **AC-6**: Workers have read only access to the schedule, viewing events where they are assigned, general studio bookings, and their own task deadlines.
- **AC-7**: Event cards and agenda items display event category badges, time ranges, location, project affiliation, and assigned crew avatars using standard profile image helpers.
- **AC-8**: Client accounts are strictly prohibited from accessing studio schedule routes and mutation actions, returning unauthorized status on any attempt.

## Options considered

### Option 1: Custom lightweight Tailwind and shadcn calendar grid with unified filters

Build the calendar view directly with Tailwind CSS grid layouts, date utilities, and existing Base UI dialog components.

**Pros**:
- Zero additional bundle weight and no external stylesheet conflicts.
- Flawless visual consistency with the existing dark and orange theme tokens.
- Complete control over soft conflict alerts, role filtering, and dynamic task deadline overlays.

**Cons**:
- Requires writing grid day and week math in the codebase rather than importing a prepackaged component.

### Option 2: Heavy third party calendar library (such as FullCalendar or React Big Calendar)

Import an external full featured calendar package.

**Pros**:
- Provides ready made drag and drop rescheduling handlers out of the box.

**Cons**:
- Adds substantial client bundle weight.
- Styling overrides fight against Tailwind v4 and cause dark mode contrast discrepancies.
- Harder to deeply integrate with custom Base UI dialogs and server action patterns.

### Option 3: Task deadlines only without custom studio events

Avoid adding a new schedule entity and strictly project existing task `dueAt` dates onto a calendar grid.

**Pros**:
- Requires no schema changes or database migrations.

**Cons**:
- Fails to support physical studio bay bookings, client call times, equipment maintenance windows, or multi crew shoots that are not single tasks.
- Forces managers to create fake dummy tasks to block out studio bays.

## Decision

**Chosen option**: Option 1: Custom lightweight Tailwind and shadcn calendar grid with unified filters.

We will create a native `ScheduleEvent` entity in PostgreSQL via Prisma and build a responsive calendar interface supporting month, week, and day views with soft conflict detection.

## Rationale

Studio production scheduling requires both physical space management and work milestone tracking. A lightweight custom Tailwind grid calendar keeps page loading snappy, guarantees high contrast readability in both dark and light themes, and integrates cleanly with our existing Next.js App Router server actions. Providing soft conflict warnings rather than hard blocks respects real world studio emergencies where managers must intentionally double book an assistant or schedule two concurrent crews in adjacent corners of the main bay.

## Feature design

**Data model sketch**:

```prisma
enum ScheduleEventType {
  SHOOT
  STUDIO_BOOKING
  CLIENT_MEETING
  MAINTENANCE
  DEADLINE
  OTHER
}

model ScheduleEvent {
  id          String            @id @default(cuid())
  title       String
  description String?           @db.Text
  eventType   ScheduleEventType @default(SHOOT)
  startAt     DateTime
  endAt       DateTime
  allDay      Boolean           @default(false)
  location    String?
  projectId   String?
  project     Project?          @relation(fields: [projectId], references: [id], onDelete: SetNull)
  createdById String
  createdBy   User              @relation("CreatedScheduleEvents", fields: [createdById], references: [id], onDelete: Restrict)
  assignees   User[]            @relation("ScheduleEventAssignees")
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt

  @@index([startAt, endAt])
  @@index([location, startAt, endAt])
  @@index([projectId])
  @@index([createdById])
}
```

User model relations added:
- `createdScheduleEvents`: `ScheduleEvent[]` relation `"CreatedScheduleEvents"`
- `assignedScheduleEvents`: `ScheduleEvent[]` relation `"ScheduleEventAssignees"`

Project model relation added:
- `scheduleEvents`: `ScheduleEvent[]`

**Timezone and all day event conventions**:
- Next.js server actions and PostgreSQL handle timestamps in UTC.
- Clients pass full ISO-8601 UTC strings (`startDate`, `endDate`) covering the full grid window, including the padding days at month boundaries.
- For all day events (`allDay: true`), `startAt` is saved as the UTC start of day (`YYYY-MM-DDT00:00:00.000Z`) and `endAt` as the UTC end of day (`YYYY-MM-DDT23:59:59.999Z`).
- Client rendering components format all day events using UTC date extraction to prevent local browser timezone shifts from jumping days.
- Date range guard: Queries reject spans greater than 62 days to prevent unbounded queries.

**Conflict detection rules and matching formula**:
- Overlap formula: An overlap exists between Event A and Event B if and only if `startA < endB && endA > startB`. Touching boundaries (for example Event A ending at 12:00 and Event B starting at 12:00) do not conflict.
- Location conflict: Checks for overlapping events where `location` matches. Locations that are empty, null, or set to `"On Location"` or `"Remote / Client Site"` are exempt from location conflicts.
- Worker conflict: Checks for overlapping events where at least one assigned worker overlaps.
- Self exclusion: When updating an existing event, the current event identifier (`excludeEventId`) is excluded from conflict matching.
- Warning payload shape:
  ```ts
  type ScheduleConflictWarning = {
    type: "LOCATION" | "WORKER";
    conflictingEventId: string;
    conflictingEventTitle: string;
    entityName: string;
    message: string;
  };
  ```
- Workflow: The modal dialog checks conflicts when dates, location, or assignees change, displaying descriptive warning alerts. If warnings exist, the manager can still confirm the booking with an explicit override.

**Standard studio location presets**:
- "Main Studio Bay"
- "Cyc Wall / Studio B"
- "Audio & Edit Suite"
- "On Location"
- "Remote / Client Site"
- Custom text override permitted

**Task deadline query and integration**:
- Dynamic task projection: Active task milestones in the queried date window are retrieved alongside schedule events.
- Criteria: `deletedAt: null`, `dueAt` between `startDate` and `endDate`, and `status` in `[TODO, IN_PROGRESS, IN_REVIEW]`. Completed or cancelled tasks are excluded.
- Role scoping: Managers query tasks belonging to their managed projects (`project: { managerId: user.id }`); workers query tasks where they are assigned (`assignees: { some: { userId: user.id } }`).
- Unified item union:
  ```ts
  type CalendarItem =
    | ({ kind: "EVENT" } & ScheduleEventPayload)
    | ({ kind: "TASK_DEADLINE" } & TaskDeadlinePayload);
  ```

**Worker event visibility rules**:
- Workers see:
  1. Events where they are assigned as crew (`assignees: { some: { id: user.id } }`).
  2. Studio wide bookings and maintenance holds (`eventType` in `[STUDIO_BOOKING, MAINTENANCE]`).
  3. Events with no assignees, representing general studio holds (`assignees: { none: {} }`).
  4. Their own assigned task deadlines.
- Private shoots assigned exclusively to other workers remain filtered from the worker's personal calendar view.

**Scope boundaries**:
- Automated email or push notifications for schedule event assignments are out of scope for this slice and deferred to a future iteration.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `getScheduleEvents` | Server query | `startDate`, `endDate`, `projectId?`, `eventType?` | `events[]`, `taskDeadlines[]` | Manager, Worker | 401, 403 |
| `checkScheduleConflicts` | Server action | `startAt`, `endAt`, `location?`, `assigneeIds[]`, `excludeEventId?` | `conflicts[]` | Manager | 401, 403, 400 |
| `createScheduleEvent` | Server action | `title`, `eventType`, `startAt`, `endAt`, `allDay`, `location`, `projectId?`, `assigneeIds[]`, `description?` | `event`, `warnings[]` | Manager | 401, 403, 422 |
| `updateScheduleEvent` | Server action | `id`, updated fields | `event`, `warnings[]` | Manager | 401, 403, 404, 422 |
| `deleteScheduleEvent` | Server action | `id` | `success: boolean` | Manager | 401, 403, 404 |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Calendar load | Scheduled events | `ScheduleEvent` records in date range matching role visibility |
| Calendar load | Task milestone entries | Active `Task` records matching `dueAt` in date range |
| Event detail card | Location badge | `ScheduleEvent.location` column |
| Event detail card | Crew avatars | `ScheduleEvent.assignees` mapped through `getProfileImageSrc` |
| Event dialog load | Assignable worker options | Active worker accounts from `prisma.user.findMany({ where: { role: 'WORKER', status: 'ACTIVE' } })` |
| Event dialog load | Active project options | Active projects from `prisma.project.findMany` |
| Save event | Overlap warning message | Computed from concurrent `ScheduleEvent` rows matching location or assignees |
| Save event | Creator identity | Current session user identifier from `requireRole` |

**Key invariants**:
- Event start timestamp must be before or equal to end timestamp.
- Non managers cannot create, modify, or delete studio schedule events.
- Soft conflict detection alerts the manager when overlapping bookings share the same location or assigned worker, but does not abort the write transaction.
- When an associated project is deleted, schedule events remain preserved with `projectId` set to null.

**Security model**:
- `MANAGER`: Full CRUD access over all studio events, location bookings, crew assignments, and conflict overrides.
- `WORKER`: Read only access to schedule views, seeing studio bookings, assigned shoots, and task deadlines.
- `CLIENT`: No access. Route access redirects to `/forbidden`, and server queries reject with 403.

**Critical test scenarios**:
- Happy path creation: Manager creates a studio shoot event with crew assignees and location, event renders on calendar grid, verifies **AC-1**, **AC-4**, **AC-7**.
- Rescheduling and deletion: Manager updates event start time and location, checks conflict warnings, and subsequently deletes the event, verifies **AC-1**, **AC-3**.
- Validation: Attempting to create an event with `endAt` prior to `startAt` fails with input validation error, verifies **AC-2**.
- All day bounds: All day event stores UTC midnight to end of day timestamps without day shifting, verifies **AC-2**.
- Soft location conflict: Creating an event overlapping an existing booking at "Main Studio Bay" returns a conflict warning identifying the conflicting booking, verifies **AC-3**.
- Soft worker conflict and update exclusion: Scheduling a worker during another assigned shoot triggers a worker warning, while updating an existing event without time changes does not conflict with itself, verifies **AC-3**.
- Unified view filtering: Toggling task deadlines filter merges or removes active task milestone markers on the calendar view, verifies **AC-5**.
- Worker authorization: Worker can view scheduled events and assigned shoots, but attempts to create, update, or delete an event fail with unauthorized error, verifies **AC-6**.
- Worker data isolation: Worker A cannot view Worker B's private unassigned shoot, but both see studio wide bay reservations, verifies **AC-6**.
- Client boundary: Client session attempting to invoke schedule queries or actions receives 403 Forbidden, verifies **AC-8**.

## Build plan

1. Add `ScheduleEventType` enum and `ScheduleEvent` model to `prisma/schema.prisma` with indexes and relations, run migration, satisfies **AC-1**, **AC-2**.
2. Create validation schemas in `lib/validation/schedule.ts` for event creation, updates, and conflict queries, satisfies **AC-1**, **AC-2**.
3. Implement data queries and server actions in `lib/schedule.ts` and `app/actions/schedule.ts` supporting CRUD, soft conflict detection, and task deadline merging, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**, **AC-8**.
4. Build the custom calendar grid components in `components/schedule/` supporting Month, Week, and Day agenda views with responsive controls, satisfies **AC-4**, **AC-7**.
5. Build the event creation and editing modal in `components/schedule/event-dialog.tsx` with location presets, worker multi select, and soft conflict warning banners, satisfies **AC-1**, **AC-3**.
6. Wire page routes in `app/(workspace)/manager/schedule/page.tsx` and `app/(workspace)/worker/schedule/page.tsx`, removing placeholders from `[section]/page.tsx`, satisfies **AC-4**, **AC-6**, **AC-8**.
7. Write automated unit and integration tests in `test/schedule.test.ts` covering validation, conflict warnings, role enforcement, and deadline projection, satisfies **AC-1** through **AC-8**.

## Consequences

**Positive**:
- Centralized studio coordination eliminating double booked bays and overlooked shoot dates.
- High performance native grid without external library bloat.
- Unified visibility over both physical bookings and creative deliverable deadlines.

**Negative / tradeoffs**:
- Managers must remember to record bookings in WoPhoto for conflict detection to be effective.

**Neutral**:
- Adds one new database table and replaces the schedule placeholder page for managers and workers.
