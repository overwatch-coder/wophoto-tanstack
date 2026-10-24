# 0003. Role Aware Navigation Shell

**Date**: 2026-10-22
**Status**: Accepted

## Summary

This feature gives managers, workers, and clients a shared workspace frame with navigation that matches their role. It follows the existing WoPhoto theme and uses a collapsible sidebar on desktop and a drawer on phones. The shell uses the existing sign in session and adds no database tables or new environment settings. The initial build has since grown alongside the product: implemented role landing pages and active workspace destinations replace the original temporary placeholders and disabled links.

## Requirements

**User stories**:

1. As a manager, I want navigation to team and project work so I can reach the areas available to my role.
2. As a worker, I want navigation to my task and review areas so I can follow assigned work.
3. As a client, I want navigation to my project and feedback areas so I can follow delivery and respond to the team.

**Acceptance criteria**:

- **AC-1**: A signed in manager, worker, or client sees the shared workspace shell, with only the navigation destinations assigned to that role.
- **AC-2**: Managers land on `/manager` and can open every implemented manager destination in the shell, including Team Invitations.
- **AC-3**: Workers land on `/worker` and clients land on `/client`; each sees only the destinations assigned to their role.
- **AC-4**: The desktop sidebar can collapse to an icon rail and expand again. On phones, a menu button opens the sidebar as a left drawer, and choosing an available destination closes the drawer.
- **AC-5**: The top bar shows the current page title from the same route configuration as the sidebar and a light and dark theme control. Account controls with the signed in user's identity, role, and sign out action appear at the bottom of the sidebar.
- **AC-6**: Navigation exposes implemented destinations for each role; destinations without an implemented page are not presented as active links.
- **AC-7**: Direct access to a protected page still checks the user's role on the server. Hiding a navigation item is not treated as authorization.
- **AC-8**: The shell uses the current WoPhoto orange, charcoal, and white themes, the existing reduced corner radius, and the supplied sidebar references. It contains no decorative eyebrow labels and uses no background image.
- **AC-9**: A signed out visitor is sent to sign in. A signed in user without the required role receives the existing forbidden page.
- **AC-10**: The shell supports keyboard navigation, visible focus, accessible names for icon only controls, and reduced motion preferences. Escape and outside click close the phone drawer and return focus to its menu button. Choosing an available destination closes the drawer and moves focus to the destination page heading.
- **AC-11**: Before the theme preference is available in the browser, the theme control renders without a guessed theme state or a hydration mismatch. After mount, it toggles from the resolved light or dark theme, including when the system theme is enabled.
- **AC-12**: Missing display name or email values use the account fallback rules in this spec. A missing or unrecognized role is denied access.
- **AC-13**: Client navigation updates the current page title and active item. Signing out and signing into a different role does not reuse the previous user's navigation state.
- **AC-14**: Existing Google sign in, invitation acceptance, and manager invitation access continue to work after the shell is added.

## Decision

**Chosen option**: Option 1: Shared shell based on shadcn's `sidebar-07` block

Use one protected workspace shell with role based links, the icon collapsing pattern from shadcn's `sidebar-07` block, a left drawer on phones, and a focused top bar. Keep the WoPhoto home link in the sidebar header and the account control in the footer. Install the block with `npx shadcn@latest add sidebar-07`, then adapt its sample navigation and content to WoPhoto's role configuration and theme. Use the supplied sidebar references, without decorative eyebrow labels or background imagery.

## Feature design

**Data model sketch**:

No schema change. Read the existing Auth.js session user fields `id`, `name`, `email`, `image`, and `role`. The role is the existing Prisma `UserRole` enum with `MANAGER`, `WORKER`, and `CLIENT` values.

**Shell routes and role navigation**:

The protected shell covers `/`, `/manager/*`, `/worker/*`, and `/client/*`. The public `/login`, `/invite/[token]`, `/forbidden`, and `/api/auth/*` routes stay outside it. On `/`, resolve the signed in user's role on the server and redirect to that role's landing page: managers to `/manager`, workers to `/worker`, and clients to `/client`. The WoPhoto logo links to the same role landing destination. New signed in pages belong under the protected workspace route group and retain their server side role checks.

The shared navigation configuration is the single source for role visibility, labels, available route paths, and page titles. The current destinations are:

