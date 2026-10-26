# 0014. Studio Access Scopes

**Date**: 2026-10-26
**Status**: Accepted

## Summary

Each studio has one owner, plus Supervisors and Collaborators with different access. The owner can give Collaborators view or manage access to individual work areas, during an invitation or later. Access checks use the studio membership and saved scopes on the server, so hiding a link is never the only protection.

## Context

WoPhoto currently treats every account with the `MANAGER` role as a full manager. Manager pages, server actions, APIs, and Copilot tools make decisions from that role, and much of the studio data is scoped to a manager user ID. Adding more full managers would give every invitee access to studio settings, Copilot provider credentials, team access controls, and all operational data.

The product needs one owner with full control and additional management help with less access. The owner must be able to invite Supervisors and Collaborators, choose Collaborator access by area, change it later, and revoke access without deleting the account or its history. Existing user accounts use one role, invitations require verified Google sign in, and some studio wide data has no owner key yet.

## Requirements

**User stories**:
- As a studio owner, I want to invite a Supervisor or Collaborator so that I can delegate studio work without granting owner controls.
- As a studio owner, I want to give a Collaborator view or manage access by area, during an invitation or later, so that each person can reach only the work they need.
- As a studio member, I want navigation and notifications to reflect my access so that I can find the work I am allowed to see.

**Acceptance criteria**:
- **AC-1**: Each existing manager account is migrated as the owner of its existing studio data. The owner has unrestricted access and is the only person who can manage studio access, studio wide settings, and AI provider credentials.
- **AC-2**: The owner can invite a new, unused email address as a Supervisor or Collaborator. The invitee must accept the single use invitation and sign in with a verified Google account before receiving access. An email already attached to a WoPhoto account is rejected with a clear explanation.
- **AC-3**: A Supervisor uses the manager workspace and has Manage access to Projects, Tasks, Schedule, Briefs, Reviews, Work Requests, Brand Assets, and Inventory, plus View access to the dashboard. The preset does not grant Deleted Tasks, Team, Copilot, studio settings, manager membership, or provider credentials.
- **AC-4**: A Collaborator starts with no studio area access. The owner selects View or Manage for each grantable area in the invite flow and can later change those grants from Studio Access. A saved grant change takes effect on the next request.
- **AC-5**: The grantable areas are Dashboard, Projects, Tasks, Schedule, Briefs, Reviews, Work Requests, Brand Assets, Inventory, Deleted Tasks, Team, and Copilot. Studio settings, manager membership, and provider credentials are always owner only. Personal account settings remain available to every signed in user. Team access never permits inviting or changing a Supervisor or Collaborator.
- **AC-6**: View grants permit reads only. Manage grants include View and permit the area's existing mutations. Copilot is available only with a Copilot grant, and every Copilot tool also checks the grant for the data area it reads or changes.
- **AC-7**: Manager workspace navigation hides areas without View access. Direct page, server action, API, file, and Copilot requests enforce the same server side rules. A missing or revoked membership is denied even if the user's account remains active.
- **AC-8**: The owner can change a member between Supervisor and Collaborator. A role change clears old Collaborator grant rows. The Supervisor receives only the fixed preset, and a Collaborator receives only newly saved grants.
- **AC-9**: When the owner revokes a Supervisor or Collaborator, future requests are denied and active sessions are removed. The account, studio data, and audit references are retained. The owner cannot revoke or demote themselves.
- **AC-10**: Projects, work requests, invitations, Copilot policy and usage, inventory, schedule events, brand assets, and brief templates are explicitly scoped to a Studio. Existing project child records inherit access through their project. Every migration backfill assigns each existing record to its current studio without exposing it across studios.
- **AC-11**: Work notifications are delivered to the owner and active manager side members who have View or Manage access to the notification's work area. Unrelated areas do not receive the notification.
- **AC-12**: Dashboard summaries show data only for areas where the member has View or Manage access. A Dashboard grant by itself does not reveal counts or names from other areas.
- **AC-13**: The Team Invitations and Studio Access UI works at phone and desktop widths. Member controls do not place internal database IDs in URLs, and unavailable actions are not shown as active controls.

## Options considered

### Option 1: Give additional users the Manager role

Every manager would continue to use the current role based access rules.

**Pros**:
- Requires fewer permission checks and a smaller interface change.

