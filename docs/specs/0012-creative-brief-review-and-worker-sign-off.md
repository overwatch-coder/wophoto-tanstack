# 0012. Creative Brief Review and Worker Sign Off for Studio Production

**Date**: 2026-10-26
**Status**: Complete

## Summary

This specification defines a collaborative brief review workspace for WoPhoto. It gives studio managers a structured place to author, upload, and link project briefs, shot lists, deliverable specifications, and visual guidelines. Assigned workers can inspect creative requirements, ask clarifying questions in a crew wide discussion, check off shot list items during shoots, and record formal sign off acknowledgments before production begins.

## Context

Commercial photography and video production rely on clear alignment between creative briefs and execution. In creative studios, miscommunication around deliverable formats, shot counts, lighting references, and brand guardrails leads to costly reshoots and missed deadlines.

Currently, project requirements in WoPhoto live in freeform task descriptions or unlinked external documents. Workers often begin shooting or editing without a confirmed understanding of creative expectations. When a manager updates guidelines mid project, workers on set have no clear indication that specifications changed.

WoPhoto needs a dedicated brief review hub linked to each project. Managers must be able to publish comprehensive briefs combining structured fields, uploaded PDF manuals, and external links like Figma, Notion, or Google Docs. Assigned team members must acknowledge their readiness through formal sign off, while managers track sign off readiness across the entire crew.

## Requirements

**User stories**:
- As a manager, I want to create and edit creative briefs with deliverables, shot lists, visual guidelines, and external design links so our production crew has complete project instructions.
- As a manager, I want to see which assigned workers have signed off on the brief and who still owes review so I can verify crew readiness before production starts.
- As a manager, I want to waive sign off for absent or exempt crew members with an audit note so production is not blocked.
- As a manager, I want to publish major brief revisions that request re acknowledgment from workers while preserving past sign off history for accountability.
- As a worker, I want to review the creative brief for projects I work on and see shot lists, references, and deliverable targets in one clean view.
- As a worker, I want to ask questions directly on the brief and receive manager answers before I commit to shooting or editing.
- As a worker, I want to update shot list progress on set so the team knows which setups are completed.
- As a worker, I want to submit a formal sign off acknowledgment with optional notes confirming I understand the creative direction.
- As a client, I want to view the published creative brief for my active projects in read only mode so I can confirm the studio understands our vision.

**Acceptance criteria**:
- **AC-1**: Managers can create, edit, publish, and complete creative briefs linked to projects, specifying title, summary, deliverables, visual guidelines, external links, file attachments, and structured shot lists.
- **AC-2**: A project can have one primary project brief and optional phase or shoot specific sub briefs (such as studio shoot versus location shoot).
- **AC-3**: Creative briefs progress through defined lifecycle states: Draft, In Review, Changes Requested, Approved, and Completed.
- **AC-4**: Publishing a brief snapshots all workers currently assigned to project tasks as required reviewers into pending sign off records, and managers can manually add or remove required worker reviewers.
- **AC-5**: Assigned workers can record a sign off acknowledgment with version verification, timestamp, and optional notes, changing their review status from Pending to Signed. Managers can waive a worker sign off with an audit reason.
- **AC-6**: When a manager publishes a major revision to an active brief, the brief version increments, existing sign offs are retained in the audit history, and workers receive new pending sign off records for the new version.
- **AC-7**: Workers and managers can participate in a crew wide brief discussion thread to ask clarification questions, post replies, and mark inquiries as resolved. Internal crew discussions are hidden from client view.
- **AC-8**: Clients can view published briefs for their owned projects in read only mode, with internal crew discussion threads and sign off notes hidden from client view.

## Options considered

### Option 1: External document links only

Link out to external Google Docs, Notion pages, or Figma files without native brief storage in WoPhoto.

**Pros**:
- Fast to implement with minimal schema changes.
- Lets managers write briefs in tools they already use.

**Cons**:
- No native shot list tracking or deliverable checklist within the app.
- Cannot enforce worker sign off or audit version acknowledgments.
- Breaks offline and on set readiness without active third party access.

### Option 2: Task level comments and attachments

Rely on existing task cards for brief attachments and use task comment threads for creative alignment.

**Pros**:
- Reuses existing task components and database relations.
- Requires no new navigation routes or review workflows.

**Cons**:
- Creative direction becomes scattered across dozens of individual tasks.
- No project wide view of overall shoot alignment or crew readiness.
- Difficult for clients and managers to audit team sign off as a unified milestone.

### Option 3: Integrated hybrid brief workspace with structured sections and sign off audit (Recommended)

Build a dedicated brief workspace supporting structured deliverables, interactive shot lists, rich guidelines, uploaded documents, external links, threaded questions, and versioned worker sign offs.

