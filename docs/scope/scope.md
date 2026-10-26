# Scope: WoPhoto

WoPhoto is a management and workflow platform that allows administrators to track team productivity, workers to log and manage tasks, and clients to submit feedback or complaints through a dedicated portal.

**Build approach:** Tracer Bullet (vertical slices; each feature built end to end through every layer, working).
**Workflow:** Beta (/develop, then /check verify, then /test). The project default level of rigor. /architect is the recommended first stop for a feature with a real decision, but skippable when you already know the build. Any feature can carry its own tag to do more or less.

_These are recommendations to keep your build orderly, not requirements. Skip anything that does not fit: if you already know how to build a feature, use /develop and skip /architect. You decide when a feature is done._

## At a glance

| # | Feature | Phase | Status |
|---|---------|-------|--------|
| 1 | Stack & testing architecture | Foundation | done |
| 2 | Design system & orange theme | Foundation | done |
| 3 | Data model & Google Auth | Foundation | done |
| 4 | Navigation sidebar & layout shell | Slice 1 | done |
| 5 | Task management & daily work log | Slice 2 | done |
| 6 | Performance dashboard & team analytics | Slice 3 | done |
| 7 | Client portal & feedback system | Slice 4 | done |
| 8 | Deleted tasks archive & recovery | Slice 5 | done |
| 9 | Settings & user preferences | Slice 6 | done |
| 10 | Notification center & delivery | Slice 7 | done |
| 11 | AI Studio Copilot & smart navigation | Slice 8 | done |
| 12 | Inventory management | Slice 9 | done |
| 13 | Schedule & calendar | Slice 10 | done |
| 14 | Brand asset library | Slice 11 | in-progress |
| 15 | Client work requests & intake | Slice 12 | done |
| 16 | Creative brief review & worker sign-off | Slice 13 | planned |
| 17 | Explore briefs & template library | Slice 14 | planned |

## Foundations

### 1. Stack & testing architecture · done
Base Next.js App Router project with Tailwind CSS v4, shadcn/ui components, and Vitest test suite configured under test/.
**Done when:** the project compiles cleanly, paths resolve via `@/`, and tests run without errors.
- [x] Scaffold Next.js project with Tailwind and shadcn: `/develop stack`
- [x] Configure Vitest test runner and test directory: `/test setup`
- [x] Verify baseline tests and typecheck pass: `/test`
code in `./`

### 2. Design system & orange theme · done
Primary orange brand palette, dark background styling matching the reference screens, modern sans-serif typography, and light mode fallback.
**Done when:** CSS tokens provide the orange accent color, dark and light modes switch smoothly, and typography renders cleanly across components.
- [x] Design it (spec): `/architect design system & orange theme`
- [x] Configure CSS tokens and theme variables in globals.css: `/develop theme`
- [x] Verify theme tokens with automated tests: `/test`
Spec 0002 · code in `app/globals.css`

### 3. Data model & Google Auth · done
Database schema and authentication service supporting Google social sign in and three user roles (Manager, Worker, Client).
**Done when:** users can sign in with Google, each user receives a role, and permissions protect restricted resources.
- [x] Review the existing Prisma schema, invitation gated Google sign in, role assignment, and server side access checks.
Implementation in `prisma/schema.prisma`, `auth.ts`, and `lib/authz.ts`; no separate design spec was needed for this existing implementation.

## Slice 1: Navigation sidebar & layout shell

### 4. Navigation sidebar & layout shell · done
Shared workspace shell for managers, workers, and clients, using shadcn's `sidebar-07` icon collapsing layout and role specific destinations.
**Done when:** each role reaches its landing page, sees only its navigation, and can use the responsive shell, theme control, account menu, and sign out safely.
- [x] Design it (spec): `/architect navigation sidebar & layout shell`
- [x] Build it: `/develop navigation sidebar & layout shell`
  - [x] Add and adapt the `sidebar-07` components to WoPhoto's visual theme.
  - [x] Build the shared role navigation, active page title, theme control, account menu, and sign out action.
  - [x] Integrate role landing routes and active destinations for manager, worker, and client workspaces.
  - [x] Add focused tests for role navigation, route titles, mobile Escape handling, and authentication; review page-level role guards.
