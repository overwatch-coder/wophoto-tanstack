# Spec 0007: AI Studio Agent and Smart Navigation

- **Status**: Implemented
- **Date**: 2026-10-24
- **Author**: Antigravity Pair Programming
- **Scope**: Studio wide AI assistant with autonomous tools, deep navigation, multi provider support, multimodal file processing, and shadcn AI components

---

## Summary

This specification defines the production implementation of the WoPhoto AI Studio Agent. The agent sits as a persistent floating assistant in the bottom right corner across all workspace pages. It opens into a focused floating chat drawer and can expand into the full Option A Command Center on demand.

The agent uses Vercel AI SDK to orchestrate real studio actions through tool calls. It supports multiple AI providers: OpenAI, Anthropic, Google Gemini, xAI Grok, and custom self hosted endpoints such as Ollama and vLLM. It reads credentials from user settings with server environment variable fallbacks. The chat interface uses shadcn official AI components: message, message scroller, and trace.

---

## Requirements

### 1. Persistent Floating Assistant and Adaptive Layouts
- Sits in the bottom right corner on all workspace pages (dashboard, reviews, tasks, settings).
- Shows a subtle status indicator and keyboard shortcut cue (`⌘J`).
- Clicking opens a floating drawer (`420px` wide) that hovers over the active workspace without displacing page content.
- Clicking maximize or pressing `⌘K` smoothly expands the drawer into the full Option A Command Center modal with omnibar search.
- Clicking minimize or pressing `Esc` docks the window back to the corner or collapses it to the launcher bubble.

### 2. Multi Provider AI Engine and Credential Management
- Provider selection:
  - OpenAI (`gpt-5.1`)
  - Anthropic (`claude-sonnet-5`)
  - Google Gemini (`gemini-3.8-flash`)
  - xAI Grok (`grok-4.7`)
  - Groq (`openai/gpt-oss-120b`)
  - Custom Self Hosted (`http://localhost:11434/v1`, vLLM, or custom endpoint)
- Hybrid credential handling:
  - Reads user configured API key and chosen model from user settings.
  - If a user key is not present, falls back gracefully to studio server environment variables (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, etc.).
  - User API keys are encrypted in database preferences and tagged to a provider, so one provider's key is never sent to another provider.

### 3. Configurable Tool Execution Safety Mode
- Configurable in Studio Settings:
  - **Safe Multi Tier (Default)**: Read and search tools execute automatically. State mutating tools (project creation, task batches, reassignments) return an action proposal card with a single confirmation button before executing.
  - **Fully Autonomous**: All tools, including state mutations, execute immediately upon invocation.

### 4. Studio Action Tools
- `smart_search`: Keyword search across client reviews, tasks, deliverables, and projects. A no-match result is not evidence that the underlying data category is empty.
- `query_studio_data`: Role-scoped LIST, GET, and COUNT retrieval across approved business records (projects, active/deleted tasks, feedback, notifications, comments, ratings, invitations, and team). Enforces allowlisted filters, projections, and a 20-record page cap; does not provide arbitrary SQL or access to credentials/session data.
- `create_project`: Prepares a project with its name, a concise grounded description, and an explicitly selected active client owned by the manager.
- `prepare_client_feedback`: For client review requests, prepares a review draft for one of that client's projects and shows it as an inline card. The client can submit from chat or open the existing form to edit it. Submission uses the existing client authorization and validation action.
- `create_task_batch`: Creates batch tasks and distributes them across retouchers according to active capacity.
- `query_team_capacity`: Queries retoucher availability, active queue count, and specializations.
- `query_sla_risks`: Identifies deliverables close to 24h or 4h cutoff thresholds.
- `generate_wrapup_report`: Computes project turnaround metrics, approval counts, and delivery summary.
- `navigate_to`: Generates clickable deep links with focused parameter anchors leading to reviews, tasks, or settings.
- Tool efficiency and turn limits:
  - Clear single-intent requests expose only their matching tool, reducing speculative lookups across unrelated tables.
  - Direct project creation asks for a client email when one was not supplied; it never guesses a client from exploratory searches or the manager's email.
  - Provider loops stop after a confirmation proposal or a required clarification, so they do not spend another model step after the user has a clear next action.
  - A project proposal includes a concise description from the user's context or a neutral name-based draft; confirmation saves it, invalidates the project route, and refreshes the current page immediately.
  - Ambiguous multi-action requests retain the full role-checked toolset; provider loops remain capped to prevent runaway calls.

### 5. Standard shadcn AI Component Library
- Installs and integrates:
  - `components/ui/message.tsx`: Chat turn layout, user and assistant bubble styling.
  - `components/ui/message-scroller.tsx`: Automatic scroll anchoring, streaming follow, and scroll to bottom button.
  - `components/ui/trace.tsx`: Tool execution steps with status indicators, expandable inputs, and outputs.
  - `components/ui/collapsible.tsx`: Expandable trace and proposal inspector blocks.
