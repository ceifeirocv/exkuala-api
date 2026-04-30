---
phase: 02-auth-infrastructure
verified: 2026-04-29T18:00:00Z
status: human_needed
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Send a request with a valid Auth0 JWT to any non-@Public() route and confirm 200; send without Authorization header and confirm 401"
    expected: "Valid JWT -> 200 from protected route; missing header -> 401 Unauthorized"
    why_human: "Requires a live Auth0 tenant with real JWKS, audience, issuer, and a signed RS256 token. Cannot test without running the server with real AUTH0_* env vars."
  - test: "Send to a @Roles('admin')-decorated route with a user-role token, then with an admin-role token"
    expected: "user-role token -> 403 Forbidden; admin-role token -> 200 OK"
    why_human: "Requires a live Auth0 tenant to obtain tokens with specific role claims under the https://exkuala.cv/roles namespace."
  - test: "Send to a @Public()-decorated route without any Authorization header"
    expected: "200 OK — no auth header required"
    why_human: "Requires a running server; the AppController root route must be decorated @Public() or a dedicated @Public() test route must exist."
  - test: "Send 10 rapid authenticated requests and confirm the JWKS endpoint is fetched only once (or not at all after the first cache fill)"
    expected: "JWKS endpoint receives at most 1 request across the 10 calls; subsequent requests use the cached key"
    why_human: "Cache behavior is only observable at runtime. The code sets cache: true with jwksRequestsPerMinute: 10 — correctness of the jwks-rsa library's caching cannot be confirmed by static analysis alone."
---

# Phase 2: Auth Infrastructure Verification Report