- [x] Verify it: `/check verify navigation sidebar & layout shell` (desktop/mobile shell checked; see spec verify record)
- [x] Test it: `/test navigation sidebar & layout shell` (`npm test`, 63 tests passed; `npm run typecheck` passed)
Spec 0003 · `docs/specs/0003-role-aware-navigation-shell/index.md` · code in `app/(workspace)/`, `app/actions/auth.ts`, `components/workspace/`, `lib/navigation.ts`

## Slice 2: Task management & daily work log

### 5. Task management & daily work log · done
Task list and grid view where workers log daily tasks, update status, track deadlines, and administrators assign work and review progress.
**Done when:** workers can create and update tasks, filter by priority and status, and view due dates in table and board views.
- [x] Design it (spec): `/architect task management & daily work log`
- [x] Build it: `/develop task management & daily work log`
  - [x] Extend task records and migrate assignment-level progress and daily entry dates. (AC-1, AC-3, AC-5, AC-6)
  - [x] Build role-scoped task reads and create, edit, and progress actions. (AC-1, AC-2, AC-3, AC-4, AC-10)
  - [x] Implement transactional review, return, approval, and soft deletion. (AC-5, AC-6, AC-7, AC-10)
  - [x] Build Table, Board, and Daybook views with filters, grouping, and accessible drag and drop. (AC-8, AC-9)
- [x] Verify it: `/check verify task management & daily work log`
- [x] Test it: `/test task management & daily work log`
Spec 0004 · `../specs/0004-task-management-and-daily-work-log.md` · code in `app/(workspace)/`, `app/actions/`, `components/tasks/`, `lib/`

## Slice 3: Performance dashboard & team analytics

### 6. Performance dashboard & team analytics · done
Internal performance dashboard featuring key productivity metrics (active tasks per person, on-time delivery rate, workload balance index) and collaborator on-time bars.
**Done when:** administrators can view aggregated performance cards, weekly load trends, workload by service, and collaborator on-time ranking bars.
- [x] Design it (spec): `/architect performance dashboard & team analytics`
- [x] Build it: `/develop performance dashboard & team analytics`
- [x] Verify it: `/check verify performance dashboard & team analytics`
- [x] Test it: `/test performance dashboard & team analytics`
Spec 0005 · `docs/specs/0005-performance-dashboard-and-team-analytics.md` · code in `app/(workspace)/`, `components/dashboard/`, `lib/analytics.ts`

## Slice 4: Client portal & feedback system

### 7. Client portal & feedback system · done
Dedicated client view allowing clients to track their photo project progress, log comments, submit complaints, and view updates from the team.
**Done when:** clients can access their dashboard, submit feedback or complaints, and administrators receive and respond to entries.
- [x] Design it (spec): Option C approved (`docs/specs/0006-client-feedback-system.md`)
- [x] Build it: `/develop client portal & feedback system`
- [x] Verify it: `/check verify client portal & feedback system`
- [x] Test it: `/test client portal & feedback system`
Spec 0006 · `docs/specs/0006-client-feedback-system.md` · code in `app/(workspace)/client/project-feedback/`, `app/(workspace)/manager/reviews/`, `components/feedback/`, `lib/feedback.ts`

## Slice 5: Deleted tasks archive & recovery

### 8. Deleted tasks archive & recovery · done
Give managers a paginated archive for deleted tasks, with filters, retention details, and safe restore or permanent removal actions.
**Done when:** managers can find deleted tasks without loading the entire archive, restore one or more tasks, and permanently remove selected items with confirmation.
- [x] Build it: `/develop deleted tasks archive & recovery`
  - [x] Add manager scoped deleted task queries with capped pagination, search, project and priority filters.
  - [x] Add single and batch restore, permanent deletion, and empty trash actions with confirmation.
  - [x] Build the shadcn table with retention countdowns and automatically applied filters with debounced search.
