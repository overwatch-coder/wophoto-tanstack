<p align="center">
  <img src="public/assets/logo.png" alt="WoPhoto Studio Platform" width="480" />
</p>

<p align="center">
  <strong>Precision workflow and operations platform for commercial photography and multimedia production studios.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TanStack_Start-1.x-ff4154?logo=reactrouter" alt="TanStack Start" />
  <img src="https://img.shields.io/badge/React-19.3-blue?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma" alt="Prisma" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css" alt="Tailwind CSS" />
  <img src="https://img.shields.io/badge/Auth.js-v5-green?logo=auth0" alt="Auth.js" />
  <img src="https://img.shields.io/badge/Tests-365_Passing-brightgreen?logo=vitest" alt="Vitest Tests" />
</p>

---

# <img src="public/assets/logo-mark.png" alt="WoPhoto" width="32" height="32" style="vertical-align: middle; border-radius: 6px;" /> WoPhoto

WoPhoto is a studio operations app for photography and multimedia teams. It brings project work, creative briefs, team tasks, schedules, equipment inventory, client requests, reviews, and studio files into role-aware workspaces.

## What it supports

- **Projects and tasks:** Assign work, track task status, record daily work, review submissions, and restore archived tasks.
- **Creative briefs:** Build project briefs with deliverables, guidelines, shot lists, questions, and sign-offs. Save briefs as reusable templates.
- **Scheduling and inventory:** Coordinate studio events and crew, track equipment, record loans, and keep maintenance history.
- **Client collaboration:** Let clients follow their connected projects, send work requests, and provide feedback on deliverables.
- **Brand assets:** Store and share project and client materials with access checks. File uploads require a configured Vercel Blob token.
- **Studio Copilot:** Use the configured AI provider for studio search and supported work proposals. Managers control studio Copilot access and provider settings.
- **Notifications:** Show workspace notifications in the app and optionally deliver supported notifications by email.

## Roles and access

| Role             | Workspace access                                                                                                                                                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Manager**      | Owns the studio and has full access to its work and owner controls, including team access, studio settings, and AI provider credentials.                                                                                                                                     |
| **Supervisor**   | Uses the manager workspace with a fixed preset: dashboard view access and manage access to projects, tasks, schedule, briefs, reviews, work requests, brand assets, and inventory. Supervisor access does not include team administration, deleted tasks, or owner settings. |
| **Collaborator** | Uses the manager workspace only for areas the owner grants. Each grant is View or Manage; an area without a grant is unavailable. Owner controls remain restricted.                                                                                                          |
| **Worker**       | Uses the worker workspace for assigned work and the studio areas available to workers.                                                                                                                                                                                       |
| **Client**       | Uses the client workspace for connected projects, work requests, and feedback.                                                                                                                                                                                               |

New accounts are invite-only and must sign in with the invited email using a verified Google account. The initial Manager account is created separately with the bootstrap command below.

## Technology

- TanStack Start, TanStack Router, React, and TypeScript
- PostgreSQL and Prisma ORM
- Tailwind CSS, shadcn components, Base UI, and Lucide icons
- Auth.js with Google sign-in
- Vercel Blob for private file storage
- Vitest for unit and integration tests
- AI provider integrations through the Vercel AI SDK and provider SDKs

## Local development

### Prerequisites

- Node.js 22 or newer
- PostgreSQL
- A Google OAuth client for sign-in

### Install and configure

```bash
git clone https://github.com/overwatch-coder/WoPhoto.git
cd WoPhoto
npm install
cp .env.example .env.local
```

Set `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, and `AUTH_GOOGLE_SECRET` in `.env.local`. The local PostgreSQL helper listens on port `5433`; make sure the database name in the URL exists. Add the Google OAuth callback URL `http://localhost:3000/api/auth/callback/google` to the OAuth client.

