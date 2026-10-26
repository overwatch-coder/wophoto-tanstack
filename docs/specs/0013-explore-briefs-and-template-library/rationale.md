# 0013. Explore Briefs and Template Library for Production Reuse · Decision record

## Context

Commercial photography and video studios regularly execute repeat shoot styles, such as e-commerce white seamless apparel, editorial lookbooks, commercial product packaging, and beauty close ups. In WoPhoto, creative briefs and shot lists currently live exclusively inside individual projects. When a manager starts a new project of a familiar type, they must manually retype deliverable specifications, recreate lighting guidelines, and reconstruct multi item shot lists from memory.

Furthermore, past creative briefs across completed studio projects represent valuable production knowledge. Without a central discovery tool, workers and managers cannot search prior shoot briefs for technical references or equipment notes.

WoPhoto needs a dedicated Explore Briefs and Template Library workspace. The system must support curated master templates, one click conversion from existing project briefs, flexible categorization and tag filtering, and instant instantiation of new briefs either into existing projects or alongside fresh project shells.

## Options considered

### Option 1: Polymorphic CreativeBrief table with template flags

Add an `isTemplate` boolean and make `projectId` nullable on the existing `CreativeBrief` table.

**Pros**:
- Reuses the existing table without introducing a new Prisma model.
- Minimal migration footprint initially.

**Cons**:
- Making `projectId` nullable breaks existing compound indexes and weakens foreign key guarantees.
- Mixing draft templates with project sign offs and crew discussions creates complex query filters and data leakage risks.

### Option 2: Dedicated BriefTemplate model with deep clone instantiation

Create a separate `BriefTemplate` model with studio category enum, searchable tags, usage metrics, and cover preview images, cleanly decoupled from live project briefs.

**Pros**:
- Clear separation of concerns between reusable master blueprints and active project briefs.
- Prevents sign off records, crew discussions, and project lifecycle states from leaking into template definitions.
- Enables template usage tracking and independent template cover art.

**Cons**:
- Requires a new database model and dedicated validation schemas.

## Rationale

Decoupling templates from project briefs keeps live project invariants clean. Project briefs carry sign off snapshots, worker discussion threads, and project specific lifecycle states that make no sense on a master template. A dedicated `BriefTemplate` model allows managers to safely archive, categorize, and evolve studio guidelines without altering past project records or complicating client security boundaries. Aligning field names (such as `summary` and `guidelines`) between `BriefTemplate` and `CreativeBrief` ensures bidirectional conversion and instantiation remain transparent and type safe.