- [x] Verify it: `/check verify deleted tasks archive & recovery`
- [x] Test it: `/test deleted tasks archive & recovery`
Code in `app/(workspace)/manager/deleted-tasks/`, `components/tasks/deleted-tasks-view.tsx`, `app/actions/tasks.ts`, and `lib/tasks.ts`

## Slice 6: Settings & user preferences

### 9. Settings & user preferences · done
Give managers, workers, and clients a shared place to manage profile details, appearance, notification delivery preferences, and role specific defaults.
**Done when:** each role can save supported settings, see them applied in the workspace, and manage its account and alert preferences.
- [x] Build it: `/develop settings & user preferences`
  - [x] Save profile, location, theme, density, and role specific preferences.
  - [x] Configure notification channels and alert behavior.
  - [x] Add account security and connected sign in details.
- [x] Test it: `/test settings & user preferences`
Code in `components/settings/profile-settings.tsx`, `app/actions/settings.ts`, `lib/user-preferences.ts`, and `lib/validation/settings.ts`

## Slice 7: Notification center & delivery

### 10. Notification center & delivery · done
Show each user role its own activity, unread counts, and action links, with in app updates and configurable email delivery.
**Done when:** managers, workers, and clients receive role scoped notifications, can act from the notification links, and can browse older messages incrementally.
- [x] Build it: `/develop notification center & delivery`
  - [x] Add role scoped notification records, counts, and cursor based pages.
  - [x] Add real time updates, action links, and the notification center.
  - [x] Deliver configured email alerts and scheduled deadline reminders.
- [x] Test it: `/test notification center & delivery`
Code in `lib/notifications.ts`, `lib/email.ts`, `app/api/notifications/`, `app/actions/notifications.ts`, and `components/notifications/`

## Slice 8: AI Studio Copilot & smart navigation

### 11. AI Studio Copilot & smart navigation · done
Give each workspace role a floating assistant that searches studio records, runs permitted tools, and links users directly to relevant work.
**Done when:** the assistant streams replies, respects role and action safety rules, processes multimodal file attachments (images, PDFs, documents, spreadsheets), and completes tool calls with each configured provider integration.
- [x] Design it (spec): `docs/specs/0007-ai-studio-agent-and-smart-navigation.md`
- [x] Build it: `/develop AI Studio Copilot & smart navigation`
  - [x] Add encrypted provider settings, model selection, and server side key resolution.
  - [x] Add role checked search, capacity, deadline, navigation, and approved write tools.
  - [x] Add the floating copilot, command center, and streamed tool traces.
  - [x] Integrate provider specific chat paths and model catalogs.
  - [x] Add attachment upload UI (paperclip / drag and drop with file preview chips) to floating copilot and command center.
  - [x] Build server-side file and document ingestion pipeline (images via native vision, spreadsheets/csv, PDFs, Word docs).
  - [x] Extract structured project and task parameters from uploaded briefs or spreadsheets and feed them into tool proposals.
  - [x] Add role-scoped inventory queries and confirmation-only inventory action proposals for managers and workers; clients cannot access inventory.
- [x] Verify it: test image screenshot analysis and document-driven task creation end to end, including vision fallback handling.
  - [x] In the manager browser session, attach an image, an XLSX with three distinct task rows, a PDF, and a DOCX; confirm image analysis and extracted document content.
  - [x] Inspect a task proposal and verify each title, assignee, and due date; do not apply the proposal during verification.
  - [x] Verify an unmatched spreadsheet assignee is reported and requires correction instead of being assigned to another worker.
  - [x] Add route tests proving known text-only image models are rejected before provider calls and supported vision models continue; existing role-scoped query and confirmation tests cover client/worker boundaries.
  - [x] Verify inventory query routing and confirmation boundaries with focused role and proposal tests; full Vitest, typecheck, and production build pass.