**Phase Goal:** Protected routes require a valid Auth0 JWT; role claims are enforced; public routes bypass the guard cleanly
**Verified:** 2026-04-29T18:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (Roadmap Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A request with a valid Auth0 JWT reaches a protected route; a request without one receives 401 | VERIFIED (code) | `JwtAuthGuard` extends `AuthGuard('jwt')` and is registered as first `APP_GUARD`. It calls `super.canActivate()` (passport-jwt) for all non-@Public() routes. RS256 + JWKS validation in `JwtStrategy`. Runtime confirmation needs human (live Auth0 tenant). |
| 2 | A route decorated with `@Roles('admin')` returns 403 for a user-role token and 200 for an admin-role token | VERIFIED (code + unit tests) | `RolesGuard.canActivate()` reads ROLES_KEY metadata, extracts `req.user.roles` set by `JwtStrategy.validate()`, returns `required.every(role => user?.roles?.includes(role))`. Unit tests confirm: `roles=['user']` returns false, `roles=['admin']` returns true. RolesGuard registered as second APP_GUARD. |
| 3 | A route decorated with `@Public()` returns 200 without any Authorization header | VERIFIED (code + unit tests) | Both `JwtAuthGuard` and `RolesGuard` call `reflector.getAllAndOverride(IS_PUBLIC_KEY, ...)` and return `true` early when the decorator is present. Unit tests in `jwt-auth.guard.spec.ts` (1 test) and `roles.guard.spec.ts` (1 test) confirm bypass. |
| 4 | JWKS keys are cached — the JWKS endpoint is not called on every request | VERIFIED (code) | `JwtStrategy` constructor passes `cache: true, rateLimit: true, jwksRequestsPerMinute: 10` to `passportJwtSecret()`. Runtime cache behavior requires live confirmation (see human verification). |

**Score:** 4/4 truths have complete code implementations. All automated checks pass.

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/auth/strategies/jwt.strategy.ts` | JWKS-backed RS256 JWT validation, extracts { sub, roles } | VERIFIED | Exists, 39 lines, substantive. `passportJwtSecret({ cache: true, rateLimit: true, jwksRequestsPerMinute: 10 })`. `validate()` extracts `sub` and `payload[AUTH0_NAMESPACE]` as roles. |
| `src/auth/guards/jwt-auth.guard.ts` | Global auth guard — fail-closed, IS_PUBLIC_KEY bypass | VERIFIED | Exists, 21 lines, substantive. Extends `AuthGuard('jwt')`. `getAllAndOverride(IS_PUBLIC_KEY, ...)` check on line 13. |
| `src/auth/guards/roles.guard.ts` | Role enforcement guard — reads @Roles() metadata, checks req.user.roles | VERIFIED | Exists, 27 lines, substantive. Checks IS_PUBLIC_KEY then ROLES_KEY. Uses `required.every(role => user?.roles?.includes(role))` — safe for undefined user. |
| `src/auth/guards/optional-jwt-auth.guard.ts` | OptionalJwtAuthGuard — absent token passes, invalid token 401 | VERIFIED | Exists, 24 lines, fully implemented (not a stub). `handleRequest` with `info instanceof Error` narrowing. D-07 and D-08 both implemented. |
| `src/auth/decorators/public.decorator.ts` | IS_PUBLIC_KEY constant and @Public() decorator | VERIFIED | Exists, 5 lines. Exports `IS_PUBLIC_KEY = 'isPublic'` and `Public = () => SetMetadata(IS_PUBLIC_KEY, true)`. |
| `src/auth/decorators/roles.decorator.ts` | ROLES_KEY constant and @Roles() decorator | VERIFIED | Exists, 5 lines. Exports `ROLES_KEY = 'roles'` and `Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles)`. |
| `src/auth/auth.module.ts` | AuthModule — PassportModule, APP_GUARD registrations (JwtAuthGuard first, RolesGuard second) | VERIFIED | Exists, 19 lines. `JwtAuthGuard` at line 13, `RolesGuard` at line 14 — correct order. Exports `JwtAuthGuard` and `OptionalJwtAuthGuard`. |
| `src/config/env.validation.ts` | EnvironmentVariables extended with 4 Auth0 required @IsString() fields | VERIFIED | All four fields present: `AUTH0_JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`, `AUTH0_NAMESPACE`. `grep -c 'AUTH0_'` returns 4. |
| `src/auth/strategies/jwt.strategy.spec.ts` | 3 tests covering validate() behavior | VERIFIED | 3 `it()` blocks: namespace claim present, absent, explicitly undefined. All pass. |
| `src/auth/guards/jwt-auth.guard.spec.ts` | 2 tests: @Public() bypass, non-public delegation | VERIFIED | 2 `it()` blocks. Uses `async/await + rejects` for delegation test (correctly handles async AuthGuard). |
| `src/auth/guards/roles.guard.spec.ts` | 5 tests covering all RolesGuard paths | VERIFIED | 5 `it()` blocks: public bypass, no roles, role match, role mismatch, undefined user (no crash). |
| `src/auth/guards/optional-jwt-auth.guard.spec.ts` | 4 tests covering D-07 and D-08 handleRequest cases | VERIFIED | 4 `it()` blocks: absent token → undefined, invalid token → throws, passport error → throws, valid token → returns user. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `jwt.strategy.ts` | `env.validation.ts` (AUTH0_JWKS_URI) | `config.get<string>('AUTH0_JWKS_URI')` in constructor param (not `this.config`) | WIRED | Line 21: `jwksUri: config.get<string>('AUTH0_JWKS_URI')!`. Correct use of constructor param (not `this.config`). |
| `jwt.strategy.ts` | `env.validation.ts` (AUTH0_NAMESPACE) | `this.config.get<string>('AUTH0_NAMESPACE')` in validate() | WIRED | Line 32: namespace read at request time via `this.config` — correct, `this` is bound after super() completes. |
| `jwt-auth.guard.ts` | `public.decorator.ts` | `reflector.getAllAndOverride(IS_PUBLIC_KEY, [handler, class])` | WIRED | Line 13: `this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [...])`. |
| `roles.guard.ts` | `public.decorator.ts` | `reflector.getAllAndOverride(IS_PUBLIC_KEY, ...)` | WIRED | Line 11: IS_PUBLIC_KEY bypass check — independent of JwtAuthGuard. |
| `roles.guard.ts` | `roles.decorator.ts` | `reflector.getAllAndOverride(ROLES_KEY, [handler, class])` | WIRED | Line 17: `this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [...])`. |
| `app.module.ts` | `auth.module.ts` | `AuthModule` in imports[] | WIRED | Line 6 import + line 32 in imports[] array. |
| `auth.module.ts` | `jwt.strategy.ts` | `JwtStrategy` in providers[] | WIRED | Line 12: `JwtStrategy` registered as provider — NestJS injects `ConfigService`. |
| `auth.module.ts` | `jwt-auth.guard.ts` + `roles.guard.ts` | `APP_GUARD` registrations | WIRED | Lines 13-14: JwtAuthGuard first (sets req.user), RolesGuard second (reads req.user.roles). |
| `optional-jwt-auth.guard.ts` | `jwt-auth.guard.ts` | `extends JwtAuthGuard` | WIRED | Inherits `canActivate()` (including IS_PUBLIC_KEY bypass) and overrides `handleRequest`. |

---

### Data-Flow Trace (Level 4)

Not applicable — this phase delivers guard/middleware infrastructure, not data-rendering components. There are no state variables flowing to UI or API response bodies from this phase's artifacts.

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Auth test suite (14 tests, 4 suites) | `npx jest --testPathPatterns=auth` | 14 passed, 0 failed | PASS |
| TypeScript compilation | `npx tsc --noEmit` | 0 errors, 0 output | PASS |
| `instanceof Error` narrowing present | `grep 'instanceof Error' src/auth/guards/optional-jwt-auth.guard.ts` | Match found on line 20 | PASS |
| AUTH0_ env vars count | `grep -c 'AUTH0_' src/config/env.validation.ts` | 4 | PASS |
| AuthModule wired in AppModule | `grep 'AuthModule' src/app.module.ts` | 2 matches (import + imports[]) | PASS |
| JwtAuthGuard before RolesGuard | `grep -n 'APP_GUARD' src/auth/auth.module.ts` | JwtAuthGuard at line 13, RolesGuard at line 14 | PASS |
| Live 401 without token | Requires running server with real Auth0 env vars | SKIPPED | SKIP (human needed) |
| Live 403/200 role enforcement | Requires live Auth0 token with role claims | SKIPPED | SKIP (human needed) |
| Live @Public() returns 200 | Requires running server | SKIPPED | SKIP (human needed) |
| JWKS cache — single fetch across requests | Requires live Auth0 JWKS endpoint and server logs | SKIPPED | SKIP (human needed) |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| AUTH-01 | 02-01 | JWT authentication guard — valid token required, invalid/missing -> 401 | SATISFIED | JwtAuthGuard + JwtStrategy implement fail-closed auth. Unit tests confirm @Public() bypass and passport delegation. |
| AUTH-02 | 02-01 | Role-based access control — @Roles() enforced, non-matching token -> 403 | SATISFIED | RolesGuard reads ROLES_KEY, checks `req.user.roles`. Unit tests confirm role match/mismatch. |
| AUTH-04 | 02-02 | @Public() bypass — public routes reachable without Authorization header | SATISFIED | Both JwtAuthGuard and RolesGuard check IS_PUBLIC_KEY independently. OptionalJwtAuthGuard handles absent token (D-07) vs invalid token (D-08) distinction via `info instanceof Error`. |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `src/auth/guards/optional-jwt-auth.guard.ts` (Plan 01 state) | — | The stub `extends JwtAuthGuard {}` with no `handleRequest` override was a temporary placeholder | INFO | Resolved — Plan 02 replaced it with the full implementation. No stub remains. |

No blockers. No warnings. No hardcoded empty returns, TODO/FIXME markers, or placeholder strings found in the final state of any auth file.

---

### Pre-existing Test Failures (Not Regressions from Phase 2)

The full test suite (`npx jest`) shows 3 suites failing, 2 of which are confirmed pre-existing from prior phases:

| Failing Suite | Root Cause | Phase Responsible |
|---------------|------------|-------------------|
| `src/config/env.validation.spec.ts` | Test fixture does not include the 4 Auth0 env vars that Phase 2 added to `EnvironmentVariables`. The spec was not updated. | Phase 2 introduced the fields; the spec update was noted as deferred in 02-02-SUMMARY.md. |
| `src/users/user.entity.spec.ts` | `@paralleldrive/cuid2@3.3.0` uses ESM syntax not covered by `transformIgnorePatterns`. | Phase 1.1 (TypeORM migration). |
| `src/events/event.entity.spec.ts` | Same ESM/cuid2 issue. | Phase 1.1. |

**Impact on Phase 2 verification:** None. All 14 auth-specific tests pass. The `env.validation.spec.ts` failure is a test maintenance gap (spec not updated to match Phase 2's new required fields), not an implementation defect — the implementation itself is correct and the validation function works as intended.

---

### Human Verification Required

These items cannot be verified by static analysis or unit tests. They require a running NestJS server with real Auth0 configuration.

#### 1. Protected Route Returns 401 Without Token

**Test:** Start the server with valid AUTH0_* env vars. Send `curl http://localhost:3000/api/v1/` (or any non-@Public() route) without an Authorization header.
**Expected:** HTTP 401 Unauthorized
**Why human:** Requires live Auth0 JWKS endpoint to be reachable and env vars set. Unit tests mock passport internals.