- Preserves existing `components/ui/button.tsx` customizations.

### 6. Multimodal Attachments and Document Processing
- Chat attachment interface:
  - File picker button (clean paperclip icon, no star icons) and drag and drop area in both floating drawer and command center.
  - Attachment preview chips with removal buttons, a Clear all control, and a five-file limit before sending.
  - Clicking an attached image opens an accessible full-size preview dialog.
- Supported file types:
  - Visual files (JPEG, PNG, WebP, GIF) processed via native model vision. Known text-only models are blocked with an actionable explanation before a provider request is sent.
  - Structured data spreadsheets (CSV, Excel xls/xlsx) parsed into structured table rows.
  - Document briefs (PDF, Word docx) parsed into text extracts.
  - Plain text and Markdown files parsed as UTF-8 text.
- Automated creation bridge:
  - AI reads extracted tables, shot lists, or review notes and generates an approved batch creation proposal for projects or tasks.
- Validation and security:
  - File size capped at 10MB per file.
  - Strict MIME type verification on both client and server before processing.

### Verification Record
- Manager browser verification: PNG image analysis, PDF and DOCX text extraction, and an XLSX task list with three distinct titles, worker assignments, priorities, and due dates.
- The spreadsheet proposal preserved all three rows. It was inspected and left unconfirmed, so verification created no tasks.
- An unmatched worker name was surfaced for correction; the assistant did not substitute a different worker.
- Automated route tests confirm a known text-only Groq model is rejected before the provider adapter runs, while a vision-capable Groq model is passed through.
- Client and worker data scope and manager-only proposal confirmation are covered by role-scoped automated tests. Browser verification was performed with the available manager session.
- Attachment data remains in the active client-side conversation only. Chat history and uploaded file storage are not persisted; persistent storage is deferred until chat history retention is designed.

---

## Architecture and Data Model

### Database Preferences Schema
In `prisma/schema.prisma`, expand `UserPreference` with AI configuration fields:

```prisma
model UserPreference {
  userId               String              @id
  location             String?
  notificationChannels Json                @default("{}")
  density              SettingsDensity     @default(COZY)
  soundAlerts          Boolean             @default(true)
  defaultLanding       String?
  workerAvailability   WorkerAvailability  @default(AVAILABLE)

  // AI Assistant Preferences
  aiProvider           String              @default("OPENAI") // OPENAI | ANTHROPIC | GEMINI | GROK | GROQ | CUSTOM
  aiModel              String              @default("gpt-5.1")
  aiApiKeyEncrypted    String?             @db.Text
  aiApiKeyProvider     String?              // Prevents sending one provider's credential to another provider.
  aiCustomEndpoint     String?
  aiAutonomousExecution Boolean            @default(false) // false = Safe Multi Tier (Default), true = Fully Autonomous

  updatedAt            DateTime            @updatedAt
  user                 User                @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

### Chat Streaming Route
Create `app/api/chat/route.ts`:
- Authenticates session using `auth()`.
- Resolves effective provider, model, endpoint, and API key (user preference first, environment variable fallback).
- Instantiates the provider client using Vercel AI SDK.
- Defines agent tools with Zod parameter schemas.
- Streams responses and tool calls back to the client via `streamText()`.

---

## Build Plan

1. **Dependencies and shadcn Components**:
   - Install `ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`, `@shadcn/react`.
   - Add shadcn components: `message`, `message-scroller`, `trace`, `collapsible`.
   - Restore and preserve `components/ui/button.tsx`.

2. **Database Migration and Preference Actions**:
   - Add AI preferences to `prisma/schema.prisma`.
   - Generate Prisma client and update preference helper methods in `lib/user-preferences.ts`.
   - Add AI configuration fields to the Settings page (`components/settings/profile-settings.tsx`).

3. **AI Provider Factory and Tools**:
- Build `lib/ai/provider.ts`: Resolves OpenAI, Anthropic, Gemini, xAI Grok, Groq, or custom provider based on active configuration.
   - Build `lib/ai/tools.ts`: Implements `smart_search`, `create_project`, `create_task_batch`, `query_team_capacity`, `query_sla_risks`, `generate_wrapup_report`, and `navigate_to`.
   - Build `app/api/chat/route.ts`: Streaming endpoint supporting tools and multi turn conversations.

4. **Chat UI Components and Integration**:
   - Build `components/ai/studio-copilot.tsx` using `message`, `message-scroller`, and `trace`.
   - Embed `StudioCopilot` into `app/(workspace)/layout.tsx` so it floats on every workspace page.
   - Support both floating drawer and Option A Command Center modal.

5. **Verification**:
   - Run typecheck, lint, vitest test suite, and production build.
