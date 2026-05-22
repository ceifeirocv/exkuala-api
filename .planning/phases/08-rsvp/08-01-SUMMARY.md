---
phase: 08-rsvp
plan: 01
subsystem: api
tags: [nestjs, typeorm, postgres, rsvp, cursor-pagination, tdd]

# Dependency graph
requires:
  - phase: 07-public-event-discovery
    provides: PublicEventDetailDto shape, EventsService.findPublishedById(), cursor pagination pattern, @Public() decorator, JwtAuthGuard global registration
  - phase: 06-organizer-event-crud
    provides: EventEntity with status lifecycle, EventsModule structure, split-controller pattern
  - phase: 05-organizer-management
    provides: OrganizerEntity cuid2 PK pattern, @CurrentUser() decorator, AuthenticatedUser type
provides:
  - RsvpEntity (cuid2 PK, userId FK, eventId FK, RsvpState enum, rsvpedAt insert-only)
  - RsvpService (upsertRsvp, cancelRsvp, listUserRsvps, countByEventAndState)
  - RsvpModule (exports RsvpService for EventsModule + MeModule)
  - EventsRsvpController — POST/DELETE /events/:id/rsvp (authenticated)
  - MeController — GET /me/rsvps (authenticated, cursor-paginated)
  - MeModule — seeds /me namespace
  - EventsService.findPublishedById() extended with live interestedCount + goingCount
  - Migration 1750000000000-rsvps.ts — rsvps table skeleton (created by sync before migration ran)
  - Migration 1750000000001-rsvps-constraints.ts — UNIQUE constraint, FK constraints, indexes
  - PublicEventDetailDto.interestedCount + goingCount fields
affects: [09-admin-rsvp-oversight, future-me-endpoints, any-phase-using-EventsService-findPublishedById]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "createQueryBuilder().insert().orUpdate(['col1','col2'], ['conflictCol1','conflictCol2']) — preserves non-updated columns (rsvpedAt) on upsert conflict; NOT repository.upsert()"
    - "Corrective migration pattern: when synchronize:true pre-creates table before migration, add a follow-up migration to apply missing constraints/indexes"
    - "@Unique(['userId','eventId']) on entity required alongside migration constraint — synchronize:true drops constraints not present on entity"
    - "id must be set explicitly in createQueryBuilder().insert().values({id: createId(), ...}) — @BeforeInsert() does not fire on QB insert"
    - "MeModule seeds /me namespace; imports RsvpModule, no forFeature (owns no entities)"
    - "leftJoinAndMapOne for scalar FK relations (no @ManyToOne) — cast result to (Entity & { joined: JoinedEntity })[]"

key-files:
  created:
    - src/rsvp/rsvp.entity.ts
    - src/rsvp/rsvp.service.ts
    - src/rsvp/rsvp.module.ts
    - src/rsvp/dto/create-rsvp.dto.ts
    - src/rsvp/dto/rsvp-response.dto.ts
    - src/rsvp/dto/rsvp-history-item.dto.ts
    - src/rsvp/dto/paginated-rsvp-history.dto.ts
    - src/rsvp/dto/rsvp-history-query.dto.ts
    - src/events/events-rsvp.controller.ts
    - src/me/me.controller.ts
    - src/me/me.module.ts
    - src/database/migrations/1750000000000-rsvps.ts
    - src/database/migrations/1750000000001-rsvps-constraints.ts
    - src/rsvp/rsvp.service.spec.ts
    - src/events/events-rsvp.controller.spec.ts
    - src/me/me.controller.spec.ts
  modified:
    - src/events/events.service.ts
    - src/events/events.module.ts
    - src/events/dto/public-event-detail.dto.ts
    - src/events/events.service.spec.ts
    - src/events/public-events.service.spec.ts
    - src/app.module.ts

key-decisions:
  - "Cancel = logical CANCELLED state (not physical delete) — row preserved for re-RSVP upsert (D-03)"
  - "upsertRsvp uses createQueryBuilder().orUpdate() not repository.upsert() — preserves rsvpedAt on state change"
  - "id must be set explicitly in QB insert values — @BeforeInsert() does not fire on createQueryBuilder().insert()"
  - "@Unique(['userId','eventId']) required on entity — synchronize:true would drop DB-only constraint on app restart"
  - "RsvpModule registers EventEntity in forFeature for PUBLISHED guard in upsertRsvp (no circular dep)"
  - "EventsRsvpController separate from PublicEventsController — class-level @Public() would bypass JWT guard on RSVP routes"
  - "MeModule owns no entities — MeController receives RsvpService via RsvpModule import"
  - "Corrective migration 1750000000001 needed: synchronize:true pre-created rsvps without constraints before migration ran"