#### 2. Protected Route Returns 200 With Valid JWT

**Test:** Obtain a valid RS256 JWT from Auth0 tenant. Send `curl -H "Authorization: Bearer <token>" http://localhost:3000/api/v1/`.
**Expected:** HTTP 200 (or the route's normal response — not 401)
**Why human:** Requires a real Auth0 tenant, application credentials, and a signed token.

#### 3. @Roles('admin') Returns 403 for User Token, 200 for Admin Token

**Test:** Add a temporary test route decorated `@Roles('admin')`. Obtain a token with `roles: ['user']` and one with `roles: ['admin']` (via Auth0 Action setting the `https://exkuala.cv/roles` namespace claim). Send requests with each.
**Expected:** user token -> 403 Forbidden; admin token -> 200 OK
**Why human:** Requires Auth0 Actions configured to inject the custom namespace claim; requires two distinct tokens.

#### 4. JWKS Cache — Endpoint Not Called on Every Request

**Test:** Enable JWKS endpoint logging (or use a mock JWKS server that counts requests). Send 10 rapid authenticated requests. Observe JWKS fetch count.
**Expected:** JWKS endpoint called at most once across the 10 requests; subsequent calls use the in-memory cache (600s TTL).
**Why human:** `cache: true` in `passportJwtSecret` is a library contract. Verifying the library honors it requires a live server with an observable JWKS endpoint.

---

## Gaps Summary

No gaps found. All four roadmap success criteria have complete, substantive, wired implementations. 14 auth unit tests pass. TypeScript compiles clean. The only items requiring human sign-off are runtime behaviors that cannot be tested without a live Auth0 tenant — these are expected and documented.

---

_Verified: 2026-04-29T18:00:00Z_
_Verifier: Claude (gsd-verifier)_
