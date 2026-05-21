---
phase: 07-public-event-discovery
plan: 04
subsystem: api
tags: [nestjs, typeorm, postgres, cursor-pagination, full-text-search, i18n]

requires:
  - phase: 07-public-event-discovery
    plan: 02
    provides: DTOs — PublicEventsQueryDto, PaginatedPublicEventsResponseDto, PublicEventListItemDto, PublicEventDetailDto, UpsertEventTranslationDto
  - phase: 07-public-event-discovery
    plan: 03
    provides: EventTranslationEntity, EventEntity extended with imageUrl/city/searchVector/translations
  - phase: 06-organizer-event-crud
    provides: EventsService base with cursor pagination, findOwnedOrThrow, encodeCursor/decodeCursor static methods

provides:
  - EventsService.findPublished(query): cursor-paginated PUBLISHED events with 5 filter types
  - EventsService.findPublishedById(id): public event detail with translations map
  - EventsService.upsertTranslation(organizerId, eventId, locale, dto): organizer translation upsert
  - Private helpers: findPublishedOrThrow, buildTranslationsMap, toPublicListItemDto, toPublicDetailDto
  - EventTranslationEntity repository wired into service constructor

affects:
  - 07-05-PLAN (public events controller needs these service methods)
  - 07-06-PLAN (translation upsert controller endpoint)

tech-stack:
  added: []
  patterns:
    - "buildTranslationsMap: reduce EventTranslationEntity[] to Record<locale, {title, description}> (D-01 client-side i18n)"
    - "findPublishedOrThrow: 404 on non-published/non-existent — no info leakage (mirrors findOwnedOrThrow)"
    - "cursor pagination reuse: same (startAt, id) composite cursor key for public and organizer listings"
    - "plainto_tsquery('simple', :q): parametrized FTS — no SQL injection path (D-07)"
    - "LOWER(city) LIKE LOWER(:city) || '%': case-insensitive prefix match (D-09)"

key-files:
  created: []
  modified:
    - src/events/events.service.ts
    - src/events/events.service.spec.ts

key-decisions:
  - "OrganizerEntity has no bio/contact fields (D-11 was aspirational); map to null until entity extended — documented for Wave 3+ attention"
  - "searchVector referenced as event.\"searchVector\" in query builder (TypeORM default camelCase, no snake_case naming strategy configured)"
  - "upsertTranslation uses translationRepository.upsert with skipUpdateIfNoValuesChanged: true — avoids unnecessary writes"

patterns-established:
  - "buildTranslationsMap() pattern: client-side locale resolution via full translations map on every response"
  - "toPublicListItemDto / toPublicDetailDto: manual DTO mapping with explicit null coalescing for nullable entity fields"

requirements-completed: [EVT-04, EVT-06, DISC-01, DISC-02, DISC-03, DISC-04, I18N-01, I18N-03]

duration: 15min
completed: 2026-05-10
---

# Phase 07 Plan 04: Service Implementation Summary

**EventsService extended with findPublished (5 filters, cursor pagination), findPublishedById (translations map), and upsertTranslation (ownership-gated TypeORM upsert) — Wave 0 RED specs GREEN at 36/36 tests**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-05-10
- **Tasks:** 1 (TDD GREEN — RED stubs existed from Wave 0)
- **Files modified:** 2

## Accomplishments

- Wired `EventTranslationEntity` repository into `EventsService` constructor via second `@InjectRepository`
- Implemented `findPublished()` with all 5 filter types: category slug (DISC-01), date range (DISC-02), city LIKE prefix (DISC-03), `plainto_tsquery` full-text (DISC-04), cursor (EVT-06)
- Implemented `findPublishedById()` with `findPublishedOrThrow()` private helper — 404 for non-published/non-existent (EVT-04, no info leakage)
- Implemented `upsertTranslation()` with ownership check via `findOwnedOrThrow` and TypeORM upsert with `conflictPaths: ['eventId', 'locale']` (I18N-01)
- Added `buildTranslationsMap()` — D-01 client-side locale resolution via full `Record<locale, {title, description}>` map

## Task Commits

1. **Task 1: Implement findPublished, findPublishedById, upsertTranslation** - `7b1edcd` (feat)

## Files Created/Modified

- `src/events/events.service.ts` — Extended with 3 new public methods, 4 private helpers, second repository injection
- `src/events/events.service.spec.ts` — Fixed pre-existing test stub type error (Rule 1 auto-fix)

## Decisions Made

- `OrganizerEntity` does not have `bio` or `contact` fields (entity has `description`, `email`, `website`, `socialLinks`). D-11 specified these aspirationally. `toPublicDetailDto` maps `bio: null, contact: null` until the entity is extended in a future plan.
- Used `event."searchVector"` (camelCase TypeORM property name) in the query builder rather than `"search_vector"` (DB column name) — no snake_case naming strategy is configured in TypeORM.
- `upsertTranslation` uses `dto.description ?? null` to coerce `undefined` (optional field absent) to `null` for storage — ensures clean DB writes.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed type mismatch in upsertTranslation test stub**
- **Found during:** TypeScript compilation check post-implementation
- **Issue:** `events.service.spec.ts:234` cast `{ title: 'T', description: null }` as `UpsertEventTranslationDto`, but DTO declares `description?: string` (not `string | null`). TypeScript error TS2352.
- **Fix:** Removed `description: null` from test object — intent was to test no-description path, which is `undefined` (absent field), not `null`.
- **Files modified:** `src/events/events.service.spec.ts`
- **Verification:** TypeScript error resolved; all 36 tests still pass.
- **Committed in:** `7b1edcd` (included in task commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Pre-existing test stub issue introduced in Wave 0. Fix is a one-line removal with no behavior change. No scope creep.

## Issues Encountered

- `public-events.controller.spec.ts` has a pre-existing TypeScript error (`Cannot find module './public-events.controller'`) — this is the Wave 3 RED stub for plan 07-05. Out of scope; left untouched.
- `OrganizerEntity` fields mismatch with D-11 organizer shape (`bio`/`contact` vs `description`/`email`). Handled with null mapping; the entity extension is deferred to a future plan or is an existing gap in Phase 5.

## Next Phase Readiness

- `EventsService.findPublished` and `findPublishedById` are ready for `PublicEventsController` wiring (07-05)
- `EventsService.upsertTranslation` is ready for the organizer translation endpoint (07-06)
- TypeScript compiles clean on all service files; only pre-existing Wave 3 RED stub error remains in controller spec

---
*Phase: 07-public-event-discovery*
*Completed: 2026-05-10*
