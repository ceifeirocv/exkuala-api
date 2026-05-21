# Phase 8: RSVP - Context

**Gathered:** 2026-05-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver authenticated two-state RSVP for events. Authenticated users can RSVP to a published event with state `INTERESTED` or `GOING` (upsert semantics), update their state, cancel (sets state to `CANCELLED`), and retrieve their personal RSVP history. Event detail returns aggregated `interestedCount` and `goingCount` from live COUNT queries.

**In scope:**
- `POST /api/v1/events/:id/rsvp` — authenticated; upserts RSVP with state INTERESTED or GOING; second call updates state
- `DELETE /api/v1/events/:id/rsvp` — authenticated; sets RSVP state to CANCELLED (logical cancel, row preserved)
- `GET /api/v1/me/rsvps` — authenticated; returns slim RSVP history (cursor-paginated) with non-CANCELLED records
- `GET /api/v1/events/:id` — extend response to include `interestedCount` and `goingCount` (live COUNT subquery)
- `RsvpEntity` — (userId, eventId) unique constraint, `state` enum (INTERESTED / GOING / CANCELLED), `rsvpedAt` timestamp
- `RsvpModule` — owns `RsvpEntity`, `RsvpService`; exports `RsvpService` for use in `EventsModule` and `MeModule`
- `MeController` — new controller under `/me` prefix for `GET /me/rsvps`
- RSVP-01, RSVP-02, RSVP-03, RSVP-04

**Out of scope:**
- Physical row deletion on cancel — state column used instead
- Denormalized RSVP counter columns on EventEntity — live COUNT only
- RSVP on unpublished/cancelled events — guard against non-PUBLISHED events
- Admin RSVP oversight — Phase 9
- Waitlist / pending-approval RSVP states — v2
- Push notifications on RSVP — v2
</domain>

<decisions>
## Implementation Decisions

### RSVP Endpoint Shape

- **D-01:** Hybrid split: write endpoints (`POST /events/:id/rsvp`, `DELETE /events/:id/rsvp`) live in the events module alongside RSVP-03 counts; read history (`GET /me/rsvps`) lives in a new `MeController` under the `/me` prefix. Matches the existing split-controller pattern (`PublicEventsController` + `EventsController` both in events module). Seeds `/me` namespace for future phases (profile, notifications).
- **D-02:** `RsvpService` is exported from `RsvpModule` and imported by both `EventsModule` (for write endpoints + RSVP-03 counts) and a new `MeModule` (for history endpoint). Standard NestJS cross-module import — mirrors `UsersService` export pattern.

### Cancel Behavior

- **D-03:** Cancel is a logical state transition, not a physical delete. `DELETE /events/:id/rsvp` sets `state = CANCELLED` on the RSVP row. Rows are preserved in the DB.
- **D-04:** Single `state` enum on `RsvpEntity` covers both RSVP state (INTERESTED / GOING) and cancel state (CANCELLED). No separate status/deletedAt column. Enum values: `INTERESTED`, `GOING`, `CANCELLED`.
- **D-05:** `GET /me/rsvps` filters `WHERE state != 'CANCELLED'` — cancelled RSVPs do not appear in history (RSVP-02 / RSVP-04).
- **D-06:** Re-RSVP after cancel: upsert semantics on `POST /events/:id/rsvp` update state back to INTERESTED or GOING (same row, state column updated).

### RSVP Counts on Event Detail (RSVP-03)

- **D-07:** Counts added via live COUNT subqueries in `PublicEventsService.findPublishedById()`. Two correlated subqueries: one for `state = 'INTERESTED'`, one for `state = 'GOING'`. No denormalized columns on `EventEntity`. No migration to `events` table.
- **D-08:** `PublicEventDetailDto` gains two new fields: `interestedCount: number` and `goingCount: number`.

### RSVP History Endpoint Shape (RSVP-04)

- **D-09:** `GET /me/rsvps` returns slim RSVP records — NOT full `PublicEventListItemDto`. Shape: `{ rsvpState: 'INTERESTED' | 'GOING', rsvpedAt: Date, event: { id, title, startAt, city, imageUrl } }`.
- **D-10:** Cursor pagination on `(rsvpedAt DESC, rsvpId)` — most-recently-RSVPed first. Same pagination envelope as Phase 7: `{ data, nextCursor, hasMore }`, default limit=20, max=100.
- **D-11:** New `RsvpHistoryItemDto` for the slim record shape. New `PaginatedRsvpHistoryDto` for the paginated envelope.

### Claude's Discretion

- `RsvpEntity` PK: cuid2 via `@BeforeInsert` + `@PrimaryColumn` — consistent with all other entities.
- Unique constraint on `(userId, eventId)` — enforced at DB level; `QueryFailedError` code `'23505'` → 409 if duplicate upsert path is ever hit (should not be with correct upsert logic).
- Guard on `POST /events/:id/rsvp`: verify event exists and is PUBLISHED before upserting RSVP. Return 404 if not found, 422 or 409 if not PUBLISHED.
- `rsvpedAt`: set on initial RSVP insert; NOT updated on state change (preserves original RSVP timestamp). Planner decides column semantics.
- Whether `MeModule` or `UsersModule` hosts the `MeController` (planner decides based on NestJS module organization).
- Whether `RSVP-01` POST returns the full RSVP record or just `{ state, rsvpedAt }`.
- Index on `(eventId)` on `rsvp` table for COUNT subquery performance (planner adds to migration).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 8 goal, success criteria (RSVP-01 through RSVP-04), plan stubs
- `.planning/REQUIREMENTS.md` — RSVP-01, RSVP-02, RSVP-03, RSVP-04 requirement definitions
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar + @MaxLength), "Out of Scope"