**Pros**:
- Provides a single source of truth for the entire creative team.
- Hybrid content model supports structured data, PDF uploads, and external Figma or Google Docs links.
- Versioned sign off creates clear accountability before expensive production days.
- Allows clients read only visibility into approved direction while keeping crew discussions private.

**Cons**:
- Requires new database models for briefs, sign offs, and brief questions.
- Requires state synchronization when tasks and project assignees update.

## Decision

**Chosen option**: Option 3: Integrated hybrid brief workspace with structured sections and sign off audit.

We will build a dedicated creative brief module within the workspace for managers and workers, providing full project brief authoring, versioned crew sign offs, and clarification discussions.

## Rationale

Photography and multimedia projects need structured deliverables and shot lists alongside visual guidelines. Forcing teams to search across individual tasks or third party links leads to missed shots and mismatched client expectations.

Option 3 delivers the exact balance needed: managers can paste external design links, upload brand guideline PDFs, or author native shot lists directly in WoPhoto. By coupling automated reviewer snapshot enrollment with versioned sign offs, production leads can verify crew readiness at a glance.

## Feature design

**Data model sketch**:

```prisma
enum BriefStatus {
  DRAFT
  IN_REVIEW
  CHANGES_REQUESTED
  APPROVED
  COMPLETED
}

enum SignOffStatus {
  PENDING
  SIGNED
  WAIVED
}

model CreativeBrief {
  id              String        @id @default(cuid())
  title           String
  summary         String?       @db.Text
  status          BriefStatus   @default(DRAFT)
  isPrimary       Boolean       @default(false)
  version         Int           @default(1)
  revisionSummary String?       @db.Text
  deliverables    String?       @db.Text
  guidelines      String?       @db.Text
  shotList        Json?
  externalUrl     String?
  fileUrl         String?
  fileKey         String?
  fileName        String?
  fileSize        Int?
  fileMime        String?
  tags            String[]      @default([])
  projectId       String
  project         Project       @relation(fields: [projectId], references: [id], onDelete: Cascade)
  createdById     String
  createdBy       User          @relation("CreatedCreativeBriefs", fields: [createdById], references: [id], onDelete: Restrict)
  signOffs        BriefSignOff[]
  questions       BriefQuestion[]
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt

  @@index([projectId, isPrimary])
  @@index([projectId, status])
  @@index([createdById])
  @@index([createdAt])
}

model BriefSignOff {
  id          String        @id @default(cuid())
  briefId     String
  brief       CreativeBrief @relation(fields: [briefId], references: [id], onDelete: Cascade)
  userId      String
  user        User          @relation("UserBriefSignOffs", fields: [userId], references: [id], onDelete: Cascade)
  version     Int           @default(1)
  status      SignOffStatus @default(PENDING)
  signedAt    DateTime?
  note        String?       @db.Text
  waivedById  String?
  waivedBy    User?         @relation("WaivedBriefSignOffs", fields: [waivedById], references: [id], onDelete: SetNull)
  waivedAt    DateTime?
  waiveReason String?       @db.Text
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt

  @@unique([briefId, userId, version])
  @@index([briefId, version, status])
  @@index([userId, status])
  @@index([createdAt])
}

model BriefQuestion {
  id           String          @id @default(cuid())
  briefId      String
  brief        CreativeBrief   @relation(fields: [briefId], references: [id], onDelete: Cascade)
  authorId     String
  author       User            @relation("BriefQuestionAuthors", fields: [authorId], references: [id], onDelete: Cascade)
  briefVersion Int             @default(1)
  content      String          @db.Text
  isResolved   Boolean         @default(false)
  isBlocker    Boolean         @default(false)
  parentId     String?
  parent       BriefQuestion?  @relation("BriefQuestionReplies", fields: [parentId], references: [id], onDelete: Cascade)
  replies      BriefQuestion[] @relation("BriefQuestionReplies")
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  @@index([briefId, createdAt])
  @@index([parentId])
  @@index([authorId])
}
```

**Shot list JSON schema**:

```typescript
export interface ShotItem {
  id: string; // nanoid or cuid
  title: string;
  description?: string;
  props?: string[];
  framing?: "WIDE" | "MEDIUM" | "CLOSE_UP" | "EXTREME_CLOSE_UP" | "TOP_DOWN" | "DETAIL";
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  order: number;
}
```

**State transitions**:
- `DRAFT`: Brief is created. Visible to managers only. Tasks can be edited freely without version increments.
- `IN_REVIEW`: Manager publishes the brief. System snapshots all workers currently assigned to project tasks into `BriefSignOff` records with `status = PENDING`. Assigned workers receive notification.
- `CHANGES_REQUESTED`: Workers flag blocking questions or manager pauses sign off pending updates.
- `APPROVED`: Required workers have signed off or been waived, or manager explicitly marks the brief ready for shoot.
- `COMPLETED`: Production wrapped and deliverables handed off.

