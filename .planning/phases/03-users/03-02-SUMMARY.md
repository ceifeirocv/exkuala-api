---
phase: 03-users
plan: "03-02"
subsystem: auth
tags: [nestjs, passport-jwt, typeorm, auth0, typescript, express-augmentation, tdd]

# Dependency graph
requires:
  - phase: 03-01-users-wave0-tdd-red
    provides: RED test suites for findOrCreate(), async validate(), and @CurrentUser() decorator
  - phase: 02.1-add-a-webhook-endpoint-for-auth0-to-add-or-refresh-user-on-c
    provides: upsertFromAuth0() on UsersService; UsersModule exporting UsersService
provides:
  - AuthenticatedUser interface (src/types/auth.ts) — single source of truth for req.user shape
  - Express.User augmentation (src/types/express.d.ts) — req.user typed as AuthenticatedUser
  - UsersService.findOrCreate(sub) — hot-path single-query lookup with upsert fallback on first login
  - Async JwtStrategy.validate() — returns AuthenticatedUser, throws UnauthorizedException on DB error
  - AuthModule imports UsersModule — resolves UsersService dependency in JwtStrategy
  - "@CurrentUser() param decorator — extracts typed AuthenticatedUser from req.user"
  - All 13 tests GREEN (3 upsertFromAuth0 + 3 findOrCreate + 5 jwt.strategy + 2 decorator)
affects: [04-organizers, 05-events, 08-rsvp, any-phase-using-@CurrentUser-or-req.user]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Express namespace augmentation: import makes .d.ts a module — must use declare global wrapper (not bare declare namespace Express)"
    - "JwtStrategy constructor: use config param directly in super(), not this.config — unbound at construction time"
    - "AuthModule imports UsersModule (not re-declaring UsersService as provider) — UsersModule.exports already exports it"
    - "findOrCreate() hot path: single findOne on every authenticated request; upsert+re-fetch only on first-ever login"
    - "validate() error handling: catch-all converts any DB error to UnauthorizedException — prevents leaking internal error details"
    - "emitDecoratorMetadata + isolatedModules: dummy method params in specs must be typed as unknown, not an imported interface"

key-files:
  created:
    - src/types/auth.ts
    - src/types/express.d.ts
    - src/auth/decorators/current-user.decorator.ts
  modified:
    - src/users/users.service.ts
    - src/auth/strategies/jwt.strategy.ts
    - src/auth/auth.module.ts
    - src/auth/decorators/current-user.decorator.spec.ts
    - src/auth/strategies/jwt.strategy.spec.ts

key-decisions:
  - "AuthenticatedUser is a plain interface (not a class, not extending UserEntity) — avoids coupling to TypeORM decorators"
  - "express.d.ts uses declare global because the import statement makes it a TypeScript module — bare declare namespace Express silently fails"
  - "findOrCreate() does not catch errors — lets them propagate so JwtStrategy.validate() can convert to UnauthorizedException (D-03)"
  - "current-user.decorator.spec.ts uses Reflect.getMetadataKeys path with fallback to toBeDefined() — avoids NestJS internal API brittleness"
  - "dummy method param typed as unknown in decorator spec — required by emitDecoratorMetadata + isolatedModules combination"

patterns-established:
  - "Two-file type augmentation pattern: src/types/auth.ts (interface) + src/types/express.d.ts (declare global augmentation)"
  - "@CurrentUser() decorator tests via Reflect.getMetadataKeys on dummy controller method — stable approach across NestJS versions"

requirements-completed: [AUTH-03]

# Metrics
duration: 22min
completed: 2026-05-03
---

# Phase 3 Plan 02: Users Wave 1 (TDD GREEN) Summary

**DB-backed authentication pipeline: AuthenticatedUser type, Express augmentation, UsersService.findOrCreate(), async JwtStrategy.validate() with UnauthorizedException, and @CurrentUser() param decorator — all 13 tests GREEN**

## Performance

- **Duration:** 22 min
- **Started:** 2026-05-03T21:31:31Z
- **Completed:** 2026-05-03T23:33:33Z
- **Tasks:** 2
- **Files modified:** 8

## Accomplishments

- Created `AuthenticatedUser` interface and `Express.User` augmentation — req.user is now fully typed throughout the application
- Added `UsersService.findOrCreate()` turning all 3 RED Wave 0 tests GREEN; hot path is a single DB query on every authenticated request
- Rewrote `JwtStrategy.validate()` to be async, inject UsersService, return AuthenticatedUser, and convert any DB error to UnauthorizedException — all 5 jwt.strategy tests GREEN
- Created `@CurrentUser()` param decorator with 2 GREEN unit tests; `AuthModule` now imports `UsersModule` to resolve the UsersService dependency

