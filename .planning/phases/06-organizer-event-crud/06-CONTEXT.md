# Phase 6: Organizer Event CRUD - Context

**Gathered:** 2026-05-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver organizer-facing event management. Approved organizers (resolved via `@CurrentOrganizer()`) can create, edit, and delete events they own. Events move through a strict one-directional status lifecycle (draft → published → cancelled). Deleted events are soft-deleted. Phase 6 also includes the organizer's own event list endpoint with cursor pagination.

**In scope:**
- `EventsModule` at `src/events/` — EventsService, EventsController, EventsModule
- `EventEntity` updates: add `@ManyToOne(() => OrganizerEntity)` and `@ManyToOne(() => CategoryEntity)` TypeORM relations; make `organizerId` NOT NULL
- TypeORM ALTER migration: wire FK constraints on existing `events` table (organizerId → organizers.id, categoryId → categories.id); make organizerId NOT NULL
- `POST /api/v1/organizer/events` — create draft event (title + startAt + categoryId required)
- `PATCH /api/v1/organizer/events/:id` — update event fields (ownership-gated; cancelled events frozen)
- `DELETE /api/v1/organizer/events/:id` — soft-delete (only draft events deletable)
- `GET /api/v1/organizer/events` — organizer's own events, cursor-paginated, excludes soft-deleted
- `GET /api/v1/organizer/events/:id` — single event detail for organizer (ownership-gated)
- Status transitions via PATCH body `{ status: 'published' | 'cancelled' }`: draft → published, published → cancelled only
- Publish gate: validates title, description, startAt, venueName, address, categoryId are non-null; rejects if startAt is in the past

**Out of scope:**
- Public event listing/discovery — Phase 7
- imageUrl field on EventEntity — Phase 7
- city field on EventEntity — Phase 7
- Admin event oversight (unpublish/remove any event) — Phase 9
- RSVP counts on events — Phase 8
- Event translations (I18N-01) — Phase 7
- Organizer profile self-update — future phase
</domain>

<decisions>
## Implementation Decisions

### ID Format

- **D-01:** Keep CUID2 (`@paralleldrive/cuid2`) for all entity IDs. Already used in UserEntity, OrganizerEntity, CategoryEntity. No migration cost. UUID migration deferred indefinitely.

### Status Lifecycle

- **D-02:** Status transitions are strictly one-directional: `draft → published → cancelled`. No reverse transitions (published → draft unpublish not allowed, cancelled → published re-activation not allowed). `APPROVED` is analogous to how OrganizerStatus works — terminal states are terminal.
- **D-03:** Cancelled is a terminal state. No recovery path for organizers. Admin (Phase 9) handles removal via separate admin endpoints.
- **D-04:** Draft events cannot be cancelled — they are deleted (soft-delete). Cancel is a public-facing action; it only applies to published events.
- **D-05:** Published events are editable (PATCH on fields while status=published is allowed). Cancelled events are frozen — PATCH on any field returns 409 if status=cancelled.
- **D-06:** Publish gate enforces `startAt > now()`. If `startAt` is in the past at time of publish transition, return 422 with message indicating the event date has passed.
- **D-07:** PATCH /organizer/events/:id with `{ status: 'published' | 'cancelled' }` drives transitions. Single endpoint — no separate /publish or /cancel endpoints. Service validates transition before any DB write (mirrors `assertTransitionAllowed` from OrganizersService).
- **D-08:** Phase 9 admin may add override capabilities for status transitions. Keep EventsService state machine clean and extensible (no hardcoded admin bypass in Phase 6).

### Required Fields

- **D-09:** Create DTO required fields: `title` (varchar 200), `startAt` (timestamptz), `categoryId` (varchar 30). All other fields optional at creation.
- **D-10:** Publish gate — service validates ALL of the following are non-null before allowing draft→published: `title`, `description`, `startAt`, `venueName`, `address`, `categoryId`. Returns 422 with array of missing fields.
- **D-11:** `endAt` — always optional, even at publish. Covers open-ended and all-day events.
- **D-12:** `ticketPrice` and `externalTicketUrl` — both always optional. Free events need neither. No coupling between price and link.
- **D-13:** `description` — optional at create, required at publish (gated in D-10). Max length: 5000 (matches existing entity column).
- **D-14:** `imageUrl` and `city` — deferred to Phase 7. Not added to EventEntity in Phase 6.
- **D-15:** Soft-delete (`DELETE /organizer/events/:id`) only allowed for draft events. Attempting to delete a published or cancelled event returns 409.