patterns-established:
  - "QB insert with explicit id: set id = createId() in values() when @BeforeInsert() is the only PK generator"
  - "Corrective migration for dev-sync drift: when table pre-exists without constraints, add idempotent ALTER TABLE migration"
  - "@Unique decorator parity with migration: entity decorators must match migration constraints when synchronize:true is active"

requirements-completed: [RSVP-01, RSVP-02, RSVP-03, RSVP-04]

# Metrics
duration: ~3h
completed: 2026-05-22
---

# Phase 8: RSVP Summary

**Authenticated two-state RSVP with upsert semantics, logical cancel, live attendance counts on event detail, and cursor-paginated personal RSVP history via POST/DELETE /events/:id/rsvp and GET /me/rsvps**

## Performance

- **Duration:** ~3h
- **Started:** 2026-05-22
- **Completed:** 2026-05-22
- **Tasks:** 6 (5 automated + 1 human-verified)
- **Files modified:** 20

## Accomplishments

- Full RSVP lifecycle: INTERESTED/GOING upsert, logical cancel (state=CANCELLED), re-RSVP after cancel via same upsert path
- Live `interestedCount` + `goingCount` on GET /events/:id via parallel `countByEventAndState()` calls (no denormalized columns)
- Cursor-paginated GET /me/rsvps with `(rsvpedAt DESC, id ASC)` order, `<` comparison, excludes CANCELLED
- 4-wave TDD: RED stubs → infrastructure → implementation GREEN → wiring; 149/149 tests pass across 24 suites
- Human verification: all 7 checks approved (upsert semantics, counts, history, cancel, re-RSVP, guard on non-published, Swagger)

## Task Commits

1. **Task 1: Wave 0 TDD RED stubs** — `29a45f6` (test)
2. **Task 2: Wave 1 infrastructure** — `5350c64` (feat)
3. **Task 3: Wave 2 RsvpService + RsvpModule** — `dc12c00` (feat)
4. **Task 4: Wave 2 controllers + EventsService** — `ecbf481` (feat)
5. **Task 5: Wave 3 wiring + migration** — `eec4aa8` (feat)
6. **Fix: corrective constraints migration** — `89e189f` (fix)
7. **Fix: @Unique decorator on RsvpEntity** — `36ee089` (fix)
8. **Fix: explicit id in upsertRsvp QB insert** — `7d2ddd2` (fix)

## Files Created/Modified

- `src/rsvp/rsvp.entity.ts` — RsvpEntity with cuid2 PK, RsvpState enum, enumName: 'rsvp_state', @Unique(['userId','eventId'])
- `src/rsvp/rsvp.service.ts` — upsertRsvp, cancelRsvp, listUserRsvps, countByEventAndState
- `src/rsvp/rsvp.module.ts` — exports RsvpService, registers RsvpEntity + EventEntity
- `src/rsvp/dto/create-rsvp.dto.ts` — INTERESTED/GOING only (CANCELLED excluded)
- `src/rsvp/dto/rsvp-response.dto.ts` — POST 201 response shape
- `src/rsvp/dto/rsvp-history-item.dto.ts` — slim history item (rsvpState, rsvpedAt, event)
- `src/rsvp/dto/paginated-rsvp-history.dto.ts` — cursor-paginated envelope
- `src/rsvp/dto/rsvp-history-query.dto.ts` — cursor/limit query params
- `src/events/events-rsvp.controller.ts` — POST/DELETE /events/:id/rsvp, no @Public()
- `src/me/me.controller.ts` — GET /me/rsvps, no @Public()
- `src/me/me.module.ts` — imports RsvpModule, registers MeController
- `src/events/events.service.ts` — findPublishedById uses Promise.all for RSVP counts, injects RsvpService
- `src/events/events.module.ts` — adds RsvpModule + EventsRsvpController
- `src/events/dto/public-event-detail.dto.ts` — adds interestedCount + goingCount
- `src/app.module.ts` — adds RsvpEntity to TypeORM entities, imports MeModule
- `src/database/migrations/1750000000000-rsvps.ts` — rsvps table skeleton
- `src/database/migrations/1750000000001-rsvps-constraints.ts` — UNIQUE + FK + indexes
- `src/rsvp/rsvp.service.spec.ts` — 9 tests (upsertRsvp, cancelRsvp, listUserRsvps, countByEventAndState)
- `src/events/events-rsvp.controller.spec.ts` — 2 tests (POST, DELETE)
- `src/me/me.controller.spec.ts` — 2 tests (GET, cursor pass-through)
- `src/events/events.service.spec.ts` — extended with 3 RSVP count tests
- `src/events/public-events.service.spec.ts` — added RsvpService mock (required by EventsService constructor)

## Decisions Made

