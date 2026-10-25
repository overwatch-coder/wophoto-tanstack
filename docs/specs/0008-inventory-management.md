# 0008. Inventory Management for Studio and Creative Assets

**Date**: 2026-10-25
**Status**: Complete

## Summary

This specification defines a flexible inventory management system for studio equipment, computing gear, and creative project assets. It allows managers to register items across photography, videography, design, web creation, and multimedia services without forcing rigid hardware fields. Workers can search available assets, self checkout items with optional return dates, and log condition on return with automatic maintenance transitions.

## Context

WoPhoto studios share expensive and diverse resources across multiple creative disciplines. Beyond cameras, lenses, and lighting kits, teams utilize digital drawing tablets, color calibrated monitors, test mobile devices, web staging environments, and specialty production gear.

Without centralized inventory tracking, gear is misplaced, double booked, or returned with unreported damage. A rigid schema that requires serial numbers, physical shelf locations, and warranty fields breaks down when tracking creative workstations, test devices, or web staging credentials. The system needs a flexible model where only the item name is required, while optional metadata supports custom attributes for any service.

## Requirements

**User stories**:
- As a manager, I want to catalog physical equipment and creative gear with auto generated asset tags and optional custom metadata so our studio knows what assets exist.
- As a worker, I want to search and self checkout available items for shoots or project tasks so I have the tools I need without waiting for administrative sign off.
- As a worker, I want to return gear and record its condition so any damage or maintenance needs are promptly flagged.
- As a manager, I want to review maintenance tickets, log repairs, and return restored items to the available pool so the team always has reliable tools.
- As a manager, I want to retire worn out or decommissioned assets safely so they cannot be checked out again while preserving past audit history.

**Acceptance criteria**:
- **AC-1**: Managers can create, edit, and retire inventory items across all studio disciplines with unique asset tags and optional custom metadata.
- **AC-2**: Only the asset name is required during creation; hardware fields including serial number, model, location, and purchase date are optional and nullable.
- **AC-3**: Workers and managers can search the inventory catalog by name, asset tag, category, and status, viewing real time availability.
- **AC-4**: Workers can self checkout available items, transitioning item status to `IN_USE` and establishing an active loan record with an optional return deadline.
- **AC-5**: Concurrent checkout attempts on the same asset are blocked transactionally, preventing double allocation.
- **AC-6**: Returning an asset records the return timestamp, condition rating, and optional return notes, transitioning the asset back to `AVAILABLE` if no issues are flagged.
- **AC-7**: Flagging damage or maintenance issues during return creates an open maintenance record, sets the asset condition to `NEEDS_ATTENTION`, and sets the asset status to `MAINTENANCE`.
- **AC-8**: Managers can review open maintenance records, document resolution notes and repair costs, set the restored condition, and transition the asset back to `AVAILABLE` if no other open maintenance tickets remain.
- **AC-9**: Managers can retire available or maintenance assets to `RETIRED`, while active items (`IN_USE`) cannot be retired until returned.
- **AC-10**: Client accounts are strictly prohibited from accessing internal studio inventory records and actions.

## Options considered

### Option 1: Rigid hardware only schema
A traditional fixed database table with mandatory serial number, model, manufacturer, shelf location, and barcode columns.

**Pros**:
- Simple structure for cameras and lenses with uniform physical properties.

**Cons**:
- Fails when logging creative workstations, mobile test devices, or web staging resources that do not have physical serial numbers or locker bays.
- Forces workers and managers to enter fake dummy data to satisfy validation constraints.

### Option 2: Pure document or key value store
Store all inventory items as unstructured JSON blobs in a single generic table.

**Pros**:
- Completely arbitrary schema that accepts any key value combination.

**Cons**:
- Loses database level uniqueness constraints on asset tags and serial numbers.
- Makes relational lookups, borrower joins, and status indexing slow and prone to corruption.

### Option 3: Blended relational inventory model with flexible JSON metadata (Chosen)
A core relational model (`InventoryItem`) with standard status and condition enums, combined with an optional JSON metadata column for department specific attributes. Only the name is mandatory; all other hardware attributes are optional.

