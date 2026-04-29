---
phase: 02-auth-infrastructure
plan: 02
subsystem: auth
tags: [jwt, passport, optional-auth, nestjs-guards, tdd, d07, d08]

# Dependency graph
requires:
  - phase: 02-auth-infrastructure
    plan: 01
    provides: OptionalJwtAuthGuard stub, JwtAuthGuard base, RolesGuard, spec scaffolds

provides:
  - OptionalJwtAuthGuard full implementation (absent token → undefined, invalid token → 401)
  - optional-jwt-auth.guard.spec.ts with 4 tests covering D-07 and D-08
  - Extended jwt.strategy.spec.ts (3 tests: namespace present, absent, explicitly undefined)
  - Extended jwt-auth.guard.spec.ts (2 tests: @Public bypass, non-public delegation)
  - Extended roles.guard.spec.ts (5 tests: public bypass, no roles, role match, role mismatch, undefined user)

affects: [03-users, all feature phases using OptionalJwtAuthGuard]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "handleRequest override: info instanceof Error distinguishes absent token (string) from invalid token (Error)"
    - "AuthGuard.canActivate() is async — test non-public delegation with await expect(...).rejects.toBeDefined()"
    - "mockContext for @nestjs/passport requires getResponse() in switchToHttp() — passport reads it before passport middleware runs"

key-files:
  created:
    - src/auth/guards/optional-jwt-auth.guard.spec.ts
  modified:
    - src/auth/guards/optional-jwt-auth.guard.ts
    - src/auth/strategies/jwt.strategy.spec.ts
    - src/auth/guards/jwt-auth.guard.spec.ts
    - src/auth/guards/roles.guard.spec.ts

key-decisions:
  - "info instanceof Error (not just !user && info) — string 'No auth token' is truthy but not an Error; using instanceof prevents D-07 absent-token being incorrectly treated as D-08 invalid-token"
  - "Non-public delegation test uses async/await + rejects because AuthGuard.canActivate() returns Promise — synchronous toThrow() does not catch async rejections"
  - "mockContext extended with getResponse() — @nestjs/passport AuthGuard reads response before calling passport authenticate(); missing getResponse caused uncaught TypeError crashing Jest"

requirements-completed:
  - AUTH-04

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 2 Plan 02: OptionalJwtAuthGuard + Test Completeness — Summary

**OptionalJwtAuthGuard full implementation with info instanceof Error narrowing — absent token passes, invalid token throws 401; all 4 auth spec files complete with 14 passing tests**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-04-29T16:45:19Z
- **Completed:** 2026-04-29T16:50:39Z
- **Tasks:** 2
- **Files modified:** 5 (1 created spec, 1 guard replaced, 3 specs extended)

## Accomplishments

- Replaced `OptionalJwtAuthGuard` stub with full `handleRequest<T>` override
- `info instanceof Error` narrowing correctly implements D-07 (absent → pass) and D-08 (invalid → 401)
- Created `optional-jwt-auth.guard.spec.ts` with 4 tests covering all handleRequest cases
- Extended all 3 spec scaffolds from Plan 01 (strategy, jwt-auth guard, roles guard)
- All 14 auth tests pass; TypeScript compiles clean

## Task Commits

1. **Task 1: Implement OptionalJwtAuthGuard + spec** — `4e316d0` (feat)
2. **Task 2: Extend guard and strategy test coverage** — `93f1b3d` (test)

## Files Created/Modified

- `src/auth/guards/optional-jwt-auth.guard.ts` — full handleRequest override; `info instanceof Error` narrowing for D-07/D-08
- `src/auth/guards/optional-jwt-auth.guard.spec.ts` — 4 tests: absent token → undefined, invalid token → throws, passport error → throws, valid token → returns user
- `src/auth/strategies/jwt.strategy.spec.ts` — added test: explicitly undefined namespace claim → empty roles (3 tests total)
- `src/auth/guards/jwt-auth.guard.spec.ts` — added test: non-public route delegates to passport and rejects (2 tests total); fixed mockContext to include getResponse()
- `src/auth/guards/roles.guard.spec.ts` — added test: undefined user with @Roles() required → returns false, no throw (5 tests total)

## Decisions Made

- **`info instanceof Error` over `!user && info`:** The research doc (02-RESEARCH.md Pitfall 4) flagged this exact issue. `'No auth token'` is a truthy string — bare truthiness check would cause D-07 absent-token to incorrectly trigger D-08 behavior. Using `instanceof Error` is the correct narrowing.
- **`async/await + rejects` for non-public delegation test:** `AuthGuard.canActivate()` from `@nestjs/passport` is an `async` function. Wrapping in `expect(() => ...).toThrow()` does not catch Promise rejections — the test appeared to pass but was not actually asserting anything useful. Switching to `await expect(...).rejects.toBeDefined()` correctly asserts the Promise rejects.
- **`getResponse()` in mockContext:** `@nestjs/passport`'s `AuthGuard.canActivate()` reads `context.switchToHttp().getResponse()` on line 52 of its implementation before invoking passport middleware. The Plan 01 scaffold omitted this, which was fine while only the `@Public()` early-return path was tested. Adding the non-public delegation test exposed the missing method.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] mockContext missing getResponse() causes uncaught TypeError in delegation test**
- **Found during:** Task 2, adding non-public delegation test to jwt-auth.guard.spec.ts
- **Issue:** `@nestjs/passport` `AuthGuard.canActivate()` calls `context.switchToHttp().getResponse()` before invoking passport. The Plan 01 scaffold only provided `getRequest()`. When the test called `guard.canActivate()` on a non-public route, the call crashed with a synchronous `TypeError` that propagated outside Jest's exception handling, crashing the Node.js process.
- **Fix:** Added `getResponse: () => ({})` to the `switchToHttp()` return in `mockContext`. Switched the test assertion from `expect(() => ...).toThrow()` to `await expect(...).rejects.toBeDefined()` to correctly handle the async Promise rejection.
- **Files modified:** `src/auth/guards/jwt-auth.guard.spec.ts`
- **Committed in:** `93f1b3d`

### Pre-existing Failures (Out of Scope)

The following test failures existed before Plan 02-02 (confirmed via git stash). Logged to `deferred-items.md`.

1. **`env.validation.spec.ts`** — test fixture missing the 4 Auth0 env vars added in Plan 01. Fix: update fixture to include all required fields.
2. **`event.entity.spec.ts`**, **`user.entity.spec.ts`** — `@paralleldrive/cuid2@3.3.0` uses ESM syntax; not in `transformIgnorePatterns`. Fix: add to `transformIgnorePatterns` (same pattern as jwks-rsa/jose).

These are not regressions from Plan 02-02. No action taken on out-of-scope files.

## Known Stubs

None — OptionalJwtAuthGuard is fully implemented.

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced.

## Self-Check: PASSED

- `src/auth/guards/optional-jwt-auth.guard.ts` — EXISTS, contains `info instanceof Error`
- `src/auth/guards/optional-jwt-auth.guard.spec.ts` — EXISTS, contains `describe('OptionalJwtAuthGuard'`
- Task 1 commit `4e316d0` — verified in git log
- Task 2 commit `93f1b3d` — verified in git log
- `npx jest --testPathPatterns=auth` — 14 passed, 0 failed
- `npx tsc --noEmit` — 0 errors