### Prior Phase Context (mandatory reads)
- `.planning/phases/07-public-event-discovery/07-CONTEXT.md` — D-11 (PublicEventDetailDto shape), D-13 (cursor pagination canonical shape), D-08/D-09 (city/imageUrl fields), @Public() pattern, @CurrentOrganizer() pattern
- `.planning/phases/06-organizer-event-crud/06-CONTEXT.md` — cursor pagination internals, EventsModule location, DTO mapping pattern

### Existing Code to Extend or Mirror
- `src/events/event.entity.ts` — EventEntity with status lifecycle; Phase 8 does NOT modify this entity
- `src/events/public-events.service.ts` — `findPublishedById()` to extend with COUNT subqueries (D-07)
- `src/events/dto/public-event-detail.dto.ts` — extend with `interestedCount`, `goingCount` (D-08)
- `src/users/user.entity.ts` — UserEntity (id: varchar 30 cuid2, auth0Id); RSVP has FK to users.id
- `src/auth/decorators/` — `@CurrentUser()` for authenticated RSVP endpoints
- `src/organizers/organizer.entity.ts` — pattern for cuid2 PK entity with @BeforeInsert
- `src/events/events.module.ts` — where write RSVP endpoints live (add RsvpModule import)
- `src/app.module.ts` — add RsvpEntity to TypeORM entities array

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@CurrentUser()` decorator (`src/auth/decorators/`) — use on all three RSVP endpoints (POST, DELETE, GET /me/rsvps)
- `JwtAuthGuard` — globally registered; RSVP endpoints require auth, no `@Public()` needed
- `@paralleldrive/cuid2` `createId()` — use for RsvpEntity PK (consistent with all entities)
- Cursor pagination logic from Phase 7 — reuse `{ data, nextCursor, hasMore }` envelope; new cursor key is `(rsvpedAt, rsvpId)` instead of `(startAt, id)`
- `QueryFailedError` `'23505'` → 409 pattern — apply if upsert collision is possible
- `@ApiProperty` on all entity fields and DTOs — mandatory (Phase 5 lesson)
- Manual DTO mapping pattern — service returns entity + joins; controller calls mapping fn

### Established Patterns
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation
- Controller spec: direct instantiation; Service spec: TestingModule + getRepositoryToken
- Service returns entity (with joins); controller maps to DTO — never return raw entity from controller
- VarChar lengths per SEC-01 — mirror existing column lengths on new RsvpEntity columns
- 404 (not 403) for resource not found / not owned — no-info-leakage pattern
- TypeORM upsert via `save()` on entity with known unique fields or `createQueryBuilder().insert().orUpdate()`

### Integration Points
- New `src/rsvp/` module: `rsvp.entity.ts`, `rsvp.service.ts`, `rsvp.module.ts`, DTOs, specs
- New migration: CREATE TABLE rsvps (id, userId FK→users.id, eventId FK→events.id, state enum, rsvpedAt, createdAt, updatedAt), UNIQUE (userId, eventId), INDEX (eventId)
- `src/events/public-events.service.ts` — add COUNT subqueries to `findPublishedById()`
- `src/events/events.module.ts` — import RsvpModule, add RSVP write route handlers
- `src/me/me.controller.ts` (new) + `src/me/me.module.ts` (new) — GET /me/rsvps
- `src/app.module.ts` — add RsvpEntity + MeModule

</code_context>

<specifics>
## Specific Ideas

- `RsvpEntity` upsert semantics: `INSERT INTO rsvps ... ON CONFLICT (userId, eventId) DO UPDATE SET state = EXCLUDED.state, updatedAt = NOW()`. TypeORM equivalent: `save()` with `upsert` option or raw query.
- `DELETE /events/:id/rsvp` sets `state = CANCELLED` — NOT a physical delete. Response: 204 No Content.
- `POST /events/:id/rsvp` request body: `{ state: 'INTERESTED' | 'GOING' }`. Response: `{ id, state, rsvpedAt }`.
- COUNT subquery example (in QueryBuilder):
  ```ts
  .addSelect(qb =>
    qb.select('COUNT(*)', 'count')
      .from(RsvpEntity, 'r')
      .where('r.eventId = event.id AND r.state = :interested', { interested: RsvpState.INTERESTED }),
    'interestedCount'
  )
  ```
- Cursor for `/me/rsvps`: composite `(rsvpedAt DESC, rsvpId ASC)`, base64-encoded JSON. Sort: most-recently-RSVPed first.
- History item slim shape:
  ```json
  {
    "rsvpState": "GOING",
    "rsvpedAt": "2026-05-15T10:00:00Z",
    "event": { "id": "...", "title": "...", "startAt": "...", "city": "Praia", "imageUrl": null }
  }
  ```

</specifics>

<deferred>
## Deferred Ideas

- Waitlist / PENDING RSVP state — v2 if event capacity feature added
- Push notifications on RSVP change — v2 (already in REQUIREMENTS.md v2 list)
- RSVP analytics / history audit trail — v2
- `GET /events/:id/rsvps` (admin list of who RSVPed) — Phase 9 or v2
- Rate limiting per user on RSVP endpoint — v2

### Reviewed Todos (not folded)
- Trace AuthenticatedUser bridging JWT/Organizer communities — arch investigation, not RSVP-specific; remains in backlog
- Trace why UserEntity bridges three graph communities — same
- Verify inferred graph edges OrganizerEntity → UserEntity — same

</deferred>

---

*Phase: 08-rsvp*
*Context gathered: 2026-05-21*
