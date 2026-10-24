# 0006. Client Portal & Feedback System

**Date**: 2026-10-23
**Status**: Accepted

## Summary

WoPhoto delivers the Client Portal & Feedback System (Slice 4) implementing **Option C (Request Triage Dock & Workspace)**. Clients access `/client/project-feedback` with an interactive 2-column layout:
- **Left Stage (~68%)**: Ticket workspace displaying request narrative, deliverable context, 5-star rating, SLA indicator, and studio resolution notes from the lead photographer/manager. When "+ New Request" is activated, it displays a validated submission form to log revisions, reviews, or complaints tied to projects and specific deliverables.
- **Right Mini Sidebar (~32%)**: Fixed triage rail with a prominent `+ New Request` button, filter tabs (All, Open, Resolved), and a scrollable list of ticket cards indicating status, title, project, and creation date. Clicking any ticket dynamically updates the main stage.
- **Manager Triage at `/manager/reviews`**: Managers can inspect client feedback across all managed projects and choose between two distinct workflows:
  1. **Direct Resolution**: Resolve simple requests directly by entering a studio resolution note and marking as `RESOLVED`.
  2. **Worker Delegation & Return**: Delegate revision or issue requests to the worker who originally completed the task (or any team member), returning the task to `IN_PROGRESS` with specific delegation notes. The feedback status transitions to `ASSIGNED_TO_WORKER`.
- **Client Reviews**: Reviews carry a written review and a required 1–5 star rating. They have no subject field and are informational on the manager side: managers can view them, but cannot resolve or delegate them. They never enter the worker revision workflow.
- **Worker Workspace at `/worker/reviews`**: Workers review delegated revision or issue requests, access client instructions and manager notes, complete adjustments, and submit work back to the manager (moving status to `IN_REVIEW`).
- **Manager Approval**: The manager reviews the worker's submitted adjustments and enters the final resolution note for the client, completing the lifecycle (`RESOLVED`).
- All queries and mutations are role-scoped: clients access only projects they own; managers access only projects they manage; workers access only assignments delegated to them.

## Context

Previous iterations established the role-aware layout shell, task management engine, and analytics dashboards. However, the client feedback route (`/client/project-feedback`) and manager reviews route (`/manager/reviews`) previously rendered construction placeholders. Clients lacked a channel to request retouching, log revision requests, or rate deliverable milestones.

Through interactive prototyping (`/prototypes/client-feedback`), Option C was approved: a clean, uncluttered layout featuring a right mini sidebar as the primary triage controller.

## Requirements

**User stories**:
- As a client, I want to submit a review with a rating, or a titled revision or issue request, for a project or deliverable and track request resolution.
- As a client, I want to filter my feedback queue (All, Open, Resolved) from a right mini sidebar and click tickets to view studio responses.
- As a manager, I want to review incoming client requests and post studio resolution notes so that clients receive immediate feedback on adjustments.

**Acceptance criteria**:
- **AC-1**: Database schema includes `ClientFeedback`, `FeedbackType` (`REVISION`, `REVIEW`, `COMPLAINT`), and `FeedbackStatus` (`NEW`, `IN_REVIEW`, `RESOLVED`) linked to `User`, `Project`, and `Task`.
- **AC-2**: Clients can access `/client/project-feedback` and view a 2-column layout with a right-hand mini triage dock.
- **AC-3**: Clicking tickets in the right rail updates the main content stage without reloading the page.
- **AC-4**: Clients can submit a review with written details (5–5,000 chars), a required 1–5 star rating, and an optional deliverable. Reviews have no title input. Revision and issue requests require a title (3–150 chars) and details (5–5,000 chars), have no rating, and can optionally reference a deliverable.
- **AC-5**: Managers can access `/manager/reviews`, view client reviews without resolution or delegation actions, and either resolve revision or issue requests directly or delegate/return them to a worker with manager instructions.
- **AC-6**: Workers can access `/worker/reviews` and `/worker/tasks` to view delegated revision or issue requests, complete adjustments, and submit the work back to the manager for review. Client reviews cannot be delegated or submitted through the worker revision flow.
- **AC-7**: Role-based access control enforces that clients only query and submit feedback for projects they own, managers only view reviews and resolve/delegate non-review requests for projects they manage, and workers only submit non-review requests assigned to them.
- **AC-8**: All headers adhere to the UI Design Standards: no decorative badge pills or eyebrows, high-contrast theme compatibility, and avatars routed through `getProfileImageSrc`.

## Data Model & Server Actions

1. **`lib/feedback.ts`**:
   - `getClientFeedbackData()`: retrieves client's assigned projects, deliverables, feedback tickets, and aggregate SLA stats.
   - `getManagerFeedbackData()`: retrieves manager's managed projects, associated deliverables, feedback tickets, and aggregate stats.

2. **`app/actions/feedback.ts`**:
   - `createClientFeedback(prevState, formData)`: validates role, project ownership, type-specific title/details/rating rules, and optional deliverable before inserting a `ClientFeedback` record.
   - `resolveFeedback(prevState, formData)`: validates manager role, project ownership, non-review type, and resolution note before updating status to `RESOLVED` and finishing associated deliverable tasks.
   - `delegateFeedbackToWorker(prevState, formData)`: validates manager role, non-review type, worker availability, and delegation instructions before transitioning feedback to `ASSIGNED_TO_WORKER` and returning the task to `IN_PROGRESS` with the manager's note.
   - `submitWorkerRevision(prevState, formData)`: validates worker role, assignment, and non-review type before transitioning feedback to `IN_REVIEW` and notifying the manager.

3. **Components & Routes**:
   - `components/feedback/feedback-workspace.tsx`: client component implementing the feedback workspace with Column Cards/Table view switcher, type-specific New Request modal, view-only client reviews for managers, manager request actions, and worker revision submission.
   - `app/(workspace)/client/project-feedback/page.tsx`: server component rendering Client Feedback.
   - `app/(workspace)/manager/reviews/page.tsx`: server component rendering Manager Reviews, Direct Resolution, and Worker Delegation.
   - `app/(workspace)/worker/reviews/page.tsx`: server component rendering Worker Assigned Reviews and Revision Submissions.
