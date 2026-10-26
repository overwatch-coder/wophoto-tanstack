# Verify: Explore Briefs and Template Library · spec 0013 · 2026-10-26

## Completed checks

- [x] **Data model and migration**: Verified `BriefTemplateCategory` enum, `BriefTemplate` model, indexes, and relations on `User` and `CreativeBrief` via `prisma db push` and `prisma generate`.
- [x] **Template creation, editing, and soft archival (AC-1, AC-8)**: Verified via automated unit tests in `test/brief-templates.test.ts` covering validation, authoring with tags/shotList, updating fields, soft archiving, and unarchiving.
- [x] **One-click brief conversion (AC-2)**: Verified that converting an existing project brief clones deliverables, guidelines, summary, attachments, resets shot statuses to `PLANNED`, and links `sourceBriefId`.
- [x] **Template instantiation and deep cloning (AC-3, AC-4)**: Verified transactional instantiation into both existing projects and newly created projects with invited client validation, deep cloning of shot items with fresh UUIDs, `DRAFT` status assignment, `isPrimary` reset, and `usageCount` incrementation.
- [x] **Explore workspace and filtering (AC-5)**: Verified query functions for category filtering, distinct studio tags, search queries, pagination defaults (12 per page), and tab switching between reusable templates and studio archive.
- [x] **Worker exploration and data scrubbing (AC-6)**: Verified that workers can query active templates and studio brief archives, while client contact emails and internal crew comments are stripped for unassigned projects.
- [x] **Client security boundary (AC-7)**: Verified that clients receive 403 Forbidden when calling template server actions and cannot access explore routes.
- [x] **Automated test suite**: Ran `npm test` (42 files passed, 307 total tests passed including 15 dedicated tests in `test/brief-templates.test.ts`).
- [x] **TypeScript typecheck**: Ran `npm run typecheck` (0 errors).
- [x] **Code quality & linting**: Ran ESLint over all modified and newly created template files (0 errors).
- [x] **Production build**: Ran `npm run build` (compiled all 55 Next.js App Router routes cleanly with Turbopack, including `/manager/explore-briefs` and `/worker/explore-briefs`).

## Verification limits

- File uploads for covers and attachments use mock/real Vercel Blob endpoints depending on local environment tokens; integration upload validation was verified against file size and mime type constraints.
- Live interactive browser verification with simulated click-through across multiple authenticated browser profiles (manager vs worker) is available for end-to-end user acceptance testing.
