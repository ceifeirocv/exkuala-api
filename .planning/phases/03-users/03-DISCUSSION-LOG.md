# Phase 3: Users - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-03
**Phase:** 03-users
**Areas discussed:** req.user shape, UsersService fallback method, @CurrentUser() decorator

---

## req.user shape

| Option | Description | Selected |
|--------|-------------|----------|
| Flat merge | `{ id, auth0Id, createdAt, updatedAt, roles }` at top level. Clean access: `req.user.id`, `req.user.roles`. | ✓ |
| Wrapper object | `{ user: UserEntity, sub, roles }` — explicit separation. More verbose: `req.user.user.id`. | |
| UserEntity only | Return entity directly, roles dropped from req.user. | |

**User's choice:** Flat merge

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add type augmentation | `src/types/express.d.ts` + named `AuthenticatedUser` type in `src/types/auth.ts` | ✓ |
| No, use type casts per-use | Cast manually at each call site. | |

**User's choice:** Yes — named type + augmentation

---

| Option | Description | Selected |
|--------|-------------|----------|
| Throw UnauthorizedException | 401 on DB failure — Passport treats any exception from validate() as auth failure. | ✓ |
| Throw InternalServerErrorException | 500 — more semantically correct but Passport may not handle cleanly. | |
| Log and return null | Passport treats null as 401 automatically. | |

**User's choice:** Throw UnauthorizedException

---

## UsersService fallback method

| Option | Description | Selected |
|--------|-------------|----------|
| Add findOrCreate() | New method: findByAuth0Id → if null, upsertFromAuth0() → re-fetch. Returns UserEntity. upsertFromAuth0() unchanged. | ✓ |
| Change upsertFromAuth0() to return entity | Modify existing signature to return UserEntity. | |
| Two separate methods | findByAuth0Id() + upsertFromAuth0() called explicitly from JwtStrategy. | |

**User's choice:** Add findOrCreate()

---

| Option | Description | Selected |
|--------|-------------|----------|
| AuthModule imports UsersModule | Clean NestJS pattern. UsersModule already exports UsersService. | ✓ |
| Register UsersService directly in AuthModule | Duplicates repository registration — anti-pattern. | |

**User's choice:** AuthModule imports UsersModule

---

| Option | Description | Selected |
|--------|-------------|----------|
| Update spec in Phase 3 | jwt.strategy.spec.ts updated immediately to mock findOrCreate() and assert new async shape. | ✓ |
| Separate test update task | Leave spec update as follow-up. | |

**User's choice:** Update spec in Phase 3

---

## @CurrentUser() decorator

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, implement now | Natural timing — shape defined here. Typed to AuthenticatedUser. Phase 5+ can use immediately. | ✓ |
| Defer to Phase 5 | Add when first endpoint needs it. | |

**User's choice:** Yes, implement in Phase 3

---

| Option | Description | Selected |
|--------|-------------|----------|
| Protected routes only | Returns AuthenticatedUser (non-optional). Undefined on @Public() routes — programmer error. | ✓ |
| Optional variant too | Export both @CurrentUser() and @OptionalCurrentUser(). | |

**User's choice:** Protected routes only — no @OptionalCurrentUser() in Phase 3

---

## Claude's Discretion

- Exact error logging in `findOrCreate()` before re-throw
- Whether `src/types/` is a new top-level dir or files go under `src/auth/types/`
- `findOneOrFail` vs manual null-check + throw in `findOrCreate()`

## Deferred Ideas

- `@OptionalCurrentUser()` — add when first public route needs optional user context
- Roles stored in DB — v1 uses JWT claims only
- User profile endpoints (`GET /me`) — Phase 8 or standalone
- Email/name on `UserEntity` — deferred to later phase