**API surface**:

| Function / Action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createCreativeBrief` | Server Action | `projectId`, `title`, `summary`, `deliverables`, `guidelines`, `shotList`, `externalUrl`, `fileUrl`, `isPrimary` | `{ success, briefId }` | Manager | 401 unauthenticated, 403 forbidden, 404 project not found |
| `updateCreativeBrief` | Server Action | `id`, `title`, `summary`, `deliverables`, `guidelines`, `shotList`, `externalUrl`, `fileUrl`, `majorRevision?: boolean`, `revisionSummary?: string` | `{ success, briefId, version }` | Manager | 403 forbidden, 404 brief not found |
| `deleteCreativeBrief` | Server Action | `id` | `{ success }` | Manager | 403 forbidden, 404 brief not found |
| `publishCreativeBrief`| Server Action | `id` | `{ success, enrolledCount }` | Manager | 403 forbidden, 404 brief not found |
| `setBriefStatus` | Server Action | `id`, `status: BriefStatus`, `reason?: string` | `{ success }` | Manager | 403 forbidden, 400 invalid transition |
| `addBriefReviewer` | Server Action | `briefId`, `userId` | `{ success, signOffId }` | Manager | 403 forbidden, 404 user/brief not found |
| `removeBriefReviewer` | Server Action | `briefId`, `userId` | `{ success }` | Manager | 403 forbidden, 404 sign off not found |
| `waiveBriefSignOff` | Server Action | `briefId`, `userId`, `reason: string` | `{ success }` | Manager | 403 forbidden, 404 sign off not found |
| `submitBriefSignOff` | Server Action | `briefId`, `version: number`, `note?: string` | `{ success, signOffId }` | Worker | 403 forbidden, 409 version mismatch, 400 already signed |
| `updateShotItemStatus` | Server Action | `briefId`, `shotId`, `status: ShotItemStatus` | `{ success }` | Manager, Worker | 403 forbidden, 404 shot not found |
| `postBriefQuestion` | Server Action | `briefId`, `content`, `isBlocker?: boolean`, `parentId?: string` | `{ success, questionId }` | Manager, Worker | 403 forbidden, 400 empty content |
| `resolveBriefQuestion`| Server Action | `questionId`, `isResolved: boolean` | `{ success }` | Manager, Author | 403 forbidden, 404 question not found |
| `getProjectBriefs` | Server Function | `projectId`, `status?: BriefStatus` | `{ briefs, primaryBrief }` | Manager, Worker, Client | 401 unauthenticated, 403 forbidden |
| `getBriefDetail` | Server Function | `briefId` | `{ brief, signOffs, questions, readiness }` | Manager, Worker, Client | 404 not found, 403 forbidden |

**Value sourcing**:

| Action / View | Value produced / displayed | Source |
|---|---|---|
| Crew readiness metric | Percentage of crew ready for production | Derived: `(count(SIGNED) + count(WAIVED)) / total_enrolled_reviewers` where `version = brief.version` |
| Reviewer roster | List of workers who must sign off | Query: `BriefSignOff` records where `briefId = brief.id` and `version = brief.version` |
| Shot list counter | Completed vs total shots in brief | Derived: count of items in `brief.shotList` where `status = COMPLETED` divided by total shots |
| Re acknowledgment banner | Alert showing brief changed since sign off | Comparison: `userLatestSignOff.version < brief.version` |
| Author attribution | Creator avatar and name | Relation: `brief.createdBy` User record routed through `getProfileImageSrc` |

**Key invariants**:
- Exactly one brief per project may have `isPrimary = true`. When a brief is marked primary in a transaction, any existing primary brief on that project is set to `isPrimary = false`.
- Project deletion cascades to delete all associated briefs, sign offs, and questions.
- A worker sign off record is tied to a specific integer version of the brief. Major updates increment the version, reset status to `IN_REVIEW`, and snapshot enrolled reviewers into new `PENDING` sign off records without overwriting past history.
- `submitBriefSignOff` verifies `brief.version === input.version`, rejecting concurrent edits with 409 Conflict to protect workers from signing modified briefs blindly.
- Internal crew questions, sign off notes, and waive reasons are never returned in client scoped queries.

**Security model**:
- Managers: Full create, update, delete, publish, and status administration permissions across all studio briefs. Can resolve any discussion question, add or remove reviewers, and waive worker sign offs with an audit reason.
- Workers: Read access to briefs for projects where they are assigned to tasks or explicitly enrolled as reviewers. Can sign off on active briefs, toggle shot completion statuses on set, post crew questions, and resolve their own questions. Cannot edit brief text or delete briefs.
- Clients: Read only access to published briefs (`IN_REVIEW`, `APPROVED`, `COMPLETED`) for their owned projects. Client queries strictly omit `BriefQuestion` discussion threads, internal crew notes, and reviewer administration.

**Critical test scenarios**:
- Happy path: Manager creates a creative brief with deliverables and shot lists, publishes it to snapshot project task assignees, workers inspect and submit sign off, brief reflects full crew readiness, verifies AC-1, AC-4, AC-5.
- Major revision handling: Manager edits an active brief with major revision flag, brief version bumps from 1 to 2, previous sign offs remain in audit query, workers receive pending status for version 2, verifies AC-6.
- Version concurrency protection: Worker submits sign off for version 1 while manager publishes version 2, system rejects with 409 Conflict, prompts worker to review changes, verifies AC-5, AC-6.
- Waive sign off: Manager waives an absent worker with a recorded reason, readiness advances to 100%, brief status can transition to Approved, verifies AC-3, AC-5.
- Shot list updates: Worker on set updates shot item status from PLANNED to COMPLETED, counter updates live, verifies AC-1, AC-7.
- Discussion and Q&A: Worker posts a clarification question on the shot list, manager replies with clarification, question is marked resolved, verifies AC-7.
- Client isolation: Client visits the project brief page and can read the shot list and deliverables, but cannot view internal crew Q&A or sign off administration, verifies AC-8.
- Access boundary: Worker not assigned to a project is rejected with 403 when attempting to view or sign off on an internal brief, verifies AC-4.

## Build plan

## Live verification

- Manager created, published, and deleted a temporary brief for the Jossy Wedding project. The form displayed the project by name, and manager readiness and shot progress reflected the worker's changes.
- Client could read the published brief while internal reviewer and discussion controls remained absent; direct access to the manager brief route was denied.
- Assigned worker signed off on version 1 and changed the shot status to Completed. The workspace updated to 1/1 reviewer ready and 1/1 shots completed.
- The temporary verification brief was deleted after the checks. The manager workspace returned to its empty state.
- Responsive manager-form and worker-workspace checks passed at the tested desktop and mobile widths without horizontal overflow.
- The browser console retained one earlier Fast Refresh `useEffect` dependency-size warning from before the clean reload; it did not recur after reload and was not associated with a live-flow failure.

### Tracer Bullet slice: Core brief authoring, worker review, and sign off

1. Schema migration: Add `BriefStatus` enum, `SignOffStatus` enum, `CreativeBrief` model, `BriefSignOff` model, and `BriefQuestion` model to `prisma/schema.prisma` with compound indexes and reverse relations on `User` and `Project`. Run database migration, satisfies AC-1, AC-2, AC-3.
2. Validation layer: Create `lib/validation/briefs.ts` with Zod schemas for brief creation, updates, reviewer enrollment, sign offs, waive actions, shot item updates, and question submissions, satisfies AC-1, AC-4, AC-5, AC-7.
3. Data access queries: Build `lib/briefs.ts` with server queries for project briefs, crew readiness calculation, audit history, shot counts, and role filtered detail views, satisfies AC-2, AC-4, AC-8.
4. Server actions: Implement `app/actions/briefs.ts` with manager CRUD actions, publish snapshots, worker sign off submission with concurrency guards, waive actions, shot updates, and Q&A threading, satisfies AC-1, AC-3, AC-4, AC-5, AC-6, AC-7.
5. Brief UI components: Build `components/briefs/` including brief card, shot list viewer with status toggles, deliverable checklist, crew readiness bar, and sign off dialog, satisfies AC-1, AC-4, AC-5.
6. Q&A discussion component: Build `components/briefs/brief-discussion.tsx` with question threads, reply forms, resolution badges, and blocker tags, satisfies AC-7.
7. Workspace routes: Wire up `/manager/brief-review`, `/worker/brief-review`, and client project brief view `/client/brief-review`, removing placeholders from `[section]/page.tsx`, satisfies AC-1, AC-4, AC-8.
8. Automated testing: Create `test/briefs.test.ts` verifying CRUD, version incrementing on major revisions, worker sign off lifecycle, waive calculations, shot updates, discussion threading, and role security boundaries, satisfies AC-1, AC-5, AC-6, AC-8.

## Consequences

- Teams gain a single source of truth for production requirements before shoots begin.
- Managers have clear metrics on crew preparedness before production days.
- Workers have a direct channel to clarify ambiguous specs without cluttering general project task lists.
- Additional database storage for versioned sign off history and threaded questions.

## Follow-up

- In Slice 14 (Explore briefs and template library), connect standard brief templates to this brief engine so managers can spawn new project briefs from pre designed studio templates.
