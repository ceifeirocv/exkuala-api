---
phase: 2
phase_name: "Auth Infrastructure"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 9
  lessons: 6
  patterns: 6
  surprises: 2
missing_artifacts: []
---

# Phase 2 Learnings: Auth Infrastructure

## Decisions

### Fail-closed `APP_GUARD` chain — everything protected by default
`JwtAuthGuard` (first) and `RolesGuard` (second) are registered as `APP_GUARD`; routes opt out with `@Public()`.

**Rationale:** A missing decorator should deny, not allow — the safe failure direction. Guard order ensures `req.user` is set before the roles check runs.
**Source:** 02-01-SUMMARY.md, 02-VERIFICATION.md

### `IS_PUBLIC_KEY` checked independently in BOTH guards
Each guard checks the public flag before any auth logic, rather than relying on the other.

**Rationale:** Independent bypass means neither guard assumes the other ran; `@Public()` works regardless of guard ordering or future refactors.
**Source:** 02-01-SUMMARY.md

### RS256 JWKS validation via `jwks-rsa` with cache + rate-limit
`passportJwtSecret` with `cache: true` (600s TTL) and `rateLimit: true` (10 req/min).

**Rationale:** Auth0 signs with RS256 over a rotating JWKS; caching avoids a JWKS fetch per request, rate-limiting protects the endpoint under load/attack.
**Source:** 02-01-SUMMARY.md

### `@nestjs/jwt` installed but `JwtModule` unused
The package is present for peer-dep completeness; the app never signs tokens.

**Rationale:** Auth0 issues and signs JWTs; this service only verifies. Installing without wiring `JwtModule` keeps the dependency graph honest about "verify-only".
**Source:** 02-01-SUMMARY.md

### `config` constructor param (not `this.config`) inside `super()`
`JwtStrategy` reads config from the constructor parameter when calling `super()`.

**Rationale:** `this` is unbound at the `super()` call site; using `this.config` throws an unbound-`this` TypeError. A documented PassportStrategy pitfall.
**Source:** 02-01-SUMMARY.md

### `AUTH0_NAMESPACE` from ConfigService, never hardcoded
The custom-claims namespace (`https://exkuala.cv/roles`) is read from validated config at `validate()` time.

**Rationale:** The namespace must match the Auth0 Action config and is environment-specific; hardcoding it would couple the strategy to one tenant.
**Source:** 02-01-SUMMARY.md, .planning/STATE.md

### Four Auth0 env vars required at boot (fail-fast)
`AUTH0_JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`, `AUTH0_NAMESPACE` added as `@IsString()` required fields.

**Rationale:** Reuses Phase 1's `skipMissingProperties: false` so the process crashes before binding a port if any Auth0 var is missing — no half-configured auth at runtime.
**Source:** 02-01-SUMMARY.md

### `OptionalJwtAuthGuard`: `info instanceof Error` narrowing
Absent token (passport passes a truthy *string* `'No auth token'`) → request proceeds with `undefined` user (D-07); invalid token (an `Error`) → 401 (D-08).

**Rationale:** `RESEARCH.md` Pitfall 4 — a bare `!user && info` truthiness check would treat the absent-token *string* as an error and wrongly 401. `instanceof Error` is the correct discriminator.
**Source:** 02-02-SUMMARY.md

### `req.user` shape standardized as `{ sub, roles }`
`validate()` returns `{ sub: string, roles: string[] }`, with roles read from the namespaced claim.

**Rationale:** A small, stable contract every downstream phase (`@CurrentUser`, guards) depends on.
**Source:** 02-01-SUMMARY.md

---

## Lessons

### `jwks-rsa` 4.x pulls in ESM-only `jose@6` that pnpm hides from Jest
Under pnpm's nested `.pnpm/jose@6.2.3/...` path, the standard `transformIgnorePatterns` regex doesn't match, so ts-jest can't transform `jose` and the spec throws `Unexpected token 'export'`.

**Context:** Fixed by mocking `jwks-rsa` and `PassportStrategy` in the unit spec (test `validate()` logic, not JWKS fetching) — plus adding `jwks-rsa`/`jose` to `transformIgnorePatterns` defensively. Mocking the strategy is the right unit-level isolation.
**Source:** 02-01-SUMMARY.md

### `AuthGuard.canActivate()` is async — `toThrow()` silently catches nothing
The non-public delegation test wrapped an async call in `expect(() => ...).toThrow()`, which does not catch Promise rejections — the test "passed" while asserting nothing.

**Context:** Use `await expect(...).rejects.toBeDefined()` for async guard methods. A green test is not a passing test if it never awaits the rejection.
**Source:** 02-02-SUMMARY.md

