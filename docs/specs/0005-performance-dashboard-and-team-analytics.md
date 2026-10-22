# 0005. Performance Dashboard and Team Analytics

**Date**: 2026-10-22
**Status**: Accepted

## Summary

WoPhoto provides role-adapted performance dashboards across Managers, Workers, and Clients. Managers gain full operational visibility with three view modes: Internal Performance (KPI cards, weekly load heatmap, service stream breakdowns, collaborator ranking bars), Team Roster (collaborator table with search, capacity filters, completed volumes, turnaround days, and active task loads), and Demand Analysis (service reliability and turnaround benchmarks). Workers receive a personal productivity overview with their assignments, deadlines, and daily work logs. Clients receive a project delivery portal showing project completion progress and deliverable milestones.

## Context

Previous iterations established the role-aware layout shell and task management engine. However, the root dashboards (`/manager`, `/worker`, `/client`) displayed construction placeholders. Managers lacked real-time visibility into team velocity, capacity bottlenecks, on-time delivery percentages, and service-level performance. Workers had no single hub summarizing their active tasks and daily log history. Clients could not see high-level project progress.

The dashboard designs use WoPhoto's dark orange brand theme (`#d85a2b` / `#f97316`), matching the internal performance reference designs.

## Requirements

**User stories**:
- As a manager, I want to toggle between internal performance metrics, a team capacity roster, and service demand analysis so that I can balance workload and ensure on-time delivery.
- As a worker, I want to see my personal productivity metrics, active assignments, and recent daily logs so that I can manage my day efficiently.
- As a client, I want to see an overview of my projects, completed deliverables, and on-time progress so that I can stay informed.

**Acceptance criteria**:
- **AC-1**: Managers can view team productivity KPIs (active tasks per person, team productivity, average task duration, on-time delivery rate, workload balance index) scoped to their managed projects.
- **AC-2**: Managers can toggle between three views via pill navigation: `Internal Performance` (operational matrix, heatmap, service workload table, collaborator on-time ranking bars), `Team Roster` (collaborator table with search, capacity filter pills, completed tasks, turnaround days, active task counts, on-time rate badges), and `Demand Analysis` (service stream reliability and turnaround benchmarks).
- **AC-3**: Workers access a personal productivity dashboard at `/worker` showing their own active tasks, completed tasks, on-time rate, average duration, upcoming deadlines, and recent daily work logs.
- **AC-4**: Clients access a project delivery dashboard at `/client` showing their active projects, completed deliverables, deliverables in progress, on-time delivery percentage, and project progress meters.
- **AC-5**: All dashboard queries are server-side and role-scoped: managers query only their managed projects and collaborators; workers query only their own assignments and entries; clients query only projects belonging to them.

## Data Model & Server Queries

1. **`lib/analytics.ts`**:
   - `getManagerAnalytics()`: computes real metrics from database `Task`, `TaskAssignee`, `Project`, and `User` records with fallbacks to baseline averages when sample sizes are small.
   - `getWorkerAnalytics()`: computes worker-specific task counts, on-time submission rate, upcoming deadlines, and recent daily entries.
   - `getClientAnalytics()`: computes client project counts, completed tasks, in-progress tasks, and deliverable status.

2. **Components**:
   - `components/dashboard/manager-dashboard.tsx`: client component with segmented pill toggle for `Internal Performance`, `Team Roster`, and `Demand Analysis`.
   - `components/dashboard/worker-dashboard.tsx`: personal worker dashboard with quick actions to log work.
   - `components/dashboard/client-dashboard.tsx`: client deliverable tracker with project progress indicators.