- [x] Test it: `/test AI Studio Copilot & smart navigation` (automated tests for file validation, size limits, and role access).
Spec 0007 · code in `components/ai/`, `app/api/chat/`, and `lib/ai/`

## Slice 9: Inventory management

### 12. Inventory management · done
Track shared studio equipment, computing gear, and creative project assets so teams know what is available, what is in use, and who has each item.
**Done when:** managers can record items with optional custom metadata, workers can self checkout and return items with condition logging, and damage flags transition items into maintenance.
- [x] Design it (spec): `docs/specs/0008-inventory-management.md`
- [x] Build it: `/develop inventory management`
  - [x] Add Prisma schema models (`InventoryItem`, `InventoryLoan`, `InventoryMaintenanceLog`) with concurrency indexes and migrations (AC-1, AC-2, AC-5).
  - [x] Build data access queries and server actions with role checks and atomic checkout locking (AC-1, AC-3, AC-4, AC-5, AC-8, AC-9, AC-10).
  - [x] Build inventory catalog view with live search, category tabs, and status badges (AC-1, AC-3).
  - [x] Build manager item creation, editing, and retirement modal (AC-1, AC-2, AC-9).
  - [x] Build worker self checkout modal, return modal with condition logging, and manager maintenance drawer (AC-4, AC-6, AC-7, AC-8).
- [x] Verify it: `/check verify inventory management`
- [x] Test it: `/test inventory management`
Spec 0008 · code in `app/actions/inventory.ts`, `lib/inventory.ts`, `components/inventory/`, and `app/(workspace)/`

## Slice 10: Schedule & calendar

### 13. Schedule & calendar · done
Coordinate studio bookings, shoots, and work deadlines in a shared schedule.
**Done when:** managers can create and update studio events without conflicts, and managers and workers can view relevant bookings and deadlines.
- [x] Design it (spec): `docs/specs/0010-schedule-and-calendar.md`
- [x] Build it: `/develop schedule & calendar`
  - [x] Add `ScheduleEventType` enum and `ScheduleEvent` model to `prisma/schema.prisma` with indexes and relations, run migration (AC-1, AC-2).
  - [x] Create validation schemas in `lib/validation/schedule.ts` for event creation, updates, and conflict queries (AC-1, AC-2).
  - [x] Implement data queries and server actions in `lib/schedule.ts` and `app/actions/schedule.ts` supporting CRUD, soft conflict detection, and task deadline merging (AC-1, AC-2, AC-3, AC-5, AC-8).
  - [x] Build custom calendar grid components in `components/schedule/` supporting Month, Week, and Day agenda views with responsive controls (AC-4, AC-7).
  - [x] Build event creation and editing modal in `components/schedule/event-dialog.tsx` with location presets, worker multi select, and soft conflict warning banners (AC-1, AC-3).
  - [x] Wire page routes in `app/(workspace)/manager/schedule/page.tsx` and `app/(workspace)/worker/schedule/page.tsx`, removing placeholders from `[section]/page.tsx` (AC-4, AC-6, AC-8).
- [x] Verify it: `/check verify schedule & calendar`
- [x] Test it: `/test schedule & calendar` (automated tests for CRUD, bounds, soft conflicts, and worker isolation)
Spec 0010 · code in `app/actions/schedule.ts`, `lib/schedule.ts`, `components/schedule/`, and `app/(workspace)/`

## Slice 11: Brand asset library

