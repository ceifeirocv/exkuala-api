---
phase: 06-organizer-event-crud
plan: 01
subsystem: testing
tags: [nestjs, typeorm, jest, tdd, events]

# Dependency graph
requires:
  - phase: 05-organizers
    provides: OrganizerEntity, OrganizerGuard, @CurrentOrganizer() decorator patterns
provides:
  - Wave 0 TDD RED stubs defining the full EventsService and EventsController contracts
  - events.service.spec.ts with 18 test cases covering create, findOwned, findOwnedById, update (field patch + status transitions), softDeleteDraft
  - events.controller.spec.ts with 10 test cases covering all 5 controller endpoints
affects:
  - 06-02 (Wave 1 DTOs/entity updates — spec imports reference DTO shapes)
  - 06-03 (Wave 2 EventsService implementation — must turn service spec GREEN)
  - 06-04 (Wave 3 EventsController implementation — must turn controller spec GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD RED pattern: import non-existent source module at compile time to force intentional compile-fail"
    - "Named mock repository with chainable queryBuilder stub (mockReturnThis on chain methods)"
    - "Named mock service with identity toResponseDto mock for controller specs"

key-files:
  created:
    - src/events/events.service.spec.ts
    - src/events/events.controller.spec.ts
  modified: []

key-decisions:
  - "Wave 0 RED stubs use expect(true).toBe(true) placeholder assertions — real assertions added in Wave 2/3 when implementation exists"
  - "Controller spec uses direct instantiation pattern (no TestingModule) — mirrors organizers.controller.spec.ts"
  - "Service spec uses TestingModule + getRepositoryToken pattern — mirrors organizers.service.spec.ts"
  - "queryBuilder mock re-created fresh in each beforeEach to prevent state leakage between tests"

patterns-established:
  - "Wave 0 RED spec pattern: spec imports non-existent source file; test suite fails with Cannot find module; pre-existing tests unaffected"
  - "Named mock queryBuilder: all chain methods return mockReturnThis(), only getMany returns mockResolvedValue([])"

requirements-completed:
  - ORG-04
  - ORG-05
  - EVT-01
  - EVT-02
  - EVT-05

# Metrics
duration: 3min
completed: 2026-05-07
---

# Phase 6 Plan 01: Wave 0 TDD RED Stubs Summary

**Two Wave 0 TDD RED spec files establish the full EventsService and EventsController contracts via intentional compile-fail imports of not-yet-created source modules.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-07T13:29:04Z
- **Completed:** 2026-05-07T13:32:27Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- `events.service.spec.ts` created with 18 test cases spanning 5 describe groups: create(), findOwned() cursor pagination, findOwnedById(), update() field patch, update() status transitions, softDeleteDraft()
- `events.controller.spec.ts` created with 10 test cases across 5 endpoint groups: POST create, GET list, GET :id, PATCH update, DELETE soft-delete
- Both files fail with `Cannot find module` (intentional RED state); all 54 pre-existing tests continue to pass

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED spec — events.service.spec.ts** - `8974d26` (test)
2. **Task 2: Write RED spec — events.controller.spec.ts** - `0607ce8` (test)

**Plan metadata:** (docs commit below)

_Note: TDD Wave 0 tasks produce test commits only — no feat commits until Wave 2/3._

## Files Created/Modified

- `src/events/events.service.spec.ts` — RED stub spec; imports non-existent EventsService; 18 skeletal test cases defining Wave 2 implementation contract
- `src/events/events.controller.spec.ts` — RED stub spec; imports non-existent EventsController and EventsService; 10 skeletal test cases defining Wave 3 implementation contract

## Decisions Made

- Used `expect(true).toBe(true)` placeholder assertions in all test case bodies — the RED state is produced by the broken import, not assertion failures; Wave 2/3 will replace placeholders with real assertions
- Followed direct-instantiation pattern for controller spec (no TestingModule) as established in organizers.controller.spec.ts
- Followed TestingModule + getRepositoryToken pattern for service spec as established in organizers.service.spec.ts
- queryBuilder mock re-initialized in each beforeEach (not at module scope) to prevent cross-test state leakage

## Deviations from Plan

None — plan executed exactly as written. Both spec files produce the expected `Cannot find module` compile errors. All pre-existing test suites (54 tests across 9 suites) continue to pass.

## Issues Encountered

- `pnpm test --testPathPattern` flag was replaced by `--testPathPatterns` in Jest 30; switched to `npx jest --testRegex` for direct verification. Build scripts unaffected.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 0 complete. Both RED stubs committed and verified.
- Wave 1 (06-02): DTO creation and EventEntity relation updates — spec files already reference DTO shapes via loose typing; Wave 1 can proceed immediately.
- Wave 2 (06-03): EventsService implementation must turn `events.service.spec.ts` GREEN — 18 test cases are the acceptance target.
- Wave 3 (06-04): EventsController implementation must turn `events.controller.spec.ts` GREEN — 10 test cases are the acceptance target.

---
*Phase: 06-organizer-event-crud*
*Completed: 2026-05-07*
