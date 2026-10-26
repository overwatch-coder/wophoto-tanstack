# 0013. Explore Briefs and Template Library for Production Reuse

**Date**: 2026-10-26
**Status**: Accepted

## Summary

This specification introduces a creative brief template library and studio brief exploration portal for WoPhoto. Studio managers can create reusable master templates, convert past successful project briefs into templates with one click, and spin up new project briefs with deep copied shot lists and deliverable guidelines. Assigned workers gain read only access to past briefs and templates to study visual references and lighting setups, while clients remain restricted to their own projects.

## Requirements

**User stories**:
- As a manager, I want to create, edit, and organize reusable brief templates with default deliverables, visual guidelines, reference links, and structured shot lists so our studio saves time starting new productions.
- As a manager, I want to convert any active or completed project brief into a reusable template with one click so past creative setups become reusable studio assets.
- As a manager, I want to instantiate a template directly into an existing project or spin up a new project shell with the brief pre filled in one flow so project setup is fast and error free.
- As a manager, I want to archive outdated templates without deleting them so existing projects are never broken and past usage statistics remain accurate.
- As a worker, I want to explore past published briefs and templates to review lighting setups, composition notes, and framing guides before going on set.
- As a client, I should only see briefs for projects I own, never internal studio templates or briefs belonging to other clients.

**Acceptance criteria**:
- **AC-1**: Managers can create, edit, archive, and unarchive reusable brief templates with title, summary, category, tags, deliverables, guidelines, external links, cover preview image, file attachments, and structured shot lists.
- **AC-2**: Managers can convert any active or completed project creative brief they manage into a reusable template with a single action, copying guidelines and resetting shot list items to planned status while preserving the link to the originating brief.
- **AC-3**: Managers can instantiate a new creative brief from a template either into an existing project or by creating a new project shell and attaching the instantiated brief in one transactional flow.
- **AC-4**: Brief instantiation performs a deep clone of template content, generating new unique identifiers for every shot item, setting brief status to draft, and resetting all shot statuses to planned. Instantiation increments the template usage count.
- **AC-5**: The Explore Briefs workspace provides separate filterable views for reusable templates and the studio brief archive, supporting keyword search, category filtering, tag selection, client filtering, default page size of 12, and pagination.
- **AC-6**: Workers have read only exploration access across active and completed studio briefs and templates for lighting references, technical requirements, and production examples. In the archive view, internal crew discussions, sign off notes, and client contact details are scrubbed for non assigned workers.
- **AC-7**: Clients are restricted from accessing the explore briefs portal, template library, and other projects' brief archives.
- **AC-8**: Template archiving uses soft deletion, keeping historical project briefs unaffected and allowing managers to unarchive or reactivate templates at any time.

## Decision

**Chosen option**: Option 2: Dedicated BriefTemplate model with deep clone instantiation

We will store reusable brief templates in a dedicated `BriefTemplate` model with structured categories, searchable tags, and deep clone mechanics for instantiation.

## Rationale

Reasoning and options: see [rationale.md](rationale.md).

## Feature design

**Data model sketch**:

```prisma
enum BriefTemplateCategory {
  COMMERCIAL
  EDITORIAL
  ECOMMERCE
  LOOKBOOK
  PORTRAIT
  VIDEO_PRODUCTION
  SOCIAL_MEDIA
  OTHER
}

model BriefTemplate {
  id             String                 @id @default(cuid())
  title          String
  summary        String?
  category       BriefTemplateCategory  @default(COMMERCIAL)
  tags           String[]               @default([])
  deliverables   String?
  guidelines     String?
  externalLinks  Json?
  shotList       Json?
  coverImageUrl  String?
  attachmentUrl  String?
  attachmentName String?
  usageCount     Int                    @default(0)
  isArchived     Boolean                @default(false)
  createdById    String
  createdBy      User                   @relation("CreatedBriefTemplates", fields: [createdById], references: [id])
  sourceBriefId  String?
  sourceBrief    CreativeBrief?         @relation("BriefToTemplate", fields: [sourceBriefId], references: [id], onDelete: SetNull)
  derivedBriefs  CreativeBrief[]        @relation("TemplateToBrief")
  createdAt      DateTime               @default(now())
  updatedAt      DateTime               @updatedAt

  @@index([category, isArchived])
  @@index([isArchived, createdAt])
  @@index([createdById])
}
```