- `createQueryBuilder().orUpdate()` over `repository.upsert()` — upsert() does not allow excluding columns from the conflict update list; orUpdate(['state','updatedAt'], [...]) preserves rsvpedAt and id
- `@Unique(['userId','eventId'])` added to entity after fix commit 36ee089 — synchronize:true drops DB-only constraints not reflected on entity; parity required
- Explicit `id: createId()` in QB insert values (fix 7d2ddd2) — @BeforeInsert() lifecycle hook does not fire when using `createQueryBuilder().insert()`
- Corrective migration 1750000000001 — synchronize:true in dev mode pre-created the rsvps table before the migration ran; the original migration's CREATE TABLE was skipped silently, leaving no constraints

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] public-events.service.spec.ts broken by EventsService constructor change**
- **Found during:** Task 4 (extending EventsService)
- **Issue:** EventsService constructor gained RsvpService parameter; TestingModule in public-events.service.spec.ts did not provide it — DI error at runtime
- **Fix:** Added `{ provide: RsvpService, useValue: mockRsvpService }` to the spec's TestingModule providers
- **Files modified:** src/events/public-events.service.spec.ts
- **Verification:** npx jest "public-events.service.spec" — 9/9 pass
- **Committed in:** ecbf481

**2. [Rule 1 - Bug] import type required for AuthenticatedUser in decorated parameter positions**
- **Found during:** Task 4 (creating EventsRsvpController and MeController)
- **Issue:** TS1272 — with `isolatedModules:true` + `emitDecoratorMetadata:true`, types in decorated signatures must use `import type`
- **Fix:** Changed `import { AuthenticatedUser }` to `import type { AuthenticatedUser }` in both new controllers
- **Files modified:** src/events/events-rsvp.controller.ts, src/me/me.controller.ts
- **Verification:** pnpm tsc --noEmit — clean
- **Committed in:** ecbf481

**3. [Rule 1 - Bug] ON CONFLICT constraint missing — upsert failed at runtime**
- **Found during:** Task 6 human verification
- **Issue:** TypeORM synchronize:true pre-created rsvps table without UNIQUE constraint before migration ran; migration skipped CREATE TABLE (table existed), leaving no conflict target for orUpdate()
- **Fix:** Corrective migration 1750000000001-rsvps-constraints.ts to ALTER TABLE ADD CONSTRAINT + FK + indexes
- **Files modified:** src/database/migrations/1750000000001-rsvps-constraints.ts
- **Verification:** psql \d rsvps confirms UQ_rsvps_userId_eventId present; pnpm test 149/149 pass
- **Committed in:** 89e189f

**4. [Rule 1 - Bug] synchronize:true drops DB-only UNIQUE constraint on app restart**
- **Found during:** Post-89e189f verification (fix commit 36ee089)
- **Issue:** UNIQUE constraint added via migration would be dropped by TypeORM sync on next app start because the entity had no matching @Unique decorator
- **Fix:** Added @Unique(['userId', 'eventId']) to RsvpEntity
- **Files modified:** src/rsvp/rsvp.entity.ts
- **Committed in:** 36ee089

**5. [Rule 1 - Bug] @BeforeInsert() does not fire on createQueryBuilder().insert()**
- **Found during:** Post-89e189f verification (fix commit 7d2ddd2)
- **Issue:** upsertRsvp() QB insert produced rows with null/empty id because createId() in @BeforeInsert() is bypassed when using QB-level insert
- **Fix:** Set `id: createId()` explicitly in the values() call inside upsertRsvp()
- **Files modified:** src/rsvp/rsvp.service.ts
- **Committed in:** 7d2ddd2

---

**Total deviations:** 5 auto-fixed (all Rule 1 — bugs)
**Impact on plan:** All fixes necessary for correctness. No scope creep. Patterns 4 and 5 are now documented for future phases.

## Issues Encountered

- Migration 1750000000000 recorded as "executed" in the migrations table even though CREATE TABLE was skipped (table pre-existed). TypeORM does not diff individual statements within a migration — it treats the whole migration as atomic. The corrective migration approach is the correct pattern for this class of dev-sync drift.
- `TIMESTAMPTZ` in migration vs `timestamp without time zone` from synchronize:true — the columns are timezone-naive in the actual table. Functionally equivalent for this API (all timestamps stored as UTC), but a mismatch to be aware of if the schema is ever reset.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Phase 9 (Admin RSVP Oversight) can build on RsvpService.countByEventAndState() and RsvpEntity
- RsvpService exported from RsvpModule — any future module needing RSVP data imports RsvpModule
- /me namespace seeded — MeModule is the natural home for future profile/notification endpoints
- All 4 requirements (RSVP-01 through RSVP-04) verified passing; 149 tests green

---
*Phase: 08-rsvp*
*Completed: 2026-05-22*