**Pros**:
- Guaranteed data integrity for status, active loans, and unique asset tags.
- Accommodates any creative service from photo shoots to web development and graphic design without schema migrations.
- Supports fast indexed queries for catalog browsing and checkout state.

**Cons**:
- Requires validation schemas on the server to ensure JSON metadata stays within reasonable size limits.

## Decision

**Chosen option**: Option 3: Blended relational inventory model with flexible JSON metadata.

Implement a unified `InventoryItem` model where only `name` is required, paired with relational `InventoryLoan` and `InventoryMaintenanceLog` models for checkouts and repair workflows.

## Rationale

Studios need both transactional consistency for gear checkouts and flexibility for diverse creative services. Option 3 delivers structured tracking for common workflows like active borrower status, condition logging, and maintenance transitions. At the same time, its optional fields and flexible JSON metadata allow teams to record web staging details, display color specs, or custom lens mount types without database friction.

## Feature design

**Data model sketch**:

```
InventoryItem
- id: String (cuid, primary key)
- assetTag: String (unique, auto generated sequence "INV-0001" if omitted)
- name: String (required)
- category: String (presets like "Photography", "Videography", "Computing", "Design", "Web", "Audio")
- model: String? (optional)
- serialNumber: String? (optional, unique when present; empty string coerced to null)
- status: InventoryStatus (AVAILABLE, IN_USE, MAINTENANCE, RETIRED)
- condition: InventoryCondition (EXCELLENT, GOOD, FAIR, NEEDS_ATTENTION)
- location: String? (optional physical location or "Cloud / Remote")
- purchaseDate: DateTime? (optional)
- metadata: Json? (optional custom key value attributes, max 10KB)
- notes: String?
- createdAt: DateTime
- updatedAt: DateTime

InventoryLoan
- id: String (cuid, primary key)
- itemId: String (foreign key -> InventoryItem.id, onDelete: Restrict)
- borrowerId: String (foreign key -> User.id, onDelete: Restrict)
- checkedOutAt: DateTime (default now)
- expectedReturnAt: DateTime? (optional deadline)
- returnedAt: DateTime?
- checkoutNotes: String?
- returnCondition: InventoryCondition?
- returnNotes: String?
- hasIssueReport: Boolean (default false)
- issueDetails: String?
- status: LoanStatus (ACTIVE, RETURNED)
- createdAt: DateTime
- updatedAt: DateTime
- Index: partial unique index on (itemId) where status = 'ACTIVE'

InventoryMaintenanceLog
- id: String (cuid, primary key)
- itemId: String (foreign key -> InventoryItem.id, onDelete: Restrict)
- reportedById: String (foreign key -> User.id)
- resolvedById: String? (foreign key -> User.id)
- title: String
- description: String
- resolutionNotes: String?
- cost: Decimal?
- status: MaintenanceStatus (OPEN, IN_PROGRESS, RESOLVED, CLOSED)
- startedAt: DateTime (default now)
- resolvedAt: DateTime?
```

**State transitions**:
- Asset status: `AVAILABLE` -> (worker checks out) -> `IN_USE` -> (returned clean) -> `AVAILABLE`
- Asset status on damage: `IN_USE` -> (returned with issue) -> `MAINTENANCE` -> (manager resolves) -> `AVAILABLE`
- Asset retirement: `AVAILABLE` or `MAINTENANCE` -> (manager decommissions) -> `RETIRED` (cannot retire while `IN_USE`)
- Loan status: `ACTIVE` -> (returned) -> `RETURNED`
- Overdue computation: `OVERDUE` is a computed virtual status at read time (`status === 'ACTIVE' && expectedReturnAt != null && expectedReturnAt < now()`), eliminating fragile cron jobs.

