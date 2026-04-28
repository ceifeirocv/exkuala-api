# Phase 2: Auth Infrastructure - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-28
**Phase:** 02-auth-infrastructure
**Areas discussed:** Auth0 namespace, Guard wiring scope, Role claim format, req.user shape, OptionalJwtAuthGuard behavior, Auth module structure, JWKS cache settings

---

## Auth0 Namespace

| Option | Description | Selected |
|--------|-------------|----------|
| `https://exkuala.app/roles` | Matches STATE.md example | |
| `https://exkuala.app/` | Namespace prefix only | |
| `https://exkuala.cv/roles` | User's actual Auth0 tenant namespace | ✓ |

**User's choice:** `https://exkuala.cv/roles` (free-text via "Other")
**Notes:** `.cv` TLD not `.app` — user confirmed this is the correct Auth0 tenant domain.

---

## Guard Wiring Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Global APP_GUARD | All routes protected by default, @Public() opts out | ✓ |
| Explicit @UseGuards() | Each controller opts in | |
| You decide | Claude picks | |

**User's choice:** Global APP_GUARD (Recommended)
**Notes:** Fail-closed posture — new controllers are automatically protected.

---

## Role Claim Format

| Option | Description | Selected |
|--------|-------------|----------|
| Flat string array | `['user']`, `['admin']` — standard Auth0 Action output | ✓ |
| Single string | `"admin"` — simpler but single-role only | |
| You decide | Claude picks flat array | |

**User's choice:** Flat string array (Recommended)
**Notes:** Consistent with Auth0 Management API roles → Action pattern.

---

## req.user Shape

| Option | Description | Selected |
|--------|-------------|----------|
| `{ sub, roles }` minimal | Only Auth0 user ID and roles | ✓ |
| `{ sub, email, roles }` | Also extract email from JWT | |
| You decide | Claude picks minimal | |

**User's choice:** `{ sub, roles }` minimal (Recommended)
**Notes:** Phase 3 will add local DB user enrichment. Keep Phase 2 self-contained.

---

## OptionalJwtAuthGuard Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Return 401 for invalid token | Explicit failed auth attempt fails loudly | ✓ |
| Pass through silently | Treat invalid same as absent | |
| You decide | Claude picks 401 | |

**User's choice:** Return 401 (Recommended)
**Notes:** Token absent = anonymous OK; token present but invalid = explicit error.

---

## Auth Module Structure

| Option | Description | Selected |
|--------|-------------|----------|
| `src/auth/` module, guards in AuthModule | All auth co-located, APP_GUARD in AuthModule.providers | ✓ |
| `src/auth/` module, guards in AppModule | Splits guard registration from auth logic | |
| You decide | Claude picks standard layout | |

**User's choice:** `src/auth/` module, export guards + decorators (Recommended)
**Notes:** Standard NestJS layout. AuthModule owns all auth concerns.

---

## JWKS Cache Settings

| Option | Description | Selected |
|--------|-------------|----------|
| Use defaults | 600s TTL, 10 req/min rate limit — sufficient for Auth0 | ✓ |
| Customize via env vars | JWKS_CACHE_TTL + JWKS_RATE_LIMIT optional env vars | |
| You decide | Claude uses defaults | |

**User's choice:** Use defaults (Recommended)
**Notes:** No unnecessary config surface for standard Auth0 JWT setup.

---

## Claude's Discretion

- File layout inside `src/auth/` (subdirs vs flat)
- Whether to create `@CurrentUser()` param decorator in Phase 2 or Phase 3
- JWT integration test fixture structure

## Deferred Ideas

None — discussion stayed within phase scope.