### 14. Brand asset library · in-progress
Store and share approved brand media and reference files with the right project teams.
**Done when:** authorized users can find, preview, and manage shared brand assets with clear access rules.
- [x] Design it (spec): `docs/specs/0011-brand-asset-library.md`
- [x] Build it: `/develop brand asset library`
  - [x] Add `BrandAssetType` enum and `BrandAsset` model to `prisma/schema.prisma` with indexes and relations, add deployable migration (AC-1, AC-2).
  - [x] Create validation schemas in `lib/validation/brand-assets.ts` with hex color validation, source requirement checks, and file constraints (AC-1, AC-3, AC-4).
  - [x] Implement data access queries and server actions in `lib/brand-assets.ts` and `app/actions/brand-assets.ts` with role checks, client inheritance, and blob cleanup (AC-1, AC-4, AC-5, AC-7, AC-8).
  - [x] Build asset library components in `components/brand-assets/` including paginated card and table layouts, debounced search, category filters, color swatches, previews, and file download controls (AC-2, AC-3, AC-5, AC-6).
  - [x] Build asset creation and editing dialog in `components/brand-assets/brand-asset-dialog.tsx` supporting drop zone batch uploads, previews, external URLs, and dynamic swatch rows (AC-1, AC-3, AC-4, AC-7).
  - [x] Wire page routes in `app/(workspace)/manager/brand-assets/page.tsx` and `app/(workspace)/worker/brand-assets/page.tsx`, removing placeholders from `[section]/page.tsx` (AC-5, AC-6, AC-8).
- [ ] Verify it: `/check verify brand asset library` (manager route and table actions verified in an authenticated manager session; real private Blob upload still needs live verification)
- [x] Test it: `npm test` (40 files, 268 tests; includes upload authorization, validation, cleanup ordering, and combined filters)
Spec 0011 · code in `app/actions/brand-assets.ts`, `lib/brand-assets.ts`, `components/brand-assets/`, and `app/(workspace)/`

## Slice 12: Client work requests & intake

### 15. Client work requests & intake · done
Let clients request work on owned projects or propose a new project, track request status, and let managers review requests and create the project and assigned work after approval.
**Done when:** clients can submit and track either request type from the portal or Copilot, and managers can respond, decline, or approve requests by creating assigned work.
- [x] Design it (spec): `docs/specs/0009-client-work-requests-and-intake.md`
- [x] Build it: `/develop client work requests & intake`
  - [x] Add request records, ownership checks, and status actions.
  - [x] Build client request submission and status tracking.
  - [x] Build manager request triage and task conversion.
  - [x] Add Copilot request drafting and explicit submit confirmation.
- [x] Verify it: `/check verify client work requests & intake`
  - [x] Browser: client request table, existing-project and new-project forms, and manager triage/detail with accept-and-assign controls.
  - [x] Worker access: request records are not exposed to workers; approved requests create assigned tasks and notify the selected workers. The worker browser profile available in this session was signed out, so this role boundary was verified with automated tests rather than an authenticated worker browser session.
- [x] Test it: `/test client work requests & intake` (`npm test`, 37 files and 233 tests passed)
Spec 0009 · code in `app/(workspace)/client/`, `app/(workspace)/manager/`, `app/actions/work-requests.ts`, `components/work-requests/`, and `lib/ai/`

## Slice 13: Creative brief review & worker sign-off · needs a decision

### 16. Creative brief review & worker sign-off · planned · needs a decision
Provide a collaborative review workspace for project and shoot briefs so workers and managers align on deliverable specs, shot lists, and creative guidelines before production starts.
**Done when:** managers can author or link project briefs, workers can inspect assigned project briefs and submit questions or sign-off acknowledgments, and managers can track team readiness.
- [ ] Design it (spec): `/architect creative brief review & worker sign-off`

## Slice 14: Explore briefs & template library · needs a decision

### 17. Explore briefs & template library · planned · needs a decision
Provide a discovery portal and template repository for managers to search past studio briefs, organize standard creative brief templates, and spin up new projects from templates.
**Done when:** managers can search and filter the studio brief catalog across campaigns and services, create reusable templates, and generate new project briefs from templates.
- [ ] Design it (spec): `/architect explore briefs & template library`

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix. Every other box is an execution box.

- **Next step** = the first unticked box.
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`.
- **Status** `planned` → `in-progress` → `done`, plus `existing` and `dropped`.
- **Workflow** = **Beta** (/develop, then /check verify, then /test).
