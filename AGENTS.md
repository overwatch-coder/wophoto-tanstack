<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project Instructions: WoPhoto

WoPhoto is a management and tracking application for photography and multimedia teams. It allows managers to track team capacity and productivity, workers to log tasks, and clients to monitor project status and submit feedback.

## Commands

- **Development:** `npm run dev`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Tests:** `npm test` (Vitest, single run)
- **Watch Tests:** `npm run test:watch`

## Testing Standards

- All unit and integration tests live in the `test/` directory.
- Test files follow the `*.test.ts` or `*.test.tsx` naming convention.
- Run `npm test` before committing any feature changes.