### `@nestjs/passport` reads `getResponse()` before invoking passport
`AuthGuard.canActivate()` calls `context.switchToHttp().getResponse()` before passport runs; a mockContext with only `getRequest()` crashes with an uncaught synchronous TypeError that escapes Jest and kills the Node process.

**Context:** Mock both `getRequest()` and `getResponse()`. The gap was latent — fine while only the `@Public()` early-return path was tested, exposed only when the delegation path was added.
**Source:** 02-02-SUMMARY.md

### Adding required env vars silently broke an unrelated spec
Phase 1's `env.validation.spec.ts` fixture lacked the 4 new Auth0 vars, so `validate()` started throwing in that spec — a cross-file break from a schema change, deferred to a later owner.

**Context:** Same class as Phase 8's `EventsService` constructor change breaking `public-events.service.spec.ts`: tightening a contract breaks every fixture that constructs against it. Grep for fixtures when adding required fields.
**Source:** 02-02-SUMMARY.md, deferred-items.md

### Distinguishing "absent" from "invalid" needs type narrowing, not truthiness
`'No auth token'` is a truthy string; `info instanceof Error` is the only reliable way to separate D-07 (absent → pass) from D-08 (invalid → 401).

**Context:** Optional-auth correctness hinges on this one discriminator; truthiness would conflate the two and reject anonymous requests.
**Source:** 02-02-SUMMARY.md

### Jest 30 `--testPathPattern` → `--testPathPatterns` again
The plan's acceptance commands used the old flag; `pnpm test --` also hit double-`--` separator issues with Jest 30.

**Context:** Recurs across Phases 1.1, 5, 6, 7. Use `npx jest --testPathPatterns=...` and confirm the suite ran.
**Source:** 02-01-SUMMARY.md

---

## Patterns

### Fail-closed `APP_GUARD` + decorator opt-out
Global guards deny by default; `@Public()`/`@Roles()` decorators adjust per route.

**When to use:** Any app where "forgot to protect a route" must fail safe — the project-wide default from Phase 2 on.
**Source:** 02-01-SUMMARY.md

### Independent `IS_PUBLIC_KEY` bypass per guard
Each guard reads the public-route metadata itself before running auth logic.

**When to use:** Multi-guard chains where any guard must honor a public opt-out without depending on sibling guards.
**Source:** 02-01-SUMMARY.md

### `SetMetadata` decorator + `Reflector` key constant
`@Public()`/`@Roles()` as thin `SetMetadata` wrappers over exported key constants, read via `Reflector` in guards.

**When to use:** Attaching route-level policy that guards consult at request time.
**Source:** 02-01-SUMMARY.md

### Mock-the-strategy unit testing
Test `validate()` logic in isolation by mocking `jwks-rsa` and the `PassportStrategy` base, never fetching real JWKS.

**When to use:** Unit-testing Passport strategies — isolate your claim-mapping logic from network and ESM transform issues.
**Source:** 02-01-SUMMARY.md

### `transformIgnorePatterns` allowlist for ESM transitive deps
Allowlist ESM-only transitive packages (`jose`) through ts-jest.

**When to use:** Any Jest suite whose dependency tree includes ESM-only packages — recurs from Phase 1.1 (cuid2/noble).
**Source:** 02-01-SUMMARY.md

### `handleRequest` override for optional auth
Override `handleRequest` and branch on `info instanceof Error` to make a guard pass anonymous requests but reject malformed tokens.

**When to use:** Endpoints that serve both anonymous and authenticated callers (public reads with optional personalization).
**Source:** 02-02-SUMMARY.md

---

## Surprises

### A test that "passed" was asserting nothing
The non-public delegation test used `toThrow()` on an async `canActivate()`; the Promise rejection was never caught, so the test was green while verifying nothing. Switching to `await expect(...).rejects` revealed it.

**Impact:** Another "green ≠ tested" instance (cf. Phase 1.1's decorator-blind entity specs, Phase 5's email-leak mock). Async assertions silently no-op under synchronous matchers.
**Source:** 02-02-SUMMARY.md

### An infra bug stayed hidden until the code path was first exercised
The missing `getResponse()` in mockContext was harmless while only the `@Public()` early-return path ran; adding the delegation test in Plan 02 surfaced a TypeError that crashed the whole Jest process, not just the test.

**Impact:** Coverage gaps hide harness/infra bugs until a path is exercised — and an uncaught synchronous throw in a guard can take down the test runner, not just fail one case. Argues for testing the delegation path, not just the bypass.
**Source:** 02-02-SUMMARY.md