**Cons**:
- Gives every invitee owner level access to settings, credentials, team access, and all studio data.

### Option 2: Add fixed Supervisor and Collaborator roles only

Each role would have one fixed permission list in application code.

**Pros**:
- Easier to reason about than individually configured access.

**Cons**:
- Cannot give two Collaborators different access when their responsibilities differ.

### Option 3: Studio membership with fixed presets and area grants

Keep one full owner, give Supervisors a fixed operational preset, and let the owner assign Collaborators View or Manage access by area.

**Pros**:
- Supports delegation without giving every person the same access.
- Keeps owner controls separate from regular studio work.
- Provides explicit studio scope for records that currently rely on one manager ID or have no owner key.

**Cons**:
- Requires central authorization checks across manager pages, actions, APIs, uploads, notifications, and Copilot tools.
- Requires a data migration and careful checks so old records keep the right studio.

## Decision

**Chosen option**: Option 3: Studio membership with fixed presets and area grants.

Keep the existing `MANAGER` role for Studio Owners. Add distinct `SUPERVISOR` and `COLLABORATOR` user roles so an older application release cannot mistake either for a full Manager. Use `StudioMember` to prove active membership and retain join and revocation history. Supervisors use a fixed preset; Collaborators get saved area grants.

## Rationale

The current implementation treats `MANAGER` as both the manager workspace selector and the full authorization rule. Simply adding more users with that role would make them full managers. Distinct user roles also make a rollback safer, because an older release that recognizes only `MANAGER` will reject Supervisor and Collaborator accounts.

Area grants are needed because collaborators may have different duties. A fixed Supervisor preset limits configuration and keeps its owner only exclusions easy to audit. Explicit `studioId` fields let the application authorize shared records by studio rather than assuming the original manager is the studio.

## Feature design

**Data model sketch**:

| Entity | Fields and constraints |
|---|---|
| `Studio` | `id` primary key, `name`, unique `ownerUserId`, `createdAt`, `updatedAt`. One permanent owner. |
| `StudioMember` | `id`, `studioId`, unique `userId`, unique `invitationId`, `addedById`, `createdAt`, nullable `revokedAt`, nullable `revokedById`. Only Supervisor and Collaborator accounts have membership rows. No membership or a revoked row means no studio access. |
| `StudioMemberPermission` | `studioMemberId`, `area`, `accessLevel`, `updatedAt`. Unique `[studioMemberId, area]`; no row means no access. `accessLevel` is `VIEW` or `MANAGE`. |
| `Invitation` | Add required `studioId` for worker, client, Supervisor, and Collaborator invitations. The existing `role` field distinguishes the invitee role. Invitations are single use. |
| `InvitationPermission` | `invitationId`, `area`, `accessLevel`, `createdAt`. Unique `[invitationId, area]`. On acceptance, copy the rows to `StudioMemberPermission` in the same transaction. Only Collaborator invitations can have grant rows. |
| Studio owned records | Add required `studioId` to `Project`, `WorkRequest`, `CopilotStudioPolicy`, `CopilotAccessOverride`, `CopilotUsageEvent`, `InventoryItem`, `ScheduleEvent`, `BrandAsset`, and `BriefTemplate`. Keep existing manager, creator, and actor fields for attribution and history. |

`Studio.ownerUserId` relates one to one with its owner. A Studio has many `StudioMember` records and many scoped records. A manager account may belong to one Studio only. A member has many permission rows. An invitation belongs to one Studio and may have many invitation permission rows. Project child records use their project's `studioId` for access.

Inventory asset tag and serial uniqueness becomes studio scoped. Personal settings stay on the user. AI provider keys and studio Copilot policy belong to the Studio and remain owner only.

**State transitions**:

`PENDING invitation → ACCEPTED invitation + active membership → REVOKED membership`

Invitation acceptance atomically creates the user, membership, and Collaborator grants. Revocation stamps the member row and removes its active sessions; it does not delete the user or historical records.

**API surface**:

| Surface | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| Manager invitation action | Server action | email, role, Collaborator area grants | invitation ID, delivery status, expiry, invite path | Active owner; Supervisor and Collaborator invite roles only | invalid input, email already exists, invitation conflict, email delivery failure |
| Invitation acceptance | Existing token action and Auth.js sign in | single use token, verified Google identity | active user and membership | valid accepted invitation and matching verified email | expired, revoked, used, wrong email, existing account |
| Studio access list | Server rendered page query | current session | member name, email, role, grants, status | Active owner | missing or inactive owner membership |
| Update member role or grants | Server action | member ID, role, area grants | updated member summary | Active owner | invalid member, invalid area, forbidden owner only area |
| Revoke member | Server action | member ID | revoked status | Active owner | owner self removal, invalid member, already revoked |
| Workspace area read or mutation | Server page, action, API, upload, or Copilot tool | current session, requested area, required level | scoped records or mutation result | Owner, fixed Supervisor preset, or matching Collaborator grant | unauthenticated, missing membership, insufficient area level |

**Value sourcing**:

| Action | Value produced or displayed | Source |
|---|---|---|
| Resolve current Studio | Studio ID and owner status | Current Auth.js user ID matched to `Studio.ownerUserId` or active `StudioMember`; never supplied by the browser |
| Create invitation | Studio, inviter, role, email, expiry | Studio and inviter from the current session; normalized email and role from validated form input; expiry is current time plus seven days, matching the current invitation flow |
| Create member | User, Studio, role, join invitation | Verified Google email and accepted invitation; Studio and inviter from the invitation; access role from its `role` |
| Render access controls | Member identity, role, grants, status | User and StudioMember rows; grant rows from `StudioMemberPermission` |
| Authorize area | Area and required level | Static manager route/action catalog; Collaborator grant rows or Supervisor preset; owner from Studio owner relation |
| Send work notification | Recipient managers | Active Studio owner and members with View or Manage permission for the event's area; event Studio and area from its related record/action |
| Render dashboard summary | Counts, names, and area widgets | Studio scoped source records filtered to areas where the current member has View or Manage access |
| Scope a record query | Studio ID | Server resolved membership; not a query parameter or form value |

**Key invariants**:
- The Studio owner is the only owner and cannot be removed or demoted.
- Only an owner can invite, change, or revoke Supervisor and Collaborator access.
- One manager account belongs to at most one Studio. Studio membership is not granted from an existing WoPhoto account in this version.
- Collaborator permission rows are unique by member and area. `MANAGE` implies `VIEW`.
- Studio settings, manager membership, and provider credentials cannot be granted through area rows.
- Team Manage covers worker and client invitations only. It never grants manager role changes.
- Copilot access requires a Copilot grant, and each tool also requires the View or Manage grant for the data area it uses.
- Role changes clear existing Collaborator permission rows. A Collaborator receives only grants submitted with the new role.
- All server writes set `studioId` from the authenticated membership. Browser supplied Studio IDs are ignored.
- Changing a grant takes effect on the next request. No permission result is cached across requests.
- Dashboard widgets and counts use the same area grants as the underlying records; a Dashboard grant alone does not disclose data from other areas.
- A revoked member cannot authenticate into the studio even though their account and history remain.

**Security model**:

The Auth.js session identifies the user but does not itself grant manager area access. Each protected manager page and server operation resolves the active Studio and requires its area level. Owners bypass area grants. Supervisors use the fixed preset. Collaborators need an explicit row. Direct URLs, file access, upload actions, chat actions, and AI tools use the same server side policy. The UI hides unavailable destinations but is not an authorization boundary.

Workers and clients continue using their existing role and project permissions. Studio IDs for them come from the accepted invitation or related project, never from the client. No new regulated data or compliance standard is introduced.

**Critical test scenarios**:
- Existing owner data is backfilled into the correct Studio and remains visible to that owner, verifies **AC-1** and **AC-10**.
- Owner invites a new Collaborator with View and Manage grants; verified Google acceptance creates the account, active membership, and matching grant rows, verifies **AC-2** and **AC-4**.
- A registered email, invalid scope, stale invitation, mismatched Google email, or reused token cannot gain access, verifies **AC-2**, **AC-4**, and **AC-7**.
- Supervisor receives only its fixed area preset. It cannot access manager membership, studio settings, Copilot provider credentials, deleted tasks, or an ungranted Copilot tool, verifies **AC-3**, **AC-5**, and **AC-6**.
- Collaborator View can read but cannot mutate. A later grant update is effective on the next request. A direct URL or API call to an ungranted area is rejected, verifies **AC-4**, **AC-6**, and **AC-7**.
- Role changes clear old grants. Owner revocation invalidates sessions and blocks a fresh sign in while preserving user and audit records. Owner self revocation is rejected, verifies **AC-8** and **AC-9**.
- Notifications reach only members who can view the affected work area. Dashboard summaries do not leak unauthorized area data. UI hides inaccessible areas at phone and desktop widths, verifies **AC-11**, **AC-12**, and **AC-13**.