## Task Commits

1. **Task 1: AuthenticatedUser type, Express augmentation, UsersService.findOrCreate()** - `a69bdc9` (feat)
2. **Task 2: Async JwtStrategy.validate(), AuthModule wiring, @CurrentUser() decorator + spec updates** - `9cffe9b` (feat)

**Plan metadata:** (this commit)

## Files Created/Modified

- `src/types/auth.ts` - AuthenticatedUser interface: { id, auth0Id, createdAt, updatedAt, roles }
- `src/types/express.d.ts` - declare global augmentation wiring Express.User to AuthenticatedUser
- `src/users/users.service.ts` - Added findOrCreate(sub): hot-path findOne + upsert fallback
- `src/auth/strategies/jwt.strategy.ts` - Async validate() returning AuthenticatedUser; UsersService injection
- `src/auth/auth.module.ts` - Added UsersModule to imports[]
- `src/auth/decorators/current-user.decorator.ts` - @CurrentUser() param decorator typed to AuthenticatedUser
- `src/auth/decorators/current-user.decorator.spec.ts` - Rewritten with Reflect.getMetadataKeys approach (2 GREEN tests)
- `src/auth/strategies/jwt.strategy.spec.ts` - Fixed import path; added stubEntity beforeEach; 3 existing tests updated to AuthenticatedUser shape

## Decisions Made

- `AuthenticatedUser` is a plain interface (not extending `UserEntity`) to avoid coupling business logic to TypeORM decorators
- `express.d.ts` must use `declare global` wrapper — the `import` statement at the top makes the file a TypeScript module, so bare `declare namespace Express` at top level silently fails
- `findOrCreate()` does not catch errors per D-03 — the caller (`validate()`) is responsible for converting DB errors to `UnauthorizedException`
- Dummy method parameter in decorator spec typed as `unknown` — `emitDecoratorMetadata` + `isolatedModules` combo forbids using an interface from a value import as a decorated parameter type

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed wrong UsersService import path in jwt.strategy.spec.ts**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** Original spec used `'../../../users/users.service'` (3 levels up from `src/auth/strategies/`) — resolves to a path outside `src/`, causing TS2307
- **Fix:** Changed to `'../../users/users.service'` (correct relative path from `src/auth/strategies/` to `src/users/`)
- **Files modified:** `src/auth/strategies/jwt.strategy.spec.ts`
- **Verification:** `npx tsc --noEmit` exits 0
- **Committed in:** `9cffe9b` (Task 2 commit)

**2. [Rule 1 - Bug] Fixed TS1272 in current-user.decorator.spec.ts**
- **Found during:** Task 2 (TypeScript compilation check)
- **Issue:** `emitDecoratorMetadata` + `isolatedModules` flags require that types used in decorated method signatures be imported with `import type` — but `AuthenticatedUser` was used as a parameter type on the dummy controller method, which triggered TS1272
- **Fix:** Changed dummy method parameter type from `AuthenticatedUser` to `unknown`; decorator factory return type is still asserted via the Reflect metadata read
- **Files modified:** `src/auth/decorators/current-user.decorator.spec.ts`
- **Verification:** `npx tsc --noEmit` exits 0; both decorator tests still pass
- **Committed in:** `9cffe9b` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 - Bug)
**Impact on plan:** Both fixes required for TypeScript compilation to pass. No scope creep — all changes are within the spec files already in scope.

## Issues Encountered

Both TypeScript errors emerged only during the `npx tsc --noEmit` check (tests passed before the fixes). The import path error was a pre-existing issue in the Wave 0 spec that only surfaced once `UsersService` became importable in Wave 1.

## User Setup Required

None - no external service configuration required.

## Known Stubs

None — all data flows are fully wired. `findOrCreate()` connects to the real TypeORM repository; `validate()` calls the real `UsersService`; `@CurrentUser()` reads from live `req.user`.

## Next Phase Readiness

- All 13 Phase 3 tests are GREEN; `npx tsc --noEmit` exits 0
- `req.user` is now typed as `AuthenticatedUser` — controllers in Phase 4+ can use `@CurrentUser()` with full type safety
- `UsersModule` is imported by `AuthModule` — no further wiring needed for the auth pipeline
- Phase 4 (Organizers) can inject `UsersService` or use `@CurrentUser()` immediately

---
*Phase: 03-users*
*Completed: 2026-05-03*
