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
| 3 | Data model & Google Auth | Foundation | in-progress |
| 4 | Navigation sidebar & layout shell | Slice 1 | in-progress |
| 5 | Task management & daily work log | Slice 2 | done |
| 6 | Performance dashboard & team analytics | Slice 3 | planned |
| 7 | Client portal & feedback system | Slice 4 | planned |

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

### 3. Data model & Google Auth · in-progress
Database schema and authentication service supporting Google social sign in and three user roles (Admin/Boss, Worker, Client).
**Done when:** users can sign in with Google, each user receives a role, and permissions protect restricted resources.
- [ ] Design it (spec): `/architect data model & Google Auth`

## Slice 1: Navigation sidebar & layout shell

### 4. Navigation sidebar & layout shell · in-progress
Shared workspace shell for managers, workers, and clients, using shadcn's `sidebar-07` icon collapsing layout and role specific destinations.
**Done when:** each role reaches its agreed landing page, sees only its navigation, and can use the responsive shell, theme control, account menu, and sign out safely.
- [x] Design it (spec): `/architect navigation sidebar & layout shell`
- [ ] Build it: `/develop navigation sidebar & layout shell`
  - [x] Add and adapt the `sidebar-07` components to WoPhoto's visual theme.
  - [x] Build the shared role navigation, active page title, theme control, account menu, and sign out action.
  - [x] Integrate role landing routes, manager invitations, worker and client placeholders, and disabled future destinations.
  - [ ] Add focused coverage for role access, responsive behavior, identity/theme fallbacks, and auth regressions.
- [ ] Verify it: `/check verify navigation sidebar & layout shell`
- [ ] Test it: `/test navigation sidebar & layout shell`
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

### 6. Performance dashboard & team analytics · needs a decision
Internal performance dashboard featuring key productivity metrics (active tasks per person, on-time delivery rate, workload balance index) and collaborator on-time bars.
**Done when:** administrators can view aggregated performance cards, weekly load trends, workload by service, and collaborator on-time ranking bars.
- [ ] Design it (spec): `/architect performance dashboard & team analytics`

## Slice 4: Client portal & feedback system

### 7. Client portal & feedback system · needs a decision
Dedicated client view allowing clients to track their photo project progress, log comments, submit complaints, and view updates from the team.
**Done when:** clients can access their dashboard, submit feedback or complaints, and administrators receive and respond to entries.
- [ ] Design it (spec): `/architect client portal & feedback system`

## Deferred
Out of scope for the initial MVP passes, kept so the plan stays honest.
- **Inventory management**: equipment check in and check out tracking · needs a decision
- **Schedule & calendar**: full studio calendar booking view · needs a decision
- **Brand asset library**: shared media asset repository · needs a decision
- **Automated notifications**: email and push alerts for task deadlines · needs a decision

## Legend

**The decision box.** Every feature carries exactly one, the sub-task whose label ends with `(spec)`. Skills locate it by that `(spec)` suffix. Every other box is an execution box.

- **Next step** = the first unticked box.
- **needs a decision** = run `/architect` first; otherwise straight to `/develop`.
- **Status** `planned` → `in-progress` → `done`, plus `existing` and `dropped`.
- **Workflow** = **Beta** (/develop, then /check verify, then /test).
