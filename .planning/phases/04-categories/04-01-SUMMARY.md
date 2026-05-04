---
phase: 04-categories
plan: 01
subsystem: testing
tags: [tdd, jest, nestjs, categories, typeorm]

# Dependency graph
requires: []
provides:
  - RED stub spec for CategoriesService (8 failing TODO stubs covering findAll, create, update, remove)
  - RED stub spec for CategoriesController (4 failing TODO stubs covering GET, POST, PATCH, DELETE)
affects:
  - 04-02 (Wave 1 — CategoriesService implementation turns service spec GREEN)
  - 04-03 (Wave 2 — CategoriesController implementation turns controller spec GREEN)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 RED stub pattern: file-level imports from non-existent source files cause entire suite to fail to load"
    - "Named mock repositories with explicit method lists (CLAUDE.md: named fake classes, not inline stubs)"
    - "TestingModule + getRepositoryToken for service specs, direct instantiation for controller specs"

key-files:
  created:
    - src/categories/categories.service.spec.ts
    - src/categories/categories.controller.spec.ts
  modified: []

key-decisions:
  - "Service spec uses TestingModule pattern (mirrors users.service.spec.ts) with two named mock repos"
  - "Controller spec uses direct-instantiation pattern (mirrors webhooks.controller.spec.ts)"
  - "Both specs import from non-existent source files at file level to ensure full RED state"
  - "8 it('TODO') stubs in service spec; 4 in controller spec — one stub per distinct behavior"

patterns-established:
  - "Wave 0 TDD: spec files precede implementation, RED ensured by file-level imports"
  - "Mock objects named after what they mock: mockCategoryRepository, mockCategoryTranslationRepository, mockCategoriesService"

requirements-completed:
  - CAT-01
  - CAT-02
  - CAT-03
  - I18N-02

# Metrics
duration: 2min
completed: 2026-05-04
---

# Phase 4 Plan 01: Categories TDD Wave 0 — RED Stub Specs Summary

**Wave 0 RED stub specs for CategoriesService (8 stubs) and CategoriesController (4 stubs) with file-level imports that fail because source files do not yet exist**

## Performance

- **Duration:** 2 min
- **Started:** 2026-05-04T11:52:58Z
- **Completed:** 2026-05-04T11:55:16Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- Created `src/categories/categories.service.spec.ts` with 8 TODO stubs covering all four service methods (findAll, create, update, remove), including error paths (ConflictException on duplicate slug, NotFoundException on missing entity)
- Created `src/categories/categories.controller.spec.ts` with 4 TODO stubs covering all four HTTP endpoints (GET, POST, PATCH, DELETE)
- Both specs fail RED due to file-level imports from non-existent modules — test contract is established before any implementation

## Task Commits

Each task was committed atomically:

1. **Task 1: Write RED stub — categories.service.spec.ts** - `2acd9aa` (test)
2. **Task 2: Write RED stub — categories.controller.spec.ts** - `8c10215` (test)

**Plan metadata:** (docs commit follows)

_Note: TDD Wave 0 — both commits are test commits (RED state). GREEN commits happen in Wave 1 and Wave 2._

## Files Created/Modified
- `src/categories/categories.service.spec.ts` — Wave 0 RED stubs for CategoriesService with TestingModule + dual repo mocks
- `src/categories/categories.controller.spec.ts` — Wave 0 RED stubs for CategoriesController with direct-instantiation pattern

## Decisions Made
- Service spec mirrors `users.service.spec.ts` TestingModule pattern exactly, with two named mock repositories (`mockCategoryRepository` and `mockCategoryTranslationRepository`) registered via `getRepositoryToken()`
- Controller spec mirrors `webhooks.controller.spec.ts` direct-instantiation pattern — no TestingModule overhead for controller unit tests
- All 12 stubs use `expect(true).toBe(false)` as the minimal failing assertion body
- Note: Jest 30 renamed `--testPathPattern` to `--testPathPatterns` (pre-existing framework change); the plan's verification commands use the old flag but the tests are correctly RED regardless of flag name

## Deviations from Plan

None - plan executed exactly as written.

(Minor note: Jest 30 renamed `--testPathPattern` to `--testPathPatterns`. This affects the verification command in the plan spec but not the test behavior. Both spec files are RED as required. Tracked for awareness, not a deviation.)

## Issues Encountered
- Jest 30 does not accept `--testPathPattern` (renamed to `--testPathPatterns` in v30). The `pnpm test -- --testPathPattern=...` commands in the plan's `<verify>` blocks exit non-zero with an error about the flag, not the tests. Running `./node_modules/.bin/jest --testPathPatterns=...` confirms RED state correctly. This is a pre-existing framework difference — the spec files are RED as intended.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 0 complete: test contract established for categories module
- Ready for Plan 02 (Wave 1): CategoriesService + CategoryEntity + CategoryTranslationEntity implementation will turn service spec GREEN
- Ready for Plan 03 (Wave 2): CategoriesController + DTOs implementation will turn controller spec GREEN
- No blockers

---
*Phase: 04-categories*
*Completed: 2026-05-04*