**API surface**:
| Endpoint / Server Action | Method | Key inputs | Key outputs | Auth | Key errors |
|---|---|---|---|---|---|
| `createInventoryItem` | Server Action | `name: string` (req), `category`, `model`, `serialNumber`, `location`, `purchaseDate`, `metadata` | `item: InventoryItem` | Manager | 400 invalid, 403 forbidden, 409 duplicate tag or serial |
| `updateInventoryItem` | Server Action | `id: string` (req), optional updated fields | `item: InventoryItem` | Manager | 404 not found, 403 forbidden |
| `retireInventoryItem` | Server Action | `id: string` (req), `reason: string?` | `item: InventoryItem` | Manager | 400 item is in use, 404 not found, 403 forbidden |
| `checkoutInventoryItem` | Server Action | `itemId: string` (req), `expectedReturnAt: string?`, `notes: string?` | `loan: InventoryLoan` | Worker, Manager | 400 not available, 404 not found, 409 already loaned |
| `returnInventoryItem` | Server Action | `loanId: string` (req), `condition: string`, `notes: string?`, `hasIssue: boolean`, `issueDetails: string?` | `loan: InventoryLoan` | Worker, Manager | 400 already returned, 404 not found |
| `resolveMaintenanceIssue` | Server Action | `logId: string` (req), `resolutionNotes: string`, `restoredCondition: string?`, `cost: number?` | `log: InventoryMaintenanceLog` | Manager | 400 invalid, 403 forbidden, 404 not found |

**Read queries (`lib/inventory.ts`)**:
- `getInventoryCatalog(filters: { search?: string, category?: string, status?: InventoryStatus, page?: number, pageSize?: number })`: Paginated items list with current borrower info.
- `getInventoryItem(id: string)`: Single item details with active loan and past 10 maintenance and loan records.
- `getUserActiveLoans(userId: string)`: Current active checkouts for the logged in worker or manager.
- `getMaintenanceQueue(filters?: { status?: MaintenanceStatus })`: All open and in progress maintenance issues for studio managers.

**Value sourcing**:
| Action | Value produced / displayed | Source |
|---|---|---|
| Create Item | Asset tag | User input if provided, otherwise auto generated sequence `INV-XXXX` (using atomic counter with collision retry) |
| Create Item | Initial status | Default `AVAILABLE` |
| Create Item | Initial condition | User input, default `GOOD` |
| Checkout Item | Borrower identity | Current authenticated session `session.user.id` |
| Checkout Item | Checked out timestamp | Server clock `now()` |
| Checkout Item | Active loan pointer | Atomic conditional update: `prisma.inventoryItem.updateMany({ where: { id: itemId, status: 'AVAILABLE' }, data: { status: 'IN_USE' } })` |
| Return Item | Return timestamp | Server clock `now()` |
| Return Item | Condition update | Updated to `returnCondition` parameter, or forced to `NEEDS_ATTENTION` if `hasIssue = true` |
| Return Item | Maintenance issue title | Auto synthesized: `"Issue reported on return by " + borrower.name` |
| Return Item | Maintenance description | User input `issueDetails` from return modal |
| Resolve Maintenance | Restored asset status | Transactional update setting `InventoryItem.status = AVAILABLE` only if no other open tickets exist for this item |
| Resolve Maintenance | Restored asset condition | Input `restoredCondition`, defaulting to `GOOD` |

**Key invariants**:
- An asset with status other than `AVAILABLE` cannot be checked out.
- Atomic conditional update on checkout ensures race conditions between simultaneous borrowers are safely rejected with conflict error.
- Only managers can create, edit item specs, retire items, or resolve maintenance logs.
- Workers can only return loans they initiated, while managers can return any active loan.
- An asset cannot be retired while its status is `IN_USE`.
- Unique constraints on `assetTag` and non null `serialNumber` are enforced at database level. Empty string serial numbers are coerced to null.
- Partial unique index on active loans (`InventoryLoan(itemId) WHERE status = 'ACTIVE'`) prevents double allocation at the database engine level.
- Client accounts receive 403 Forbidden on all inventory actions and routes.

**Security model**:
- Role based access enforced server side in actions, data query functions, and page components.
- `MANAGER`: Full access (create, edit, retire, checkout, return any, resolve maintenance).
- `WORKER`: Read access to catalog, self checkout available items, view and return their own active loans.
- `CLIENT`: No access. Inventory routes redirect or return 403.

