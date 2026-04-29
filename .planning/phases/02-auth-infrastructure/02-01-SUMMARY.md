---
phase: 02-auth-infrastructure
plan: 01
subsystem: auth
tags: [jwt, auth0, passport, jwks-rsa, nestjs-guards, rbac]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: NestJS scaffold, ConfigModule global, env.validation.ts pattern, app.module.ts structure

provides:
  - Fail-closed JWT guard chain (JwtAuthGuard + RolesGuard as APP_GUARD)
  - RS256 JWKS validation via jwks-rsa (cache + rate-limit enabled)
  - @Public() decorator bypassing both guards
  - @Roles() decorator for role-based access control
  - req.user shape: { sub: string, roles: string[] }
  - Four Auth0 env vars required at boot (AUTH0_JWKS_URI, AUTH0_AUDIENCE, AUTH0_ISSUER, AUTH0_NAMESPACE)
  - OptionalJwtAuthGuard stub (full impl in Plan 02-02)

affects: [03-users, all feature phases using @Roles() or @Public()]

# Tech tracking
tech-stack:
  added:
    - "@nestjs/passport@11.0.5 — PassportStrategy base class and AuthGuard factory"
    - "@nestjs/jwt@11.0.2 — installed for peer dep completeness; JwtModule not used (Auth0 signs, we only verify)"
    - "passport@0.7.0 — peer dep of @nestjs/passport and passport-jwt"
    - "passport-jwt@4.0.1 — JWT extraction (Bearer header) and verification"
    - "jwks-rsa@4.0.1 — passportJwtSecret helper; JWKS fetch with cache 600s TTL, rateLimit 10 req/min"
    - "@types/passport-jwt@4.0.1 — dev"
    - "@types/passport@1.0.17 — dev"
  patterns:
    - "APP_GUARD fail-closed: all routes protected by default; opt-out with @Public()"
    - "IS_PUBLIC_KEY checked in BOTH JwtAuthGuard and RolesGuard — independent bypass"
    - "config parameter (not this.config) used in PassportStrategy super() to avoid unbound-this TypeError"
    - "AUTH0_NAMESPACE from ConfigService at validate() time — no hardcoded namespace string"
    - "JwtAuthGuard registered as first APP_GUARD, RolesGuard second — sets req.user before roles check"

key-files:
  created:
    - src/auth/auth.module.ts
    - src/auth/strategies/jwt.strategy.ts
    - src/auth/guards/jwt-auth.guard.ts
    - src/auth/guards/roles.guard.ts
    - src/auth/guards/optional-jwt-auth.guard.ts
    - src/auth/decorators/public.decorator.ts
    - src/auth/decorators/roles.decorator.ts
    - src/auth/strategies/jwt.strategy.spec.ts
    - src/auth/guards/jwt-auth.guard.spec.ts
    - src/auth/guards/roles.guard.spec.ts
  modified:
    - src/config/env.validation.ts — added 4 Auth0 @IsString() required fields
    - src/app.module.ts — added AuthModule to imports[]
    - package.json — added auth deps + jwks-rsa/jose to transformIgnorePatterns

key-decisions:
  - "Use config constructor parameter (not this.config) inside PassportStrategy super() — this is unbound at super() call time"
  - "Mock jwks-rsa and @nestjs/passport in jwt.strategy.spec.ts — jwks-rsa 4.x pulls in ESM-only jose@6 which ts-jest cannot transform via pnpm nested node_modules paths"
  - "Added jwks-rsa and jose to jest transformIgnorePatterns for pnpm ESM compatibility"
  - "OptionalJwtAuthGuard implemented as stub extending JwtAuthGuard — full handleRequest override deferred to Plan 02-02"

patterns-established:
  - "Guard bypass: both JwtAuthGuard and RolesGuard independently check IS_PUBLIC_KEY before any auth logic"
  - "APP_GUARD order: JwtAuthGuard always before RolesGuard in AuthModule providers[]"
  - "Env var pattern: @IsString() decorator + !-asserted field, one per line, matching existing DATABASE_URL pattern"

requirements-completed:
  - AUTH-01
  - AUTH-02

# Metrics
duration: 6min
completed: 2026-04-29
---

# Phase 2 Plan 01: Auth Infrastructure — JWT Guard Chain Summary

**Fail-closed RS256 JWT guard chain via Auth0 JWKS — all routes protected by default with @Public()/@Roles() opt-out decorators**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-29T05:14:14Z
- **Completed:** 2026-04-29T05:20:30Z
- **Tasks:** 2
- **Files modified:** 12 (10 created, 2 modified + package.json)

## Accomplishments

