# Verify: Role Aware Navigation Shell · spec 0003 · updated 2026-10-22

_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

## UI / manual

- [ ] Sign in separately as a manager, worker, and client; confirm each sees only the destinations assigned to that role. As manager, confirm `/` and the WoPhoto logo land at Team Invitations; confirm workers land at `/worker` and clients at `/client` with the exact agreed placeholder copy. → AC-1, AC-2, AC-3
- [ ] For every role, inspect expanded navigation and the desktop icon rail; confirm each applicable unfinished destination is labeled Coming soon, has no link/route, and cannot be opened by click or keyboard. → AC-6
- [ ] While signed out, request `/manager/invitations` and confirm redirect to `/login`. Sign in as worker and client separately and request that manager URL directly; confirm each gets `/forbidden`. Check a session with no recognized role and confirm it is denied. → AC-7, AC-9, AC-12
- [ ] At desktop width (768 CSS px or wider), collapse the sidebar to the icon rail, expand it again, reload, and confirm the saved `sidebar_state` is restored without carrying state across a sign-out/sign-in as another user. → AC-4, AC-13
- [ ] At phone width (below 768 CSS px), open the menu button and confirm a left drawer appears. Close it with Escape and with an outside click; each time confirm focus returns to the menu button. Reopen it, choose an available destination, and confirm the drawer closes and focus moves to that page's single visible `h1`. → AC-4, AC-10
- [ ] Use the shell with keyboard only: tab through navigation, sidebar footer, and top-bar controls, activate available links, and confirm visible focus and meaningful accessible names on icon-only controls. Emulate reduced motion and confirm shell transitions respect the preference. → AC-10
- [ ] Navigate between available destinations with links, browser back/forward, and a direct nested route; confirm the top-bar title and active navigation item stay aligned with the shared route configuration, with `Workspace` as the protected-route fallback. Confirm the page has one visible `h1` matching its title. → AC-5, AC-13
- [ ] In both light and dark modes, compare the shell with the established WoPhoto orange, charcoal, white, and reduced-radius styling. Confirm there are no decorative eyebrow labels and no background image. → AC-8
- [ ] With system theme set to light, then dark, load the shell and inspect the theme control before and after hydration; confirm it begins with the stable `Theme` label, shows no guessed-mode icon or hydration warning, and toggles using the resolved system theme. Repeat after explicitly selecting each theme. → AC-5, AC-11
- [ ] Check the sidebar footer account control using sessions with (a) name and email, (b) email only, (c) name only, and (d) neither. Confirm the display name falls back to email then `Account`, the human-readable role appears, the email menu row is omitted only when absent, and no profile image is loaded. Confirm the WoPhoto home link appears once in the header and the account control remains usable when collapsed. → AC-5, AC-12
- [ ] From each role, sign out using the sidebar footer account control; confirm redirect to `/login`, invalidation of the session, and clearing of the persisted `sidebar_state` cookie. Sign in with a different role and confirm its own navigation and saved sidebar state are used. → AC-5, AC-13
- [ ] Run the existing Google sign-in and invitation-acceptance flows, then open Team Invitations as manager; confirm they remain functional with the shell in place. Exercise an Auth.js sign-out failure and confirm the error surfaces while the active session remains. → AC-14

## Value sourcing

- [ ] Vary session name and email independently, including null values; confirm account display and menu values use `session.user.name` and `session.user.email` with the specified fallbacks. → Value source: Auth.js session `name` and `email`
- [ ] Sign in as each role and compare visible labels, availability, and order against the static role navigation configuration; confirm no role receives another role's links. → Value source: static role navigation configuration
- [ ] Navigate among every available route, including client-side transitions and a direct nested URL; confirm title lookup uses `usePathname()` plus available route definitions and falls back to `Workspace` for an unmapped protected route. → Value source: `usePathname()` and shared navigation configuration
- [ ] Sign in as each role and request `/`; confirm the existing session `UserRole` selects the specified landing route and placeholder. → Value source: Auth.js session role and role landing routes
- [ ] Change the operating-system theme between light and dark with theme preference set to system; reload and confirm the control uses next-themes `resolvedTheme` after mount, while the first render remains stable. → Value source: theme provider `resolvedTheme`
- [ ] Sign out and inspect the resulting location and session; confirm the existing Auth.js sign-out action sends the user to `/login` and ends the session. → Value source: Auth.js sign-out behavior

## Acceptance-criteria coverage

- AC-1 through AC-14 are covered by the UI/manual steps above. The six Value sourcing rows are each exercised in the Value sourcing section.