**Navigation and route wiring**:
- Manager route: `/manager/inventory` added to studio operations group in `lib/navigation.ts`.
- Worker route: `/worker/inventory` added to resources group in `lib/navigation.ts`.
- Clean replacement for any placeholder section page in `app/(workspace)/manager/[section]/page.tsx`.

**Critical test scenarios**:
- Happy path: Manager creates item with optional metadata, worker checks it out, status becomes `IN_USE`, worker returns it in good condition, status returns to `AVAILABLE`, verifies **AC-1**, **AC-3**, **AC-4**, **AC-6**.
- Optional fields: Item created with only a name succeeds, hardware fields including purchaseDate and serialNumber remain null, verifies **AC-2**.
- Concurrency locking: Two simultaneous checkouts on the same asset result in one success and one clean conflict error, verifies **AC-5**.
- Damage workflow: Returning an item with damage flagged marks status as `MAINTENANCE`, condition as `NEEDS_ATTENTION`, and logs an open maintenance issue with borrower context, verifies **AC-7**.
- Maintenance resolution: Manager resolves maintenance with repair notes and restored condition, setting item status to `AVAILABLE` when no other tickets remain, verifies **AC-8**.
- Retirement protection: Manager can retire an available asset, but attempting to retire an asset in `IN_USE` status fails with a validation error, verifies **AC-9**.
- Role boundary: Client attempting to invoke checkout or view inventory routes receives 403 Forbidden, verifies **AC-10**.

## Build plan

1. Add Prisma schema definitions for `InventoryItem`, `InventoryLoan`, `InventoryMaintenanceLog`, and related enums with partial unique active loan index, then execute database migration, satisfies **AC-1**, **AC-2**, **AC-5**.
2. Build the data access layer in `lib/inventory.ts` (`getInventoryCatalog`, `getInventoryItem`, `getUserActiveLoans`, `getMaintenanceQueue`), satisfies **AC-3**, **AC-4**.
3. Implement server actions in `app/actions/inventory.ts` with Zod validation, role authorization, atomic concurrency checks, and transactional status updates, satisfies **AC-1**, **AC-4**, **AC-5**, **AC-6**, **AC-7**, **AC-8**, **AC-9**, **AC-10**.
4. Wire navigation destinations in `lib/navigation.ts` and set up page routes for `/manager/inventory` and `/worker/inventory`, satisfies **AC-3**, **AC-10**.
5. Build the inventory catalog view with category pills, live availability indicators, overdue badges, and asset search bar, satisfies **AC-1**, **AC-3**.
6. Build the manager item dialog for creating, editing, and retiring inventory assets, satisfies **AC-1**, **AC-2**, **AC-9**.
7. Build the worker self checkout modal with optional expected return date and purpose notes, satisfies **AC-4**, **AC-5**.
8. Build the return modal with condition selection and damage reporting, satisfies **AC-6**, **AC-7**.
9. Build the manager maintenance drawer for tracking and resolving open repair tickets, satisfies **AC-8**.
10. Add comprehensive automated tests in `test/inventory.test.ts` verifying permissions, validation, concurrency locking, damage transitions, and retirement invariants, satisfies **AC-1** through **AC-10**.

## Consequences

**Positive**:
- Centralized visibility over studio hardware, testing devices, and creative assets.
- Complete audit trail of who borrowed which item and when.
- Fast self service checkout without administrative bottlenecks.
- Flexible schema that handles creative services beyond traditional photography gear.
- Database level concurrency protection against double booking.

**Negative / tradeoffs**:
- Requires studio team discipline to record checkouts and returns promptly.
- Auto generated asset tags require physical labelling on studio equipment for best results.

**Neutral**:
- Adds three new database tables and one new top level navigation destination for managers and workers.

## Follow-up

- [ ] Add barcode or QR code scanning support for mobile camera checkouts in a future update.
- [ ] Connect overdue loan reminders to the existing email and notification center pipeline.
