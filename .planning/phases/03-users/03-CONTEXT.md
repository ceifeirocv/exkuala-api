# Phase 3: Users - Context

**Gathered:** 2026-05-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Extend `JwtStrategy.validate()` to load or create a local `UserEntity` from the JWT `sub` claim, then attach the merged user+roles object to `req.user`. Every subsequent authenticated request automatically has a typed, DB-backed user record available to guards, services, and controllers.

**In scope:**
- `UsersService.findOrCreate(sub: string): Promise<UserEntity>` — find by auth0Id; if absent, call `upsertFromAuth0(sub)` then re-fetch
- `JwtStrategy.validate()` made async; injects `UsersService`; returns `AuthenticatedUser` (flat merge)
- `AuthModule` imports `UsersModule` to resolve the `UsersService` dependency
- `src/types/auth.ts` — `AuthenticatedUser` interface (exported named type)
- `src/types/express.d.ts` — module augmentation wiring `Request.user` to `AuthenticatedUser`
- `src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` param decorator typed to `AuthenticatedUser`
- `jwt.strategy.spec.ts` updated to mock `findOrCreate()` and assert new return shape

**Out of scope:**
- Adding email/name columns to `UserEntity` (deferred to later phase)
- User-facing endpoints (`GET /me`, profile updates)
- Roles stored in DB — roles come from JWT only in v1
- `@OptionalCurrentUser()` decorator (not needed until public routes require user context)

</domain>

<decisions>
## Implementation Decisions

### req.user Shape

- **D-01:** `req.user` is a **flat merge** of `UserEntity` fields + `roles` from JWT. Shape: `{ id: string, auth0Id: string, createdAt: Date, updatedAt: Date, roles: string[] }`. `roles` is a transient JWT-derived field, not a DB column.
- **D-02:** `AuthenticatedUser` interface exported from `src/types/auth.ts` as the single source of truth. `src/types/express.d.ts` imports it and augments `Express.Request.user`.
- **D-03:** On DB failure (fallback upsert throws or `findOrCreate` can't return entity): `JwtStrategy.validate()` throws `UnauthorizedException`. Passport treats this as a 401. Belt-and-suspenders — webhook path should have created the user; this is a last-resort guard.

### UsersService Fallback Method

- **D-04:** Add `findOrCreate(sub: string): Promise<UserEntity>` to `UsersService`. Does NOT modify `upsertFromAuth0()` (signature stays `void`). Implementation: `findOne({ where: { auth0Id: sub } })` → if null, call `upsertFromAuth0(sub)` → `findOneOrFail({ where: { auth0Id: sub } })`.
- **D-05:** `AuthModule` adds `UsersModule` to its `imports[]`. `UsersModule` already exports `UsersService` (wired in Phase 02.1). No duplicate provider registration.
- **D-06:** `jwt.strategy.spec.ts` updated in Phase 3: mock `UsersService.findOrCreate()`, assert async `validate()` returns the `AuthenticatedUser` shape, assert `UnauthorizedException` thrown when `findOrCreate` throws.

### @CurrentUser() Decorator

- **D-07:** `@CurrentUser()` param decorator implemented in Phase 3 at `src/auth/decorators/current-user.decorator.ts`. Returns `AuthenticatedUser` (non-optional). Only safe on routes protected by `JwtAuthGuard` — usage on `@Public()` routes returns `undefined` (programmer error, no special handling).
- **D-08:** No `@OptionalCurrentUser()` decorator in Phase 3 — not needed yet. Defer until a public route requires optional user context.

### Claude's Discretion

- Exact error logging in `findOrCreate()` (structured log before re-throw vs silent throw)
- Whether `src/types/` is a new directory or files go elsewhere (e.g., `src/auth/types/`)
- How to handle `findOneOrFail` vs manual null-check + throw in `findOrCreate()`

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 3 goal and success criteria
- `.planning/REQUIREMENTS.md` — AUTH-03 (user upsert requirement)
- `.planning/PROJECT.md` — Stack decisions, Auth0 as identity provider

### Prior Phase Context
- `.planning/phases/02.1-add-a-webhook-endpoint-for-auth0-to-add-or-refresh-user-on-c/02.1-CONTEXT.md` — D-10 (Phase 3 job), D-11 (fallback upsert), existing `upsertFromAuth0()` contract
- `.planning/phases/02-auth-infrastructure/02-CONTEXT.md` — D-06 (`req.user` original shape `{ sub, roles }`), D-04/D-05 (guard wiring, `@Public()` pattern)

### Existing Code to Extend
- `src/auth/strategies/jwt.strategy.ts` — File being modified; current sync `validate()` returns `{ sub, roles }`
- `src/auth/auth.module.ts` — Add `UsersModule` to `imports[]`
- `src/users/users.service.ts` — Add `findOrCreate(sub)` method here
- `src/users/users.module.ts` — Already exports `UsersService`; verify exports array
- `src/users/user.entity.ts` — `UserEntity` shape being merged into `AuthenticatedUser`
- `src/auth/decorators/` — Add `current-user.decorator.ts` alongside existing decorators

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/users/users.service.ts` — `upsertFromAuth0(sub)` already implemented; add `findOrCreate()` alongside it using the same `userRepository` injection
- `src/auth/decorators/public.decorator.ts` — Pattern for `createParamDecorator`; `@CurrentUser()` follows the same file structure
- `src/users/user.entity.ts` — `UserEntity` has `{ id, auth0Id, createdAt, updatedAt }`; all 4 fields fold into `AuthenticatedUser`

### Established Patterns
- `JwtStrategy` constructor uses `config` parameter directly in `super()` (not `this.config`) to avoid unbound-this pitfall — noted in existing comments; keep this pattern when adding `UsersService` injection
- `forRootAsync({ inject: [ConfigService], useFactory })` — existing async module pattern; `AuthModule` importing `UsersModule` is a simpler synchronous import (no factory needed)
- `class-validator` decorators — not needed for `AuthenticatedUser` interface (it's a plain interface, not a DTO class)

### Integration Points
- `src/auth/auth.module.ts` — Add `UsersModule` to `imports[]`
- `src/auth/strategies/jwt.strategy.ts` — Inject `UsersService` via constructor; make `validate()` async; call `findOrCreate(payload.sub)`, return flat merge
- `src/auth/strategies/jwt.strategy.spec.ts` — Update to mock `UsersService`, test async path, test `UnauthorizedException` on failure

</code_context>

<specifics>
## Specific Ideas

- `JwtStrategy` constructor pitfall (Pitfall 1 from prior phases): `UsersService` injection should use the same pattern as `ConfigService` — injected parameter, not `this.usersService` inside `super()`. `validate()` is safe because it's called after construction.
- `findOrCreate()` is a hot path (every authenticated request). The happy path (user already exists) should be a single `findOne` call. Only on first-ever request does the upsert + re-fetch add latency.
- `AuthenticatedUser` interface should NOT extend `UserEntity` class (avoids coupling to TypeORM decorators). It's a plain interface with the same fields.

</specifics>

<deferred>
## Deferred Ideas

- `@OptionalCurrentUser()` decorator — add when first public route needs optional user context (likely Phase 7 or 8)
- Storing roles in DB — not needed for v1; all role checks go through JWT claims
- User profile endpoints (`GET /me`, `PATCH /me`) — no user-facing endpoints in Phase 3; first endpoint needs come from Phase 5 (Organizers) and Phase 8 (RSVP)
- Email/name columns on `UserEntity` — defer to later phase when downstream features require them

</deferred>

---

*Phase: 03-users*
*Context gathered: 2026-05-03*
