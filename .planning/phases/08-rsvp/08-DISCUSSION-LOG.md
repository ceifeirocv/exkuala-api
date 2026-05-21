# Phase 8: RSVP - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-21
**Phase:** 08-rsvp
**Areas discussed:** RSVP endpoint shape, Cancel behavior, History endpoint shape, RSVP counts strategy

---

## RSVP Endpoint Shape

| Option | Description | Selected |
|--------|-------------|----------|
| Hybrid (event-centric writes + MeController reads) | POST/DELETE /events/:id/rsvp in events module; GET /me/rsvps in new MeController. Matches split-controller precedent, seeds /me namespace. | ✓ |
| Event-centric writes + user-centric reads | Same split, different framing. | |
| Full user-centric /me | All RSVP operations under /me/rsvps. eventId in body for writes. | |

**User's choice:** Hybrid (Recommended)
**Notes:** Matches existing PublicEventsController + EventsController split. RsvpService exported and imported by both EventsModule and MeModule.

---

## Cancel Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Physical DELETE | Remove the row. Simple, no migration, no drift. | |
| Soft-delete (@DeleteDateColumn) | Consistent with EventEntity. Needs partial unique index. | |
| Status column (state enum) | INTERESTING / GOING / CANCELLED in single state column. | ✓ |

**User's choice:** Status column (free-text "status column")
**Follow-up — which states:** INTERESTED / GOING / CANCELLED (single enum covers both RSVP state and cancel state)
**Notes:** DELETE /events/:id/rsvp sets state = CANCELLED. Rows preserved. Re-RSVP updates state back via upsert.

---

## History Endpoint Shape (RSVP-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Slim RSVP record + cursor | { rsvpState, rsvpedAt, event: { id, title, startAt, city, imageUrl } }. Cursor on (rsvpedAt, rsvpId). | ✓ |
| Full PublicEventListItemDto + rsvpState + cursor | Full event object. Heavy JOIN but zero client mapping. | |

**User's choice:** Slim RSVP record + cursor (Recommended)
**Notes:** Cursor anchor is rsvpedAt DESC (most-recently-RSVPed first). New RsvpHistoryItemDto. Filters WHERE state != CANCELLED.

---

## RSVP Counts Strategy (RSVP-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Live COUNT subquery | Two correlated COUNT subqueries in findPublishedById(). No migration, no drift. | ✓ |
| Denormalized columns on EventEntity | interestedCount/goingCount int columns. O(1) read but counter drift risk. | |

**User's choice:** Live COUNT subquery (Recommended)
**Notes:** PublicEventDetailDto gains interestedCount and goingCount. No EventEntity schema change.

---

## Claude's Discretion

- RsvpEntity PK type (cuid2 consistent with all entities)
- Guard behavior on RSVP to non-PUBLISHED event (404 vs 422)
- rsvpedAt update semantics (set on insert, preserved on state change)
- MeModule vs UsersModule as home for MeController
- POST /events/:id/rsvp response shape (full record vs minimal)
- Index on (eventId) on rsvp table for COUNT query performance

## Deferred Ideas

- Waitlist / PENDING RSVP state — v2
- Push notifications on RSVP change — v2
- RSVP analytics / audit trail — v2
- GET /events/:id/rsvps (admin view) — Phase 9 or v2
- Rate limiting per user on RSVP endpoint — v2
- Reviewed arch todos (UserEntity bridge, AuthenticatedUser communities) — remain in backlog, not RSVP-specific