### Organizer Event List

- **D-16:** `GET /api/v1/organizer/events` — organizer's own events only (filtered by `organizerId`). Excludes soft-deleted. Requires `@CurrentOrganizer()`.
- **D-17:** Cursor pagination on `GET /organizer/events`: default limit=20, max=100. Response shape: `{ data: EventEntity[], nextCursor: string | null, hasMore: boolean }`. This shape is canonical for Phase 7 to reuse.
- **D-18:** Cursor key: composite `(startAt, id)`. Opaque base64-encoded string passed as `?cursor=` query param. Enables stable keyset pagination over startAt-sorted results.
- **D-19:** Default sort: `startAt ASC` (chronological — upcoming events first).
- **D-20:** Optional `?status=draft|published|cancelled` filter. No filter → returns all statuses.
- **D-21:** `GET /api/v1/organizer/events/:id` — single event fetch for organizer. Returns full event including draft fields. Returns 404 if event doesn't exist or belongs to another organizer (ownership-gated, no 403 leakage).

### EventsModule Structure

- **D-22:** EventsModule lives at `src/events/`. Controller handles both organizer routes (`/organizer/events`) and will host Phase 7 public routes (`/events`). Consistent with src/organizers/, src/categories/.
- **D-23:** Phase 6 adds `@ManyToOne(() => OrganizerEntity, { nullable: false })` and `@ManyToOne(() => CategoryEntity, { nullable: true })` TypeORM relations to EventEntity.
- **D-24:** `organizerId` made NOT NULL in Phase 6 migration. Events always belong to an organizer. Existing events table rows with NULL organizerId (if any) must be handled in migration (delete or assign placeholder — planner decides).
- **D-25:** Phase 6 TypeORM migration: ALTER TABLE events — add FK constraint organizerId → organizers(id), add FK constraint categoryId → categories(id), add NOT NULL constraint to organizerId.

### Claude's Discretion

- VarChar lengths for new DTO fields — follow SEC-01 pattern (name 200, description 5000, address 500, venueName 200, externalTicketUrl 2048 — already in entity).
- Exact 422 response body shape for publish gate failures (e.g., `{ statusCode: 422, message: "Cannot publish: missing required fields", missing: ["description", "venueName"] }`).
- Whether the ownership 404 on `GET /organizer/events/:id` is a hardened 404 (not 403) — consistent with Phase 5 `findApprovedById()` which also returns 404 for non-approved organizers (no info leakage).
- Index strategy for the `events` table (e.g., index on `organizerId`, `status`, `startAt` — planner decides based on query patterns).
- Whether `PATCH /organizer/events/:id` with `{ status }` and field updates in the same request is allowed, or if status transitions are always field-only patches.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 6 goal, success criteria (ORG-04, ORG-05, EVT-01, EVT-02, EVT-05), plan stubs
- `.planning/REQUIREMENTS.md` — ORG-04 (organizer CRUD), ORG-05 (ownership enforcement), EVT-01 (event fields), EVT-02 (status lifecycle), EVT-05 (soft delete)
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar lengths + @MaxLength), curated organizer model

### Prior Phase Context
- `.planning/phases/05-organizers/05-CONTEXT.md` — D-09 (EventEntity.organizerId → OrganizerEntity.id), D-11 (@CurrentOrganizer() decorator), OrganizerGuard pattern, state machine pattern (assertTransitionAllowed)
- `.planning/phases/04-categories/04-CONTEXT.md` — CategoryEntity patterns, service+controller structure
- `.planning/phases/03-users/03-CONTEXT.md` — @CurrentUser() decorator pattern (mirrors @CurrentOrganizer())

