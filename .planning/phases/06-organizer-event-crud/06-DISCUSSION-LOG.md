# Phase 6: Organizer Event CRUD - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-07
**Phase:** 06-organizer-event-crud
**Areas discussed:** ID format, Status transitions, Required fields at create, Organizer event list, EventsModule scope

---

## ID Format (cross-cutting question raised by user)

| Option | Description | Selected |
|--------|-------------|----------|
| Keep CUID2 | Already used everywhere; no migration cost | ✓ |
| UUID v7 for events only | Time-ordered, standard; creates inconsistency with existing entities | |
| Migrate all to UUID — separate phase | Clean break; significant migration work | |

**User's choice:** Keep CUID2
**Notes:** User raised this proactively. Decided to keep CUID2 permanently across all entities.

---

## Status Transitions

| Question | Options | Selected |
|----------|---------|----------|
| One-way or allow unpublish? | Strict one-way / Unpublish allowed | Strict one-way |
| Draft → cancelled allowed? | Yes / Only published → cancelled | Only published → cancelled |
| Past-date publish? | No enforcement / Reject if past | Reject if past |
| Cancelled editable? | Frozen / Editable | Frozen |
| Delete any status? | Any status / Draft only | Draft only |
| Transition endpoint style? | General PATCH with status field / Dedicated endpoints | General PATCH |
| Published fields editable? | Yes (editable) / Locked | Yes, editable |
| Phase 9 re-examination? | Yes, note for Phase 9 / No, permanent | Yes, note for Phase 9 |
| Cancelled terminal? | Cancelled is terminal / Allow re-activate | Terminal |
| startAt < endAt validation? | Yes at DTO level / No | (interrupted — skipped) |

**Notes:** User wanted thorough coverage of all edge cases. Key decisions: strict one-way state machine, draft-only deletions, cancelled events frozen, published events editable.

---

## Required Fields at Create

| Question | Options | Selected |
|----------|---------|----------|
| Required at create? | Title+startAt only / All 8 fields / Title+startAt+categoryId | Title+startAt+categoryId |
| Publish gate? | Yes, enforce completeness / No gate | Yes, enforce completeness |
| Gate fields? | title+startAt+categoryId+venueName+address / title+startAt+categoryId only | title+startAt+categoryId+venueName+address |
| Ticket fields? | Both optional / If price > 0 link required | Both optional |
| description at create? | Required at publish / Always optional / Required at create | Required at publish |
| endAt? | Always optional / Required at publish | Always optional |
| imageUrl in Phase 6? | Add now / Defer to Phase 7 | Defer to Phase 7 |
| city column in Phase 6? | Add now / Defer to Phase 7 | Defer to Phase 7 |

**Notes:** Minimal create (title+startAt+categoryId); completeness enforced at publish gate.

---

## Organizer Event List

| Question | Options | Selected |
|----------|---------|----------|
| Include in Phase 6? | Yes / Phase 7 only | Yes |
| Route pattern? | GET /organizer/events / GET /events?mine=true | GET /organizer/events |
| Include deleted? | No, exclude / Yes, include with flag | No |
| Pagination? | Simple list / Cursor pagination | Cursor pagination |
| Sort? | startAt ASC / createdAt DESC | startAt ASC |
| Include single fetch? | Yes / No | Yes |
| Status filter? | Yes, optional / No filter | Yes, optional |
| Page size? | limit=20, max=100 / limit=50, max=200 | limit=20, max=100 |
| Response shape? | Decide now { data[], nextCursor, hasMore } / Defer | Decide now |
| nextCursor null or absent? | null / absent | null |
| Opaque or transparent cursor? | Opaque base64 / Transparent params | Opaque base64 |

**Notes:** Cursor pagination locked in Phase 6 to establish the canonical shape for Phase 7 to reuse.

---

## EventsModule Scope

| Question | Options | Selected |
|----------|---------|----------|
| Module location? | src/events/ / src/organizers/events/ | src/events/ |
| @ManyToOne relations? | Add both / Keep bare FK | Add both |
| organizerId nullable? | Make NOT NULL / Keep nullable | Make NOT NULL |
| Migration scope? | Create table / Alter existing table | Alter existing table |
| Wire categoryId relation? | Yes, both relations / Only organizerId | Yes, both |

**Notes:** Events table already exists from Phase 1.1 baseline migration. Phase 6 alters it to add FK constraints and NOT NULL on organizerId.

---

## Claude's Discretion

- Exact 422 response body shape for publish gate failures
- Whether ownership checks on GET /organizer/events/:id return 404 (not 403) — info leakage prevention
- Index strategy for events table (organizerId, status, startAt)
- Whether PATCH can mix field updates and status transition in one request

## Deferred Ideas

- imageUrl — Phase 7
- city column — Phase 7
- Event translations (I18N-01) — Phase 7
- Admin event overrides — Phase 9
- OrganizerAccessControl module split evaluation — graph audit, deferred
- UUID migration — decided against, CUID2 permanent
- Published → draft unpublish — rejected in Phase 6, revisit if needed
- startAt/endAt timezone handling — v2 multi-region
