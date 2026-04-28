# Phase 2: Auth Infrastructure - Context

**Gathered:** 2026-04-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a working JWT guard chain: all routes are protected by default (fail-closed), Auth0 JWTs are validated via JWKS (RS256, cache enabled), role claims are enforced via `@Roles()` decorator, and routes can opt out of auth via `@Public()`. An `OptionalJwtAuthGuard` handles routes where auth is desirable but not required.

**In scope:**
- `src/auth/` NestJS module with all auth concerns co-located
- `JwtStrategy` (jwks-rsa, RS256, cache enabled, default TTL/rate-limit)
- `JwtAuthGuard` registered globally via `APP_GUARD`
- `RolesGuard` registered globally via `APP_GUARD`
- `@Roles()` decorator
- `@Public()` decorator (bypasses both guards)
- `OptionalJwtAuthGuard` (absent token → pass; invalid token → 401)
- Auth0 env vars added as required to `env.validation.ts`
- Guard integration tests

**Out of scope:**
- Local User record upsert (Phase 3)
- Any feature endpoint — Phase 2 only wires the guard chain
- RSVP, organizer, event auth concerns (later phases)

</domain>

<decisions>
## Implementation Decisions

### Auth0 Custom Claims Namespace

- **D-01:** Namespace is `https://exkuala.cv/roles`. JWT payload key: `payload['https://exkuala.cv/roles']`.
- **D-02:** Roles are embedded as a **flat string array** — e.g. `['user']`, `['admin']`. `RolesGuard` checks `roles.includes(required)`.
- **D-03:** `AUTH0_NAMESPACE` env var value = `https://exkuala.cv/roles`. `JwtStrategy` reads it from `ConfigService` — no hardcoded string in code.

### Guard Wiring

- **D-04:** Both `JwtAuthGuard` and `RolesGuard` registered as `APP_GUARD` providers in `AuthModule`. All routes protected by default — fail-closed posture.
- **D-05:** `@Public()` decorator short-circuits both guards. A route decorated `@Public()` is reachable without any Authorization header.

### req.user Shape

- **D-06:** `JwtStrategy.validate()` returns `{ sub: string, roles: string[] }`. This object is attached to `req.user`. No email or other JWT fields extracted in Phase 2. Phase 3 (Users) will extend the request context with the local DB user record.

### OptionalJwtAuthGuard

- **D-07:** Token **absent** → pass through, `req.user` remains undefined.
- **D-08:** Token **present but invalid** (expired, bad signature) → return 401. An explicit but invalid auth attempt should fail loudly.

### JWKS Cache

- **D-09:** Use `jwks-rsa` defaults: `cache: true`, default TTL (600s), default rate limit (10 req/min). No custom env vars for cache tuning.

### Auth Module Structure

- **D-10:** All auth code lives in `src/auth/`. `AuthModule` registers global `APP_GUARD` providers and exports `JwtAuthGuard`, `OptionalJwtAuthGuard`, and the decorator files so feature modules can import them.

### Environment Variables

- **D-11:** Four Auth0 vars become **required** at boot in Phase 2 (extending `env.validation.ts`):
  - `AUTH0_JWKS_URI` — JWKS endpoint URL
  - `AUTH0_AUDIENCE` — API identifier
  - `AUTH0_ISSUER` — Auth0 tenant URL (e.g. `https://your-tenant.auth0.com/`)
  - `AUTH0_NAMESPACE` — Custom claims namespace (`https://exkuala.cv/roles`)

### Claude's Discretion

- File layout inside `src/auth/` (e.g. `strategies/`, `guards/`, `decorators/` subdirs vs flat)
- Whether to create a `CurrentUser()` param decorator in Phase 2 or defer to Phase 3
- Exact test fixture structure for JWT integration tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 2 goal, success criteria, and plan breakdown (02-01, 02-02)
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-02, AUTH-04 requirement definitions
- `.planning/PROJECT.md` — Core project vision and stack decisions
- `.planning/STATE.md` — Pre-Phase 2 blocker note on namespace; confirmed `passport-jwt + jwks-rsa` stack decision

### Existing Infrastructure (must be extended)
- `src/app.module.ts` — Where `AuthModule` is imported; `ConfigModule` already global
- `src/config/env.validation.ts` — Auth0 env vars added here (D-11); must extend `EnvironmentVariables` class

### Prior Phase Decisions
- `.planning/phases/01-foundation/01-CONTEXT.md` — D-05 (env vars), D-06 (Swagger addBearerAuth already in place)

No external ADRs — all auth requirements captured in decisions above and planning docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/config/env.validation.ts` — `EnvironmentVariables` class uses `class-validator` decorators; add `@IsString()` fields for 4 Auth0 vars using the same pattern
- `ConfigModule` (global, `isGlobal: true`) — `ConfigService` injectable in `JwtStrategy` via `forRootAsync` / constructor injection; no re-import needed
- `src/app.module.ts` — Import `AuthModule` here; pattern matches existing `TypeOrmModule` import

### Established Patterns
- `forRootAsync({ inject: [ConfigService], useFactory: (cfg) => ... })` — used for TypeORM; same pattern applies to `PassportModule` and `JwtModule` async config
- `class-validator` + `class-transformer` — single validation library across DTOs and env; extend it for new env vars
- NestJS module isolation — `TypeOrmModule.forFeature([Entity])` pattern in feature modules; `AuthModule` follows same encapsulation

### Integration Points
- `src/app.module.ts` — Add `AuthModule` to `imports[]`
- `src/config/env.validation.ts` — Extend `EnvironmentVariables` with 4 `@IsString()` Auth0 fields
- `src/main.ts` — No changes needed; global guards are registered via `APP_GUARD` provider, not `app.useGlobalGuards()`

</code_context>

<specifics>
## Specific Ideas

- Auth0 namespace is `https://exkuala.cv/roles` — note `.cv` TLD (not `.app`). Verify this matches exactly what is configured in your Auth0 Action.
- `JwtStrategy` reads namespace from `ConfigService.get('AUTH0_NAMESPACE')` — allows changing it via env without code changes.
- `OptionalJwtAuthGuard` should extend `JwtAuthGuard` and override `handleRequest` to suppress the unauthorized exception when no token is present, but propagate it when a token is present but invalid.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 02-auth-infrastructure*
*Context gathered: 2026-04-28*
