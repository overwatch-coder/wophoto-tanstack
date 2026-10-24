# Spec 0007: AI Studio Agent and Smart Navigation

- **Status**: Accepted
- **Date**: 2026-10-24
- **Author**: Antigravity Pair Programming
- **Scope**: Studio wide AI assistant with autonomous tools, deep navigation, multi provider support, and shadcn AI components

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
- `smart_search`: Semantic and keyword cross studio search across client reviews, tasks, deliverables, and projects.
- `create_project`: Creates project container with name, client, priority, and SLA target.
- `create_task_batch`: Creates batch tasks and distributes them across retouchers according to active capacity.
- `query_team_capacity`: Queries retoucher availability, active queue count, and specializations.
- `query_sla_risks`: Identifies deliverables close to 24h or 4h cutoff thresholds.
- `generate_wrapup_report`: Computes project turnaround metrics, approval counts, and delivery summary.
- `navigate_to`: Generates clickable deep links with focused parameter anchors leading to reviews, tasks, or settings.

### 5. Standard shadcn AI Component Library
- Installs and integrates:
  - `components/ui/message.tsx`: Chat turn layout, user and assistant bubble styling.
  - `components/ui/message-scroller.tsx`: Automatic scroll anchoring, streaming follow, and scroll to bottom button.
  - `components/ui/trace.tsx`: Tool execution steps with status indicators, expandable inputs, and outputs.
  - `components/ui/collapsible.tsx`: Expandable trace and proposal inspector blocks.
- Preserves existing `components/ui/button.tsx` customizations.

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