| Role    | Navigation item  | Route                    |
| ------- | ---------------- | ------------------------ |
| Manager | Dashboard        | `/manager`               |
| Manager | Projects         | `/manager/projects`      |
| Manager | Tasks            | `/manager/tasks`         |
| Manager | Schedule         | `/manager/schedule`      |
| Manager | Brief Review     | `/manager/brief-review`  |
| Manager | Explore Briefs   | `/manager/explore-briefs`|
| Manager | Reviews          | `/manager/reviews`       |
| Manager | Brand Assets     | `/manager/brand-assets`  |
| Manager | Inventory        | `/manager/inventory`     |
| Manager | Deleted Tasks    | `/manager/deleted-tasks` |
| Manager | Notifications    | `/manager/notifications` |
| Manager | Team Invitations | `/manager/invitations`   |
| Manager | Settings         | `/settings`              |
| Worker  | Dashboard        | `/worker`                |
| Worker  | My Tasks         | `/worker/tasks`          |
| Worker  | Schedule         | `/worker/schedule`       |
| Worker  | Brief Review     | `/worker/brief-review`   |
| Worker  | Reviews          | `/worker/reviews`        |
| Worker  | Brand Assets     | `/worker/brand-assets`   |
| Worker  | Notifications    | `/worker/notifications`  |
| Worker  | Settings         | `/settings`              |
| Client  | Dashboard        | `/client`                |
| Client  | Project Feedback | `/client/project-feedback`|
| Client  | Notifications    | `/client/notifications`  |
| Client  | Settings         | `/settings`              |

The route title comes from the same configuration: `/manager` is `Dashboard`, `/manager/invitations` is `Team Invitations`, and `/worker` and `/client` are each `Dashboard`. Match nested paths by route segment, not string prefix. Use `Workspace` as the title fallback for a protected route missing a mapping. An unmapped route still goes through normal route handling and never grants access.

The landing routes are `/manager`, `/worker`, and `/client`. Manager, worker, and client home pages are implemented. The top bar page title is the page's single visible `h1`; body sections use `h2` and do not repeat that title.

**Responsive and identity behavior**:

Use the shadcn sidebar defaults. At widths below 768 CSS pixels, the sidebar is a left drawer opened by a menu button. Escape or outside click closes it and returns focus to the menu button. Selecting an available destination closes the drawer and moves focus to the page heading. At 768 CSS pixels and above, start expanded; the user can collapse to an icon rail. Persist the desktop collapsed state with the sidebar's `sidebar_state` cookie. A viewport change closes any open phone drawer and restores the saved desktop state. In the icon rail, tooltips include the item name.

Keep the WoPhoto home link in the sidebar header. Place the account control in the sidebar footer. For the account control, show the user's name when present, otherwise their email, otherwise `Account`. Show the human readable role below it. Do not load a profile image in this shell. The account menu contains the email when present and a sign out action. If the email is missing, omit that line. The theme control starts with a stable generic `Theme` label and does not show an icon that assumes light or dark mode until the component has mounted. After mount, use `resolvedTheme` to toggle explicitly between light and dark.

**API surface**:

No new API endpoint is needed. The shell reads `auth()` on the server and never places the session or role in a shared server cache. A server action calls the existing Auth.js `signOut` function with `/login` as the redirect destination. Navigation uses Next.js links for implemented destinations.

| Surface                     | Method                                   | Inputs                             | Output                                                                             | Auth                             | Key errors                                                                          |
| --------------------------- | ---------------------------------------- | ---------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------- |
| Role landing resolver (`/`) | Server render                            | Current Auth.js session            | Redirect to the role landing route                                                 | Signed in user with a known role | No session redirects to `/login`; missing or unknown role redirects to `/forbidden` |
| Protected workspace layout  | Server render                            | Current Auth.js session            | Shell, role navigation, page title, theme control, sidebar footer account controls | Signed in user                   | No session redirects to `/login`                                                    |
| Team invitations            | Server render                            | Current session and `MANAGER` role | Existing manager invitation page                                                   | Manager                          | Other roles redirect to `/forbidden`                                                |
| Sign out                    | Server action wrapping Auth.js `signOut` | Current session                    | Auth.js sign out and redirect to `/login`                                          | Signed in user                   | If sign out fails, surface the route error and keep the session active              |

**Value sourcing**:

| Action                       | Value produced or displayed                               | Source                                                                                                         |
| ---------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Render account control       | Display name and email                                    | `session.user.name` and `session.user.email`, with a neutral account label when either is absent               |
| Render role navigation       | Implemented destinations, labels, and order               | Static role navigation configuration in the application                                                        |
| Select the active page title | Title for the current route                               | `usePathname()` matched against available routes in the same navigation configuration; fallback is `Workspace` |
| Render role home             | Manager, worker, or client dashboard                      | Existing `UserRole` in the Auth.js session and the role landing route in this spec                             |
| Render theme control         | Current theme and toggle action                           | Existing next themes provider; `resolvedTheme` after client mount                                              |
| Sign out                     | Redirect to the sign in page                              | Existing Auth.js sign out behavior                                                                             |