**Configuration required**:

No new environment variables or credentials.

## Build plan

1. Add Studio, StudioMember, StudioMemberPermission, InvitationPermission, role values, and nullable `studioId` fields. Backfill one Studio for each existing Manager and assign existing scoped records to the matching Studio. Assign currently global inventory and other unowned records only when their existing owner can be identified; fail the migration with an actionable report for ambiguous rows. Add indexes and constraints after the backfill. Satisfies **AC-1**, **AC-10**.
2. Add central Studio resolution and authorization helpers, and use them for manager pages, actions, APIs, file access, and Copilot tools. Keep worker and client checks project scoped. Satisfies **AC-3**, **AC-5**, **AC-6**, **AC-7**.
3. Update invite creation and acceptance so owners can invite Supervisors and Collaborators, Collaborator permissions are saved on invitations and copied atomically on acceptance, existing accounts are rejected, and revocation removes sessions while preserving audit records. Satisfies **AC-2**, **AC-4**, **AC-8**, **AC-9**.
4. Add Studio Access management to the existing Team Invitations experience. Filter manager navigation by View access, keep owner controls owner only, and support responsive member and grant controls. Satisfies **AC-3**, **AC-4**, **AC-5**, **AC-13**.
5. Update data queries and notifications to use Studio scope, including global inventory, unassigned schedule events, brand assets, and brief templates. Filter dashboard values to granted areas and send relevant work notifications by area access. Satisfies **AC-7**, **AC-10**, **AC-11**, **AC-12**.
6. Review all role checks and studio data paths, verify migration safety, and run focused automated and browser checks against the acceptance criteria. Satisfies **AC-1** through **AC-13**.

## Consequences

**Positive**:
- Owners can delegate operational work without sharing owner controls or provider credentials.
- Area checks apply to server behavior as well as navigation.
- Explicit Studio IDs create a clear boundary for shared and global studio records.

**Negative / tradeoffs**:
- Existing manager checks across the application must move from a role check to an area permission check. An omitted check can expose data, so the review must cover pages, actions, APIs, file routes, and Copilot tools.
- Collaborators can receive no access if the owner omits grants at invitation time. This is safe but may require the owner to revise the invitation before the person can work.
- A permission catalogue change requires updating its UI, server authorization mapping, and tests together.

**Neutral**:
- Existing managers become the owners of their current studios.
- Manager side users have distinct `SUPERVISOR` or `COLLABORATOR` roles in addition to `MANAGER`, `WORKER`, and `CLIENT`.
- Worker and client invitation and project access remain role based, but their invitations become studio linked.

## Migration plan

**Strategy**: Expand and backfill before switching access checks.

**Phases**:
1. Add the new tables, role enum values, and nullable studio references while keeping existing manager ownership fields. Backfill Studio records and existing rows. Validate all rows have one unambiguous Studio, then apply required constraints and indexes.
2. Deploy code that writes studio IDs alongside existing ownership fields and reads through Studio scope. New Supervisor and Collaborator accounts use distinct roles so previous releases reject them rather than grant full Manager access.
3. After the deployed build is confirmed, remove legacy manager ID filters from authorization paths where Studio scope replaces them. Keep creator and actor references for history.

**Rollback**: Revert application code only while manager invites remain disabled or no Supervisor or Collaborator accounts exist. Once those roles have been invited, an older release still rejects them because their role values are not `MANAGER`. Keep the additive Studio columns and backfilled rows during rollback; do not drop them in the rollback deployment.

**Risks**: Records without an existing owner key, especially inventory items and unassigned schedule events, cannot be safely assigned if multiple legacy Studios exist. The migration must report and stop on ambiguous records rather than attach them to an arbitrary Studio. Missing area checks in legacy actions or Copilot tools could bypass the navigation filter; verification must enumerate every manager data path.