On `CreativeBrief`, add:
- `templateId String?`
- `sourceTemplate BriefTemplate? @relation("TemplateToBrief", fields: [templateId], references: [id], onDelete: SetNull)`
- `mintedTemplates BriefTemplate[] @relation("BriefToTemplate")`

On `User`, add:
- `createdBriefTemplates BriefTemplate[] @relation("CreatedBriefTemplates")`

**State transitions**:

Template lifecycle:
- `Active`: available in the template picker, increments usage count when instantiated.
- `Archived`: hidden from default picker, preserved in archived list, can be restored by a manager.

**API surface**:

| Endpoint / Action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createBriefTemplate` | Server Action | title (req), summary (opt), category (req), tags (opt), deliverables (opt), guidelines (opt), externalLinks (opt), shotList (opt), coverImageUrl (opt), attachmentUrl (opt), attachmentName (opt) | templateId, success | Manager | 400 invalid, 401 unauth, 403 forbidden |
| `updateBriefTemplate` | Server Action | id (req), title, summary, category, tags, deliverables, guidelines, externalLinks, shotList, coverImageUrl, attachmentUrl, attachmentName | templateId, success | Manager | 400 invalid, 404 not found, 403 forbidden |
| `archiveBriefTemplate` | Server Action | id (req) | success | Manager | 404 not found, 403 forbidden |
| `unarchiveBriefTemplate` | Server Action | id (req) | success | Manager | 404 not found, 403 forbidden |
| `convertBriefToTemplate` | Server Action | briefId (req), title (req), category (req), tags (opt) | templateId, success | Manager (project owner) | 400 invalid, 404 not found, 403 forbidden |
| `instantiateBriefFromTemplate` | Server Action | templateId (req), target: `{ type: "EXISTING_PROJECT", projectId, isPrimary?: boolean, title?: string }` or `{ type: "NEW_PROJECT", projectName, clientId, description?: string, title?: string }` | briefId, projectId, success | Manager | 400 invalid, 404 not found, 403 forbidden |
| `uploadTemplateCover` | Server Action | formData: file (req, max 10MB, image only) | coverImageUrl, success | Manager | 400 invalid file, 403 forbidden |
| `uploadTemplateAttachment` | Server Action | formData: file (req, max 25MB, pdf or zip or doc) | attachmentUrl, attachmentName, success | Manager | 400 invalid file, 403 forbidden |
| `getBriefTemplates` | Query function | category (opt), search (opt), tag (opt), includeArchived (opt), page (opt, default 1), pageSize (opt, default 12) | templates, total, page, pageSize, availableTags | Manager, Worker (active only) | 401 unauth |
| `getStudioBriefArchive` | Query function | search (opt), projectId (opt), clientId (opt), status (opt), page (opt, default 1), pageSize (opt, default 12) | briefs, total, page, pageSize | Manager, Worker (scrubbed) | 401 unauth, 403 forbidden for client |

**Value sourcing**:

| Action | Value produced / displayed | Source |
|---|---|---|
| `getBriefTemplates` | Template cards with title, summary, category, tags, usageCount, and cover image | DB columns on `BriefTemplate` |
| `getStudioBriefArchive` | Completed and approved studio briefs | DB query on `CreativeBrief` filtering for `status != DRAFT` |
| `convertBriefToTemplate` | Template shot list and guidelines | Deep copied from `CreativeBrief.shotList` (resetting shots to `PLANNED`), `deliverables`, `guidelines`, `summary`, `fileUrl`, `fileName` |
| `instantiateBriefFromTemplate` | New project brief with fresh shot item IDs | Deep copied from `BriefTemplate.shotList` with random UUIDs and `PLANNED` status |
| `instantiateBriefFromTemplate` | Project reference for instantiated brief | Selected existing `Project.id` or newly created `Project.id` with `managerId: user.id` |
| `instantiateBriefFromTemplate` | Updated template popularity metric | Increment `BriefTemplate.usageCount` by 1 inside transaction |

**Key invariants**:
- Brief instantiation runs inside a database transaction (`prisma.$transaction`).
- When instantiating into a new project, the action validates that `clientId` belongs to an active client invited by that manager (`acceptedInvitation.invitedById == manager.id`). The created brief is automatically marked `isPrimary: true` and `status: DRAFT`.
- When instantiating into an existing project, if `isPrimary` is requested, all existing primary briefs on that project are toggled to `isPrimary: false` before inserting the new brief.
- Brief instantiation always performs a deep copy of all shot items and resets their status to `PLANNED` so new shoot crews start with a clean slate.
- Each cloned shot item receives a fresh unique identifier to prevent collisions with existing shots.
- Archiving a template never deletes or alters project briefs previously created from it (`onDelete: SetNull`).
- Workers can inspect all active templates and published studio briefs for reference, but crew Q and A discussions, sign off notes, and client contact details are omitted for unassigned workers.
- Clients are completely barred from accessing `/manager/explore-briefs` and `/worker/explore-briefs`.
- UI surfaces conform strictly to project design standards: zero decorative eyebrow or subrow pill badges, and all user avatars routed through `getProfileImageSrc(image, userId)`.

**Security model**:
- Manager role: full permissions to browse, search, create, update, archive, convert, and instantiate templates.
- Worker role: read only exploration of active templates and non draft studio briefs for technical reference.
- Client role: strictly forbidden; cannot view other projects' briefs or internal studio templates.

**Configuration required**:
- None. Uses existing PostgreSQL database, Prisma ORM, and Vercel Blob storage (`brief-templates/covers/` and `brief-templates/attachments/`).

**Critical test scenarios**:
- Happy path: Manager creates a template with categories, tags, and shot list, then instantiates it into a new project shell, verifying **AC-1**, **AC-3**, **AC-4**, and **AC-5**.
- Conversion: Manager converts an existing project brief into a reusable template with one click, resetting shot item statuses to planned, verifying **AC-2**.
- Deep cloning and transaction: Instantiating a template generates fresh shot item IDs, sets status to draft, and increments usage count, verifying **AC-3** and **AC-4**.
- Role authorization and privacy: Worker can read templates and past briefs with crew discussions scrubbed, but is blocked from creating or modifying templates; client receives 403 forbidden, verifying **AC-6** and **AC-7**.
- Soft archival: Archiving a template hides it from the default picker, keeps historical briefs intact, and allows restoration, verifying **AC-8**.

## Build plan

- [x] 1. Create database schema updates with `BriefTemplateCategory` enum, `BriefTemplate` model, and relations on `User` and `CreativeBrief`, then run database migration, satisfies **AC-1**, **AC-8**
- [x] 2. Create validation schemas in `lib/validation/brief-templates.ts` for template authoring, conversion, instantiation, and query filtering, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**
- [x] 3. Implement data access functions in `lib/brief-templates.ts` for querying templates, studio tags, and studio brief archive with role based filtering and data scrubbing, satisfies **AC-5**, **AC-6**, **AC-7**
- [x] 4. Implement server actions in `app/actions/brief-templates.ts` for creating, updating, archiving, unarchiving, converting, uploading assets, and instantiating templates with usage tracking and project creation transactions, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-8**
- [x] 5. Build UI components in `components/brief-templates/` for template grid, template dialog, instantiation modal, cover uploader, and studio brief archive viewer, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-5**
- [x] 6. Wire route pages at `app/(workspace)/manager/explore-briefs/page.tsx` and `app/(workspace)/worker/explore-briefs/page.tsx`, and add Explore Briefs to worker navigation, satisfies **AC-5**, **AC-6**, **AC-7**
- [x] 7. Write automated test suite in `test/brief-templates.test.ts` covering CRUD, conversion, instantiation deep cloning, search filters, and role restrictions, satisfies **AC-1**, **AC-2**, **AC-3**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**

## Consequences

**Positive**:
- Eliminates redundant manual data entry for recurring photography shoots.
- Centralizes studio visual standards, lighting notes, and shot patterns into reusable assets.
- Provides workers on set with easy access to past studio references and successful shoot setups.

**Negative / tradeoffs**:
- Introduces another database entity and associated UI components to maintain.
- Managers must curate templates periodically so outdated lighting guides do not clutter the library.

**Neutral**:
- Templates copy guidelines at instantiation time; future updates to a template do not retroactively alter already instantiated project briefs.

## Follow-up

- [ ] Add one click template cloning directly from the brief review workspace (`/manager/brief-review`) as an action button on approved briefs.