**Visual source**:

Follow `app/globals.css` and `components/theme-provider.tsx` for the current design tokens and theme behavior. Use the supplied sidebar references at `/Users/nyamads/.t3/userdata/attachments/bf0daad9-0dd7-4e5f-9e07-6808b6918847-60ffd570-c773-4d07-a3d8-8421ff3d084d.jpg` and `/Users/nyamads/.t3/userdata/attachments/bf0daad9-0dd7-4e5f-9e07-6808b6918847-f4074611-690d-4930-a237-48915f6114bd.jpg`. They are reference material only and must not be copied into the repository because they contain team information.

**Key invariants**:

1. The session role selects visible navigation, but server side role checks remain the authority for protected pages and actions. A missing or unrecognized role redirects to `/forbidden`.
2. Navigation destinations correspond to implemented pages, with server role checks protecting restricted routes.
3. A role's landing page is explicit: managers use `/manager`, workers use `/worker`, and clients use `/client`.
4. Role navigation, availability, route titles, and active states come from the same configuration.
5. Request specific identity and role data is rendered at request time and is never shared between users through server caching.
6. The shell does not add new environment variables, external services, or stored data.

**Security model**:

Only signed in users can enter the workspace. The session provides their identity and role. A missing or unrecognized role is sent to `/forbidden`. Each protected server page continues to call `requireRole` for its allowed roles. Managers can open team invitations. Workers and clients cannot open manager pages by changing the URL. `/login`, `/invite/[token]`, `/forbidden`, and `/api/auth/*` do not use the workspace shell. No new regulated data or compliance requirement is introduced.

**Critical test scenarios**:

1. Happy path: a manager signs in, sees the manager navigation, opens Team Invitations, toggles theme, and signs out, verifies **AC-1**, **AC-2**, and **AC-5**.
2. Role home and isolation: workers and clients see their role links and landing pages; switching accounts does not reuse the previous role menu, verifies **AC-1**, **AC-3**, and **AC-13**.
3. Restricted access: a signed out visitor is sent to sign in, a worker or client opens `/manager/invitations` directly and is sent to `/forbidden`, and a missing role is denied, verifies **AC-7**, **AC-9**, and **AC-12**.
4. Destination coverage: navigation entries resolve to implemented pages and protected server routes retain role checks, verifies **AC-6** and **AC-7**.
5. Responsive behavior: keyboard and touch users open and close the phone drawer, use Escape and outside click, navigate to an available page, and receive focus at the page heading, verifies **AC-4** and **AC-10**.
6. Theme and identity: the theme toggle renders without a hydration mismatch, switches correctly from both system light and system dark, and identity fallbacks work with missing name or email, verifies **AC-5**, **AC-11**, and **AC-12**.
7. Regression: Google sign in, invitation acceptance, and manager invitation access continue to work; an Auth.js sign out failure surfaces an error without clearing the active session, verifies **AC-14**.

## Build plan

1. [x] Add shadcn's `sidebar-07` block and the menu components needed for the workspace, following the existing Tailwind and theme conventions, satisfies **AC-1**, **AC-4**, and **AC-8**.
2. [x] Build the shared protected shell, the static role navigation map, route titles, theme control, account menu, and sign out action, satisfies **AC-1**, **AC-5**, **AC-7**, and **AC-9**.
3. [x] Integrate the shell with role landing routes and active workspace destinations for manager, worker, and client, satisfies **AC-2**, **AC-3**, and **AC-6**.
4. [x] Add focused tests for role navigation, route titles, mobile Escape behavior, and auth sign out; review role guards, run app checks, and verify the shell at desktop and phone widths, satisfies **AC-1** through **AC-14**.

## Consequences

**Positive**:

1. All roles get a consistent workspace frame that grows with the product.
2. The shell links users to the implemented features available to their role.
3. The navigation adapts to desktop and phone use.

**Negative / tradeoffs**:

1. Future navigation items need an explicit role and availability update when their feature ships.
2. The role navigation map and the server page guards can drift unless implementation and tests cover both.

**Neutral**:

The shell depends on the existing Auth.js session, role enum, theme provider, and manager invitation page. It requires no schema migration or new service configuration.

## Follow-up

1. Keep new navigation destinations aligned with the server side role checks as additional pages ship.
2. Add any profile management destination only when the profile workflow is designed.
