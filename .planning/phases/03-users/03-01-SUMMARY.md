---
phase: 03-users
plan: "03-01"
subsystem: testing
tags: [jest, tdd, nestjs, passport-jwt, typeorm, auth0]

# Dependency graph
requires:
  - phase: 02.1-add-a-webhook-endpoint-for-auth0-to-add-or-refresh-user-on-c
    provides: upsertFromAuth0() on UsersService; existing jwt.strategy.spec.ts baseline
provides:
  - Failing test suite for UsersService.findOrCreate() (3 RED tests)
  - Updated jwt.strategy.spec.ts with UsersService mock and 2 RED async validate() tests
  - New current-user.decorator.spec.ts failing at module resolution (RED)
affects: [03-02-users-wave1-implementation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Wave 0 TDD: spec files import non-existent source files at import level to guarantee suite-level RED failure"
    - "Service method spy pattern: jest.spyOn(service as unknown as { method }, 'method') for private/protected method assertions"
    - "Module-level mock object for service injection: const mockUsersService = { findOrCreate: jest.fn() } as unknown as UsersService"

key-files:
  created:
    - src/auth/decorators/current-user.decorator.spec.ts
  modified:
    - src/users/users.service.spec.ts
    - src/auth/strategies/jwt.strategy.spec.ts

key-decisions:
  - "Existing 3 jwt.strategy validate() tests made async but expected return shape kept as { sub, roles } intentionally — they go RED in Wave 1 when implementation changes, not in Wave 0"
  - "mockRepository extended with findOne and findOneOrFail on the shared module-level object rather than creating a new one, preserving upsertFromAuth0 test compatibility"
  - "current-user.decorator.spec.ts also imports AuthenticatedUser from ../../types/auth — both imports will fail RED until Wave 1 creates both files"

patterns-established:
  - "Wave 0 RED stubs import non-existent source files at import level (not assertion level) to guarantee live test failure — matches STATE.md decision"
  - "Constructor mock receives (config, mockUsersService) to match the Wave 1 two-arg constructor spec, failing gracefully on current single-arg constructor"

requirements-completed: [AUTH-03]

# Metrics
duration: 18min
completed: 2026-05-03
---

# Phase 3 Plan 01: Users Wave 0 (TDD RED) Summary

**Three failing test suites defining findOrCreate(), async JwtStrategy.validate(), and @CurrentUser() decorator contracts for Wave 1 implementation**

## Performance

- **Duration:** 18 min
- **Started:** 2026-05-03T21:01:09Z
- **Completed:** 2026-05-03T21:18:49Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Added 3 RED tests for `UsersService.findOrCreate()` covering happy path, fallback (upsert then re-fetch), and error propagation — 3 pre-existing `upsertFromAuth0` tests remain GREEN
- Rewrote `jwt.strategy.spec.ts` to inject `mockUsersService` as second constructor arg; made all 3 existing tests async (still PASS); added 2 RED tests asserting `AuthenticatedUser` return shape and `UnauthorizedException` on DB failure
- Created `current-user.decorator.spec.ts` failing at module resolution (`Cannot find module './current-user.decorator'`) — clean RED gate for Wave 1

## Task Commits

1. **Task 1: Add findOrCreate() tests to users.service.spec.ts** - `c24a8be` (test)
2. **Task 2: Update jwt.strategy.spec.ts with UsersService mock and async tests** - `c96a75f` (test)
3. **Task 3: Create current-user.decorator.spec.ts stub** - `a522d59` (test)

## Files Created/Modified

- `src/users/users.service.spec.ts` - Extended mockRepository with findOne/findOneOrFail; added `describe('findOrCreate()')` block with 3 RED tests
- `src/auth/strategies/jwt.strategy.spec.ts` - Added mockUsersService, beforeEach clearAllMocks, made 3 existing tests async, added 2 RED async validate() tests
- `src/auth/decorators/current-user.decorator.spec.ts` - New file; imports non-existent decorator and types/auth module; fails at module resolution (RED)

## Decisions Made

- Kept existing `jwt.strategy` test expected values as `{ sub, roles }` (not `AuthenticatedUser`) per plan spec — they go RED in Wave 1 when `validate()` implementation changes, demonstrating the TDD gate is a two-wave contract
- Used `jest.spyOn` on the service instance to assert `upsertFromAuth0` call count rather than asserting on `mockRepository.upsert` directly, matching the plan's explicit instruction

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 3 spec files are committed and failing (RED) at the correct boundaries
- Wave 1 (03-02) must create: `src/users/users.service.ts` `findOrCreate()`, `src/types/auth.ts` (`AuthenticatedUser`), `src/auth/decorators/current-user.decorator.ts`, and update `jwt.strategy.ts` to inject `UsersService` and return `AuthenticatedUser`
- No blockers — all RED gates are import-level or method-call-level, not syntax errors

---
*Phase: 03-users*
*Completed: 2026-05-03*
