---
phase: 07-public-event-discovery
plan: 01
subsystem: testing
tags: [jest, tdd, nestjs, typeorm, events, translations]

# Dependency graph
requires:
  - phase: 06-organizer-event-crud
    provides: EventsService, EventsController, EventEntity, events.service.spec.ts, events.controller.spec.ts
provides:
  - Wave 0 RED stubs for public event discovery (4 spec files total)
  - TDD contract for GET /events, GET /events/:id, and PUT :id/translations/:locale
  - RED gate via import-level compile failures on missing source modules
affects: [07-02, 07-03, 07-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD RED stub pattern: import non-existent module at spec top to guarantee compile-time failure"
    - "makeQb() factory function for fresh query builder mocks per test (avoids shared state)"
    - "EventTranslationEntity repository provided alongside EventEntity in TestingModule"

key-files:
  created:
    - src/events/public-events.controller.spec.ts
    - src/events/public-events.service.spec.ts
  modified:
    - src/events/events.controller.spec.ts
    - src/events/events.service.spec.ts

key-decisions:
  - "RED gate mechanism: import from non-existent source file causes compile failure, not assertion failure — confirms test cannot pass before implementation"
  - "public-events.service.spec.ts uses makeQb() factory (not shared mock) to give each test an isolated query builder instance"
  - "events.service.spec.ts extended with EventTranslationEntity provider in TestingModule — Wave 1 implementation will require it"

patterns-established:
  - "makeQb() factory pattern: return a fresh mock query builder object per test instead of sharing one across tests"
  - "Phase 7 upsertTranslation stub in events.service.spec.ts follows existing ownership-check-then-upsert pattern from prior service methods"

requirements-completed: [EVT-04, EVT-06, DISC-01, DISC-02, DISC-03, DISC-04, I18N-01, I18N-03]

# Metrics
duration: 5min
completed: 2026-05-10
---

# Phase 7 Plan 01: Wave 0 RED Stubs for Public Event Discovery Summary

**Four spec files establishing TDD contract for public event listing, detail retrieval, and organizer translation upsert — RED gate via import-level compile failures on missing source modules**

## Performance

- **Duration:** 5 min
- **Started:** 2026-05-10T11:09:02Z
- **Completed:** 2026-05-10T11:14:31Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `public-events.controller.spec.ts` — RED at import level (PublicEventsController doesn't exist); covers GET /events and GET /events/:id with EVT-04, EVT-06, DISC-01 requirement references
- Created `public-events.service.spec.ts` — RED at import level (EventTranslationEntity doesn't exist); covers findPublished with 6 test cases (empty, category, city LOWER LIKE, plainto_tsquery, date range, cursor) and findPublishedById with translations map assertion
- Extended `events.controller.spec.ts` — added `upsertTranslation: jest.fn()` to mock service and PUT :id/translations/:locale describe block (I18N-01, D-03)
- Extended `events.service.spec.ts` — added EventTranslationEntity import (RED), mockTranslationRepository, second TestingModule provider, and upsertTranslation describe block with ownership check and upsert-then-findOneOrFail pattern

## Task Commits

Each task was committed atomically in a single commit covering all four files:

1. **Task 1 + Task 2: Wave 0 RED stubs (all four spec files)** - `65c2d69` (test)

**Plan metadata:** (docs commit follows)

_Note: Both TDD tasks committed together since they are part of the same RED gate wave_

## Files Created/Modified

- `src/events/public-events.controller.spec.ts` — New RED stub; imports PublicEventsController (non-existent), covers GET /events and GET /events/:id
- `src/events/public-events.service.spec.ts` — New RED stub; imports EventTranslationEntity (non-existent), covers findPublished (all filter variants + cursor + hasMore), findPublishedById
- `src/events/events.controller.spec.ts` — Extended with upsertTranslation mock entry and PUT translations/:locale describe block
- `src/events/events.service.spec.ts` — Extended with EventTranslationEntity import (RED), mockTranslationRepository, provider in TestingModule, upsertTranslation describe block

## Decisions Made

- Used `makeQb()` factory function in `public-events.service.spec.ts` instead of a shared mock so each test gets an isolated query builder — prevents andWhere call count bleed between tests.
- Existing `events.controller.spec.ts` tests all pass (13 passing) after extension — new stubs use placeholder `expect(true).toBe(true)` pattern consistent with prior Wave 0 stubs in the file.

## Deviations from Plan

None — plan executed exactly as written. The `makeQb()` factory was specified in the plan action block.

## Issues Encountered

- `pnpm test -- --testPathPattern=...` CLI invocation silently matched 0 files due to Jest 30 renaming `--testPathPattern` to `--testPathPatterns`. Used `npx jest --testPathPatterns=...` directly for verification. The `pnpm test` script still works for full suite runs.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 RED gate is fully established across all four spec files
- `events.controller.spec.ts` passes (13 tests) — existing functionality unaffected
- `events.service.spec.ts` fails at import (EventTranslationEntity RED) — Wave 1 must create `event-translation.entity.ts`
- `public-events.controller.spec.ts` fails at import (PublicEventsController RED) — Wave 1/2 must create `public-events.controller.ts`
- `public-events.service.spec.ts` fails at import (EventTranslationEntity RED) — Wave 1 must create `event-translation.entity.ts`
- Plan 07-02 (Wave 1 implementation) can proceed immediately

---
*Phase: 07-public-event-discovery*
*Completed: 2026-05-10*
