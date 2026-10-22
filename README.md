# WoPhoto

WoPhoto is a project and task management application for photography and multimedia teams. Managers, workers, and clients have role-specific access. The app uses Next.js 16.4.0, Auth.js with Google, PostgreSQL through Prisma ORM 7, Tailwind CSS 4, and shadcn/ui.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and set `DATABASE_URL` to your local PostgreSQL username, password, and database. Set the Google OAuth credentials and `AUTH_SECRET` too.
3. Create the local database in PostgreSQL if it does not exist yet.
4. Apply the initial schema with `npx prisma migrate dev`.
5. Create the first manager account record with `npm run bootstrap:manager -- manager@example.com`.
6. Start the app with `npm run dev`.

For Google OAuth, add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI in the Google OAuth client. Generate an auth secret with `npx auth secret`.

The first manager is provisioned once by the CLI. Google sign in rejects accounts without an accepted invitation. Managers can create invitation links from `/manager/invitations`; invited users accept the link before signing in with the same Google email.

## Project checks

- `npm run typecheck`
- `npm run lint`
- `npm test`

## Adding shadcn/ui components

Run `npx shadcn@latest add <component>` to add a component under `components/ui/`.
