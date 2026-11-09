# Project Instructions: WoPhoto

WoPhoto is a management and tracking application for photography and multimedia teams. It allows managers to track team capacity and productivity, workers to log tasks, and clients to monitor project status and submit feedback.

## Build approach

Tracer Bullet: build each feature end to end through every layer, keeping each slice working.

## Commands

- **Development:** `npm run dev`
- **Database (Start/Status/Stop):** `npm run db:start` | `npm run db:status` | `npm run db:stop`
- **Build:** `npm run build`
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **Tests:** `npm test` (Vitest, single run)
- **Watch Tests:** `npm run test:watch`

## Testing Standards

- All unit and integration tests live in the `test/` directory.
- Test files follow the `*.test.ts` or `*.test.tsx` naming convention.
- Run `npm test` before committing any feature changes.

## UI Design Standards

- **No Eyebrow/Subrow Pill Badges:** Never add decorative badge pills, subrow tags, or eyebrow labels (e.g. "Production Live", "Guaranteed SLA", "Heatmap") above or next to section titles. Keep headers clean, confident, and minimal.
- **Avatar Images:** Always route user images through `getProfileImageSrc(image, userId)` to ensure private Vercel blob avatars load properly across all tables and modals.
- **Minimal, Cohesive Color Palette:** Keep dashboards clean, calm, and uncluttered without competing rainbow colors. Ensure high-contrast legibility in both light and dark modes.

## Agent skills

- [gemini-api-dev](.agents/skills/gemini-api-dev/): `google-gemini/gemini-skills`, guidance for the official `@google/genai` SDK.
- [ai-sdk](.agents/skills/ai-sdk/): `vercel/ai`, use the documentation bundled with this project's installed AI SDK version.
- MCP servers: OpenAI Developer Docs (connected), Gemini Docs (connected).