- Installed all auth packages (@nestjs/passport, @nestjs/jwt, passport, passport-jwt, jwks-rsa) and type defs
- Implemented JwtStrategy with RS256/JWKS validation (cache:true, rateLimit:true, config param in super() per critical pitfall)
- Wired JwtAuthGuard + RolesGuard as APP_GUARD in AuthModule — all routes fail-closed by default
- Extended EnvironmentVariables with four required Auth0 env vars; process crashes at boot if any are missing
- All 7 auth unit tests pass (2 strategy validate() tests, 1 guard public-bypass test, 4 roles guard tests)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install auth packages and create test scaffolds** - `4165151` (chore)
2. **Task 2: Implement auth module** - `6276831` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/auth/strategies/jwt.strategy.ts` — PassportStrategy(Strategy) with passportJwtSecret, RS256, validate() extracts { sub, roles }
- `src/auth/guards/jwt-auth.guard.ts` — extends AuthGuard('jwt'), IS_PUBLIC_KEY bypass via Reflector
- `src/auth/guards/roles.guard.ts` — CanActivate, checks IS_PUBLIC_KEY then ROLES_KEY vs req.user.roles
- `src/auth/guards/optional-jwt-auth.guard.ts` — stub extending JwtAuthGuard (full impl in Plan 02-02)
- `src/auth/decorators/public.decorator.ts` — IS_PUBLIC_KEY constant and @Public() SetMetadata decorator
- `src/auth/decorators/roles.decorator.ts` — ROLES_KEY constant and @Roles() SetMetadata decorator
- `src/auth/auth.module.ts` — PassportModule import, APP_GUARD registrations (JwtAuthGuard #1, RolesGuard #2), exports
- `src/config/env.validation.ts` — AUTH0_JWKS_URI, AUTH0_AUDIENCE, AUTH0_ISSUER, AUTH0_NAMESPACE added as @IsString() required fields
- `src/app.module.ts` — AuthModule added to imports[]
- `src/auth/strategies/jwt.strategy.spec.ts` — validate() unit tests with mocked jwks-rsa/PassportStrategy
- `src/auth/guards/jwt-auth.guard.spec.ts` — @Public() bypass test
- `src/auth/guards/roles.guard.spec.ts` — role match/mismatch/public bypass/no-roles tests
- `package.json` — auth deps added; jwks-rsa + jose added to transformIgnorePatterns

## Decisions Made

- **Mock jwks-rsa in strategy spec:** jwks-rsa 4.x depends on jose@6 (ESM-only). Under pnpm, the nested path `/node_modules/.pnpm/jose@6.2.3/node_modules/jose/` does not match the standard `transformIgnorePatterns` regex, so ts-jest cannot transform it. Mocking jwks-rsa and PassportStrategy in the spec is the correct unit-test approach — the spec tests `validate()` logic only, not JWKS fetching.
- **OptionalJwtAuthGuard as stub:** Plan 02-02 implements the full `handleRequest` override. The stub file is created now so `AuthModule` can export it without a compile error. Import forward reference is safe — NestJS resolves providers at runtime.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jwt.strategy.spec.ts fails — jwks-rsa pulls in ESM-only jose@6 under pnpm**
- **Found during:** Task 1 acceptance criteria verification (after Task 2 implementation)
- **Issue:** `jwks-rsa@4.0.1` transitively imports `jose@6.2.3` which uses ES module `export` syntax. Under pnpm's nested `node_modules/.pnpm/` path structure, the standard `transformIgnorePatterns` regex does not match the jose path, so ts-jest cannot transform it and the spec suite fails with `SyntaxError: Unexpected token 'export'`.
- **Fix:** (a) Added `jwks-rsa` and `jose` to `transformIgnorePatterns` in package.json (harmless, guards the config for future). (b) Updated `jwt.strategy.spec.ts` to mock `jwks-rsa` (via `jest.mock`) and `@nestjs/passport` (mocks `PassportStrategy` base class). This is the correct unit-test approach — the spec tests `validate()` logic only, not the Passport strategy wiring.
- **Files modified:** `package.json`, `src/auth/strategies/jwt.strategy.spec.ts`
- **Verification:** `npx jest --testPathPatterns=auth --passWithNoTests` exits 0, 7 tests pass
- **Committed in:** `4165151` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — blocking)
**Impact on plan:** Necessary for test correctness. The mock approach is superior to transforming node_modules as it isolates the unit under test. No scope creep.

## Issues Encountered

- Jest 30 renamed `--testPathPattern` to `--testPathPatterns` (plural). The plan's acceptance criteria use the old flag name. Using `npx jest` directly with the new flag name resolves this. The `pnpm test --` invocation also had double-`--` separator issues with Jest 30's CLI parsing.

## Known Stubs

- `src/auth/guards/optional-jwt-auth.guard.ts` — stub class that extends JwtAuthGuard with no overrides. Full `handleRequest` implementation (absent-token passthrough, invalid-token 401) is intentionally deferred to Plan 02-02 per the plan spec.

## User Setup Required

**External services require manual configuration before this auth infrastructure can be used at runtime:**

| Env Var | Description | Where to get it |
|---------|-------------|-----------------|
| `AUTH0_JWKS_URI` | Auth0 JWKS endpoint | Auth0 dashboard → Applications → API → Settings → JWKS URI |
| `AUTH0_AUDIENCE` | API identifier | Auth0 dashboard → APIs → your API identifier |
| `AUTH0_ISSUER` | Auth0 tenant URL | `https://{your-tenant}.auth0.com/` |
| `AUTH0_NAMESPACE` | Custom claims namespace | Set to `https://exkuala.cv/roles` — must match Auth0 Action config |

Add all four to `.env` before running the app. The server will crash at boot if any are missing (validated by `env.validation.ts`).

## Next Phase Readiness

- Auth guard chain is wired and fail-closed. All routes now require a valid Auth0 JWT unless decorated with `@Public()`.
- Plan 02-02 (OptionalJwtAuthGuard full implementation + integration tests) can proceed immediately.
- Phase 3 (Users) can import `JwtAuthGuard`, `@Public()`, and `@Roles()` from `AuthModule` exports.
- **Blocker for runtime testing:** Auth0 env vars must be set before `pnpm start` will succeed.

---
*Phase: 02-auth-infrastructure*
*Completed: 2026-04-29*
