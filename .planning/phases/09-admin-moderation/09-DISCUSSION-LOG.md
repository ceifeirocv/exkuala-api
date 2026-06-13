# Phase 9: Admin Moderation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-13
**Phase:** 09-admin-moderation
**Areas discussed:** Unpublish semantics, Admin event list, Reuse vs rebuild (ORG), Audit + module placement

---

## Unpublish semantics — new status

| Option | Description | Selected |
|--------|-------------|----------|
| New SUSPENDED state | Admin-only EventStatus.SUSPENDED; organizer can't self-transition out | ✓ |
| Back to DRAFT | Unpublish = published → draft; organizer can re-publish | |
| Use CANCELLED (terminal) | Reuse CANCELLED; simplest, but terminal and conflates with organizer cancel | |

**User's choice:** New SUSPENDED state

## Unpublish semantics — suspend flow

| Option | Description | Selected |
|--------|-------------|----------|
| PUBLISHED↔SUSPENDED, admin-only | Only published events suspendable; reversible | |
| Suspend from any active state | Admin suspends DRAFT or PUBLISHED; restore returns to prior state | ✓ |
| Suspend one-way (no restore) | No recovery path | |

**User's choice:** Suspend from any active state (restore returns to prior status)

## Unpublish semantics — remove

| Option | Description | Selected |
|--------|-------------|----------|
| Soft-delete, any state | repository.softDelete regardless of status/ownership | ✓ |
| Soft-delete, suspend-first | Two-step (suspend then remove) | |
| Hard delete | Physically delete row | |

**User's choice:** Soft-delete, any state

---

## Admin event list — list shape

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse cursor pagination | Mirror Phase 6/7 DTO; filters ?status= + ?organizerId= | ✓ |
| Offset/page pagination | ?page=&limit= with totals | |
| Cursor + full filter set | Cursor + status + organizerId + full-text search | |

**User's choice:** Reuse cursor pagination

## Admin event list — scope/DTO

| Option | Description | Selected |
|--------|-------------|----------|
| Full entity, exclude deleted by default | Full EventEntity; ?includeDeleted=true uses withDeleted() | ✓ |
| Full entity, always include deleted | Always show removed events | |
| Dedicated admin DTO | New AdminEventDto | |

**User's choice:** Full entity, exclude deleted by default

---

## Reuse vs rebuild (ORG) — ADMIN-01

| Option | Description | Selected |
|--------|-------------|----------|
| Add pagination, reuse rest | Upgrade GET /admin/organizers to cursor pagination; keep approve/reject/history | ✓ |
| Reuse as-is | Existing status-filter list sufficient for MVP | |
| Add pagination + search | Cursor pagination plus name search | |

**User's choice:** Add pagination, reuse rest

## Reuse vs rebuild (ORG) — ADMIN-03

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse as-is | No changes to approve/reject or audit log | |
| Add adminId tracking | Extend organizer_audit_log with adminUserId | ✓ |

**User's choice:** Add adminId tracking

---

## Audit + module placement — event audit

| Option | Description | Selected |
|--------|-------------|----------|
| New event_audit_log table | Mirror organizer_audit_log (action, note, adminUserId) | ✓ |
| Reason required, no table | Structured log only, no queryable table | |
| No event audit in v1 | status + deletedAt only | |

**User's choice:** New event_audit_log table

## Audit + module placement — module

| Option | Description | Selected |
|--------|-------------|----------|
| Feature-module admin controllers | admin-events.controller.ts in events/ (mirrors admin-organizers) | ✓ |
| Dedicated src/admin/ module | New AdminModule importing both services | |

**User's choice:** Feature-module admin controllers

---

## Claude's Discretion

- Pre-suspend status mechanism (column vs. derive from audit log)
- Admin transitions as EventsService methods vs. separate AdminEventsService (organizer machine untouched either way)
- Resolving adminUserId via @CurrentUser() → UserEntity.id
- Exact HTTP verbs/paths for suspend/restore/remove/history
- 409 error body shape; VarChar lengths; audit table indexes

## Deferred Ideas

- `suspended` organizer status (admin disables approved organizer) — Phase 5 candidate, not in Phase 9 SC
- Full-text search on admin lists
- Admin dashboard aggregate metrics — v2
- PATCH /organizers/me self-update; M:M user↔organizer membership
- Organizer notifications on suspend/remove — v2