Optional integrations need their own configuration. See [Environment variables](#environment-variables).

### Create the database and initial Manager

Start the repository's local PostgreSQL service, apply migrations, and generate the Prisma client:

```bash
npm run db:start
npx prisma migrate dev
npx prisma generate
```

Create the first Manager record using the email address for the Google account that will own the studio:

```bash
npm run bootstrap:manager -- manager@example.com
```

The bootstrap command only creates the initial Manager and Studio. It refuses to run if a Manager already exists or the email already belongs to a WoPhoto account.

Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with that verified Google account. After signing in, the Manager can invite workers, clients, supervisors, and collaborators from **Team Invitations**.

## Environment variables

Keep real secrets in local environment files or the deployment provider's secret settings. Do not commit them.

| Variable                                                                               | Purpose                                                                                                                              |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                                                                         | PostgreSQL connection string.                                                                                                        |
| `AUTH_SECRET`                                                                          | Auth.js session and authentication secret; also used to encrypt recoverable invitation links.                                        |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`                                                 | Google OAuth client credentials.                                                                                                     |
| `BLOB_READ_WRITE_TOKEN`                                                                | Enables Vercel Blob uploads for profile images and supported workspace files.                                                        |
| `CRON_SECRET`                                                                          | Protects the deadline notification endpoint used by the scheduled job configuration.                                                 |
| `APP_URL`                                                                              | Public app base URL for absolute links in emails. Set this for production email delivery.                                            |
| `EMAIL_PROVIDER`                                                                       | `resend` or `gmail`. Defaults to Resend.                                                                                             |
| `EMAIL_DELIVERY_MODE`                                                                  | `live` or `test`. In test mode, configure `EMAIL_TEST_RECIPIENT`; messages are redirected there.                                     |
| `RESEND_API_KEY`, `EMAIL_FROM`                                                         | Resend credentials and sender address.                                                                                               |
| `GMAIL_SMTP_USER`, `GMAIL_SMTP_APP_PASSWORD`, `GMAIL_FROM`                             | Gmail SMTP credentials and optional configured sender alias. Use a Google App Password.                                              |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `XAI_API_KEY`, `GROQ_API_KEY` | Optional server-default AI provider credentials. Managers can also configure studio provider credentials in Settings.                |
| `CUSTOM_AI_API_KEY`, `CUSTOM_AI_ENDPOINT`, `AI_ALLOWED_CUSTOM_HOSTS`                   | Optional compatible custom or self-hosted AI endpoint settings.                                                                      |
| `AI_KEYS_ENCRYPTION_KEY`                                                               | Stable 64-character hex key used to encrypt stored provider credentials. Keep it safe and unchanged while encrypted keys are in use. |

The full variable template is in [.env.example](.env.example). Features that depend on an optional integration remain unavailable until its credentials are configured.

## Database migrations

Use Prisma migrations to keep local, preview, and production databases aligned. For a production deployment, configure `DATABASE_URL` in the host's secret settings and apply committed migrations with:

```bash
npx prisma migrate deploy
```

Do not use `prisma db push` as the production migration process.

## Commands

| Command                                          | Purpose                                          |
| ------------------------------------------------ | ------------------------------------------------ |
| `npm run dev`                                    | Start the development server.                    |
| `npm run build`                                  | Build the production app.                        |
| `npm run start`                                  | Start the production server.                     |
| `npm run typecheck`                              | Run TypeScript checks.                           |
| `npm run lint`                                   | Run ESLint.                                      |
| `npm test`                                       | Run the Vitest suite once.                       |
| `npm run test:watch`                             | Run Vitest in watch mode.                        |
| `npm run db:start`                               | Start the repository's local PostgreSQL service. |
| `npm run db:status`                              | Check the local PostgreSQL service status.       |
| `npm run db:stop`                                | Stop the local PostgreSQL service.               |
| `npm run bootstrap:manager -- email@example.com` | Create the initial Manager and Studio.           |

## Repository layout

- `src/routes/` — TanStack file routes and server API endpoints
- `src/server/` — server functions, API handler logic, and integrations
- `src/styles/` — application styles
- `components/` — workspace, settings, Copilot, briefs, tasks, schedule, inventory, and other UI
- `lib/` — authorization, application logic, integrations, and data access
- `prisma/` — Prisma schema and ordered database migrations
- `scripts/` — operational scripts, including initial Manager bootstrap
- `test/` — unit and integration tests
- `docs/scope/` — product scope and slice tracking

## License

This repository is private and proprietary.