### Existing Code to Extend or Mirror
- `src/events/event.entity.ts` — existing EventEntity with full schema; Phase 6 adds @ManyToOne relations and makes organizerId NOT NULL
- `src/organizers/organizers.service.ts` — state machine pattern (`assertTransitionAllowed`) to mirror for EventsService; service structure, Logger usage, error handling
- `src/organizers/organizers.controller.ts` — controller pattern; @CurrentOrganizer() usage
- `src/organizers/dto/` — DTO pattern with @ApiProperty, @IsString, @MaxLength, @IsOptional, @IsUUID
- `src/auth/decorators/current-user.decorator.ts` — pattern for param decorators
- `src/auth/guards/roles.guard.ts` — @Roles('admin') (Phase 9 admin event endpoints will use this)
- `src/auth/decorators/public.decorator.ts` — @Public() (Phase 7 public event endpoints will use this)
- `src/categories/categories.service.ts` — service pattern: constructor injection, error handling

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@CurrentOrganizer()` decorator + `OrganizerGuard` — already built in Phase 5; use on all `/organizer/events` endpoints without modification
- `@paralleldrive/cuid2` `createId()` — CUID2 PK generation (`@BeforeInsert` pattern)
- `@Roles('admin')` decorator — Phase 9 admin event endpoints will use this
- `@Public()` decorator — Phase 7 public event endpoints will use this
- `JwtAuthGuard` + `RolesGuard` — globally registered; new controllers inherit automatically
- `assertTransitionAllowed()` pattern from `OrganizersService` — mirror for EventsService status machine

### Established Patterns
- CUID2 `@BeforeInsert` PK generation — copy from UserEntity/OrganizerEntity
- TypeORM `@DeleteDateColumn` soft-delete — already on EventEntity; `repository.softDelete(id)` sets `deletedAt`; `find()` auto-excludes soft-deleted rows
- `QueryFailedError` code `'23505'` → 409 for unique constraint violations
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation
- Controller spec: direct instantiation (no TestingModule); Service spec: TestingModule + getRepositoryToken
- Manual DTO mapping (no ClassSerializerInterceptor) — avoids field leakage
- `@ApiProperty` on all entity fields and DTO fields — required for Swagger schema generation (Phase 5 lesson)
- Service returns entity; controller calls manual mapping fn for response DTO

### Integration Points
- `src/app.module.ts` — add `EventsModule` to `imports[]`
- `src/events/event.entity.ts` — add `@ManyToOne` relations; change `organizerId` to NOT NULL
- New TypeORM migration — ALTER TABLE events to add FK constraints + NOT NULL on organizerId
- `OrganizersModule` must export `OrganizerEntity` repository for EventsModule to use `@CurrentOrganizer()` (or OrganizerGuard is exported from OrganizersModule and imported by EventsModule)

</code_context>

<specifics>
## Specific Ideas

- Publish gate response: `{ statusCode: 422, message: "Cannot publish: missing required fields", missing: ["description", "venueName"] }` — planner picks exact wording.
- Cursor encoding: base64(`${startAt.toISOString()}__${id}`) — simple, no external library needed.
- State machine allowed transitions map (mirrors OrganizersService pattern):
  ```ts
  const allowed = {
    [EventStatus.DRAFT]: [EventStatus.PUBLISHED],
    [EventStatus.PUBLISHED]: [EventStatus.CANCELLED],
    // CANCELLED: terminal — no outgoing transitions
  };
  ```
- Cursor pagination query pattern: `WHERE (startAt, id) > (:cursorStartAt, :cursorId) ORDER BY startAt ASC, id ASC LIMIT :limit+1` (fetch limit+1, set hasMore=true if count > limit, slice to limit before returning).

</specifics>

<deferred>
## Deferred Ideas

- `imageUrl` field on EventEntity — Phase 7 (public listing will display it)
- `city` field on EventEntity — Phase 7 (DISC-03 city filter)
- `PATCH /organizer/profile` (organizer self-update) — future phase (deferred in Phase 5)
- Admin event overrides (status, forced removal) — Phase 9
- Event translations (`event_translations` table, I18N-01) — Phase 7
- Evaluate splitting OrganizerAccessControl module (cohesion 0.08) — graph audit todo, deferred
- Verify inferred graph edges OrganizerEntity→UserEntity — graph audit todo, deferred
- UUID migration (all entities from CUID2 to UUID) — decided against; CUID2 stays permanently unless revisited
- Published → draft unpublish — deferred; strict one-way flow chosen for Phase 6
- startAt/endAt timezone handling for multi-city expansion — v2 (single region MVP)

</deferred>

---

*Phase: 06-organizer-event-crud*
*Context gathered: 2026-05-07*
