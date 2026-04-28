# Phase 2: Auth Infrastructure - Research

**Researched:** 2026-04-28
**Domain:** NestJS JWT authentication, Auth0 JWKS/RS256, Passport.js guard chain, role-based access control
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Namespace is `https://exkuala.cv/roles`. JWT payload key: `payload['https://exkuala.cv/roles']`.
- **D-02:** Roles are embedded as a flat string array — e.g. `['user']`, `['admin']`. `RolesGuard` checks `roles.includes(required)`.
- **D-03:** `AUTH0_NAMESPACE` env var value = `https://exkuala.cv/roles`. `JwtStrategy` reads it from `ConfigService` — no hardcoded string in code.
- **D-04:** Both `JwtAuthGuard` and `RolesGuard` registered as `APP_GUARD` providers in `AuthModule`. All routes protected by default — fail-closed posture.
- **D-05:** `@Public()` decorator short-circuits both guards. A route decorated `@Public()` is reachable without any Authorization header.
- **D-06:** `JwtStrategy.validate()` returns `{ sub: string, roles: string[] }`. This object is attached to `req.user`. No email or other JWT fields extracted in Phase 2.
- **D-07:** Token **absent** → pass through, `req.user` remains undefined.
- **D-08:** Token **present but invalid** (expired, bad signature) → return 401.
- **D-09:** Use `jwks-rsa` defaults: `cache: true`, default TTL (600s), default rate limit (10 req/min). No custom env vars for cache tuning.
- **D-10:** All auth code lives in `src/auth/`. `AuthModule` registers global `APP_GUARD` providers and exports `JwtAuthGuard`, `OptionalJwtAuthGuard`, and the decorator files so feature modules can import them.
- **D-11:** Four Auth0 vars become **required** at boot in Phase 2 (extending `env.validation.ts`): `AUTH0_JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`, `AUTH0_NAMESPACE`.

### Claude's Discretion

- File layout inside `src/auth/` (e.g. `strategies/`, `guards/`, `decorators/` subdirs vs flat)
- Whether to create a `CurrentUser()` param decorator in Phase 2 or defer to Phase 3
- Exact test fixture structure for JWT integration tests

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTH-01 | System validates Auth0 JWT tokens on protected routes using jwks-rsa (RS256) | JwtStrategy with `passportJwtSecret` + `secretOrKeyProvider` pattern documented; cache enabled by default |
| AUTH-02 | System enforces role-based access (roles: `user`, `organizer`, `admin`) via Auth0 custom claims | `RolesGuard` + `@Roles()` decorator pattern verified in NestJS docs; `Reflector.get()` reads metadata |
| AUTH-04 | Public routes are accessible without authentication (`@Public()` decorator bypasses JWT guard) | `IS_PUBLIC_KEY` + `SetMetadata` pattern verified; `Reflector.getAllAndOverride()` checks handler then class |
</phase_requirements>

---

## Summary

Phase 2 installs a fail-closed JWT guard chain on a NestJS 11 API. All routes are blocked by default through two globally-registered `APP_GUARD` providers (`JwtAuthGuard` and `RolesGuard`). Auth0 RS256 tokens are validated by fetching the JWKS public key via `jwks-rsa`'s `passportJwtSecret` helper, which is configured with `cache: true` to avoid repeated calls to the JWKS endpoint. Role claims live under a namespaced key (`https://exkuala.cv/roles`) in the JWT payload and are extracted in `JwtStrategy.validate()`.

The `@Public()` decorator attaches a metadata key to a route handler or controller class. Both guards read this key via `Reflector.getAllAndOverride()` and short-circuit before doing any auth logic. `OptionalJwtAuthGuard` extends `JwtAuthGuard` and overrides `handleRequest` to suppress the unauthorized exception when no token is present, but propagate it when a token is present and invalid.

The passport-jwt + jwks-rsa + @nestjs/passport stack is the Auth0-recommended approach for NestJS APIs. All packages are stable and available on npm at versions compatible with NestJS 11. None of the required packages are currently installed — they must be added before implementation begins.

**Primary recommendation:** Use `PassportStrategy(Strategy)` from `@nestjs/passport` with `secretOrKeyProvider: passportJwtSecret({...})` from `jwks-rsa`. Register both guards as `APP_GUARD` in `AuthModule`. Follow the `IS_PUBLIC_KEY` + `Reflector.getAllAndOverride()` pattern for `@Public()`.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT signature validation | API / Backend | — | Token verification must happen server-side; client cannot self-validate |
| JWKS key fetching and caching | API / Backend | — | jwks-rsa runs in the Node process; no external cache needed |
| Role enforcement | API / Backend | — | Authorization decisions are server-side guard logic |
| Public route bypass | API / Backend | — | `@Public()` is a server-side decorator; no client involvement |
| Optional auth (req.user may be undefined) | API / Backend | — | Guard override stays in server guard layer |
| Env var validation at boot | API / Backend | — | `env.validation.ts` runs during NestJS bootstrap, not at request time |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/passport` | 11.0.5 | Wraps Passport.js strategies as NestJS injectable providers | Official NestJS integration; provides `PassportStrategy` base class and `AuthGuard` factory |
| `@nestjs/jwt` | 11.0.2 | JwtModule for NestJS — not used for signing here but required to satisfy `AuthModule` import pattern | Official NestJS JWT utilities; JwtModule is expected even for verification-only setups |
| `passport` | 0.7.0 | Core Passport.js library | Peer dependency of `@nestjs/passport` and `passport-jwt` |
| `passport-jwt` | 4.0.1 | Passport strategy for JWT extraction and verification | Auth0-documented approach for NestJS REST API auth |
| `jwks-rsa` | 4.0.1 | Provides `passportJwtSecret` — fetches and caches RS256 public keys from a JWKS endpoint | Auth0's own library; has built-in cache (600s TTL default) and rate limiting |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/passport-jwt` | 4.0.1 | TypeScript types for passport-jwt | Always — needed for typed `JwtPayload` and `StrategyOptions` |
| `@types/passport` | 1.0.17 | TypeScript types for passport | Always — needed for `Express.User` augmentation |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `passport-jwt` + `jwks-rsa` | `@auth0/express-openid-connect` | Express-specific; less idiomatic for NestJS |
| `passport-jwt` + `jwks-rsa` | `jose` (panva/jose) | More control, but no `passportJwtSecret` helper — more boilerplate |

**Installation:**
```bash
pnpm add @nestjs/passport @nestjs/jwt passport passport-jwt jwks-rsa
pnpm add -D @types/passport-jwt @types/passport
```

**Version verification:** [VERIFIED: npm registry 2026-04-28]
- `@nestjs/passport`: 11.0.5
- `@nestjs/jwt`: 11.0.2
- `passport`: 0.7.0
- `passport-jwt`: 4.0.1
- `jwks-rsa`: 4.0.1
- `@types/passport-jwt`: 4.0.1
- `@types/passport`: 1.0.17

---

## Architecture Patterns

### System Architecture Diagram

```
Incoming HTTP request
        │
        ▼
 ┌─────────────────────────────────────────────┐
 │           JwtAuthGuard (APP_GUARD #1)        │
 │  ┌─────────────────────────────────────────┐│
 │  │ Reflector.getAllAndOverride(IS_PUBLIC)   ││
 │  │     ┌─── true ──► return true (pass)    ││
 │  │     │                                   ││
 │  │     └─── false ─► super.canActivate()   ││
 │  │                        │                ││
 │  │              ┌─────────┴──────────┐     ││
 │  │              │  passport-jwt      │     ││
 │  │              │  ExtractJwt.from   │     ││
 │  │              │  AuthHeaderAsBearer│     ││
 │  │              └────────┬───────────┘     ││
 │  │                       │                 ││
 │  │         ┌─────────────┴──────────────┐  ││
 │  │         │  jwks-rsa passportJwt      │  ││
 │  │         │  Secret (cache: true)      │  ││
 │  │         │  → fetch/cache RS256 key   │  ││
 │  │         │  → verify signature        │  ││
 │  │         └──────┬────────────┬────────┘  ││
 │  │           valid │            │ invalid   ││
 │  │                ▼            ▼           ││
 │  │         JwtStrategy     throw 401       ││
 │  │         .validate()                     ││
 │  │         returns { sub, roles }          ││
 │  │         → req.user assigned             ││
 │  └─────────────────────────────────────────┘│
 └─────────────────────────────────────────────┘
        │ (passed)
        ▼
 ┌─────────────────────────────────────────────┐
 │           RolesGuard (APP_GUARD #2)          │
 │  ┌─────────────────────────────────────────┐│
 │  │ Reflector.getAllAndOverride(IS_PUBLIC)   ││
 │  │     ┌─── true ──► return true (pass)    ││
 │  │     │                                   ││
 │  │     └─── false                          ││
 │  │          Reflector.get(Roles, handler)  ││
 │  │          ┌── no roles ──► return true   ││
 │  │          │                              ││
 │  │          └── roles found                ││
 │  │              req.user.roles.includes()  ││
 │  │              ┌── match ──► return true  ││
 │  │              └── no match ─► throw 403  ││
 │  └─────────────────────────────────────────┘│
 └─────────────────────────────────────────────┘
        │ (passed)
        ▼
    Route handler executes

OptionalJwtAuthGuard (used on specific routes only):
  Token absent → return true, req.user = undefined
  Token present + invalid → throw 401
  Token present + valid → req.user assigned (same as JwtAuthGuard)
```

### Recommended Project Structure

```
src/auth/
├── auth.module.ts              # Module — registers APP_GUARD providers, exports guards + decorators
├── strategies/
│   └── jwt.strategy.ts         # PassportStrategy(Strategy) — JWKS, RS256, validate()
├── guards/
│   ├── jwt-auth.guard.ts        # extends AuthGuard('jwt'), checks IS_PUBLIC_KEY
│   ├── optional-jwt-auth.guard.ts  # extends JwtAuthGuard, overrides handleRequest
│   └── roles.guard.ts          # CanActivate — checks @Roles() metadata vs req.user.roles
└── decorators/
    ├── public.decorator.ts      # @Public() — SetMetadata(IS_PUBLIC_KEY, true)
    ├── roles.decorator.ts       # @Roles(...roles) — SetMetadata(ROLES_KEY, roles)
    └── current-user.decorator.ts   # (discretionary — defer to Phase 3 if not needed now)
```

The flat-vs-subdirectory decision is Claude's discretion (CONTEXT.md). The subdirectory layout above is recommended because it groups by responsibility (strategies, guards, decorators) and keeps files under 500 lines as required by CLAUDE.md.

### Pattern 1: JwtStrategy with jwks-rsa

**What:** `PassportStrategy(Strategy)` configured with `secretOrKeyProvider` from `jwks-rsa`. The JWKS endpoint is called at most once per TTL window (600s default); subsequent requests use the cached key.

**When to use:** Any NestJS service using Auth0 RS256 tokens.

```typescript
// Source: https://github.com/auth0/node-jwks-rsa/blob/master/examples/passport-demo/README.md
// + https://github.com/nestjs/docs.nestjs.com/blob/master/content/recipes/passport.md
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: config.get<string>('AUTH0_JWKS_URI')!,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.get<string>('AUTH0_AUDIENCE'),
      issuer: config.get<string>('AUTH0_ISSUER'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, unknown>): { sub: string; roles: string[] } {
    const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
    return {
      sub: payload['sub'] as string,
      roles: (payload[namespace] as string[]) ?? [],
    };
  }
}
```

### Pattern 2: JwtAuthGuard with @Public() bypass

**What:** Extends `AuthGuard('jwt')`. Before delegating to Passport, checks the `IS_PUBLIC_KEY` metadata on the handler and its class. If set, returns `true` immediately without touching the token.

**When to use:** Global guard registered as `APP_GUARD`. All routes are protected by default.

```typescript
// Source: https://github.com/nestjs/docs.nestjs.com/blob/master/content/recipes/passport.md
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }
}
```

### Pattern 3: OptionalJwtAuthGuard

**What:** Extends `JwtAuthGuard` and overrides `handleRequest`. When no token is present, Passport calls `handleRequest(null, false, ...)`. The override returns `undefined` instead of throwing `UnauthorizedException`. If a token IS present but invalid, the error is truthy and the exception is re-thrown (→ 401).

**When to use:** Routes where authentication is optional but improves the response (e.g., personalised public listings).

```typescript
// Source: [CITED: docs.nestjs.com/recipes/passport] + [ASSUMED] handleRequest signature
import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthenticationError } from 'passport';
import { JwtAuthGuard } from './jwt-auth.guard';

@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  // err   — set when passport encountered a processing error
  // user  — false when token absent or invalid
  // info  — JsonWebTokenError, TokenExpiredError, or NoAuthTokenError string
  handleRequest<T>(err: Error | null, user: T | false, info: Error | null): T | undefined {
    if (err) throw err;                 // processing error — propagate
    if (!user && info) throw info;      // token present but invalid — 401
    return user || undefined;           // token absent — pass through
  }
}
```

**Critical detail:** The distinction between "token absent" and "token present but invalid" lives in the `info` parameter. When no `Authorization` header is present, Passport-jwt sets `user=false` and `info` to a string (`'No auth token'`). When the token is present but expired/bad-sig, `info` is a `JsonWebTokenError` or `TokenExpiredError` object. The override above re-throws when `info` is truthy AND `user` is false — covering the D-08 requirement. [ASSUMED — based on passport-jwt 4.x behavior, not verified via direct source inspection]

### Pattern 4: RolesGuard

**What:** `CanActivate` guard that reads `@Roles()` metadata and checks `req.user.roles`. Must also check `IS_PUBLIC_KEY` so it short-circuits on public routes (otherwise it would run after `JwtAuthGuard` passes, find no user, and throw 403).

**When to use:** Registered as `APP_GUARD` after `JwtAuthGuard`.

```typescript
// Source: https://context7.com/nestjs/docs.nestjs.com/llms.txt
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const required = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest();
    return required.every(role => user?.roles?.includes(role));
  }
}
```

### Pattern 5: AuthModule registration

**What:** `AuthModule` registers `JwtStrategy` as a provider (Passport auto-discovers it) and both guards as `APP_GUARD`. `PassportModule` must be imported for `AuthGuard` to work.

```typescript
// Source: https://github.com/nestjs/docs.nestjs.com/blob/master/content/recipes/passport.md
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PassportModule } from '@nestjs/passport';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from './guards/optional-jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';

@Module({
  imports: [PassportModule],
  providers: [
    JwtStrategy,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
```

**Note on `@nestjs/jwt`:** `JwtModule` is NOT required for validation-only use cases (no signing). The codebase does not sign tokens — Auth0 does. However, `@nestjs/jwt` should still be installed as it is a peer dependency expectation of `@nestjs/passport` in some NestJS 11 configurations. [ASSUMED — peer dep relationship; install to avoid runtime surprises]

### Pattern 6: @Public() decorator

```typescript
// Source: https://github.com/nestjs/docs.nestjs.com/blob/master/content/security/authentication.md
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### Pattern 7: @Roles() decorator

```typescript
// Source: https://context7.com/nestjs/docs.nestjs.com/llms.txt (adapted)
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

### Pattern 8: env.validation.ts extension

```typescript
// Extend EnvironmentVariables with 4 Auth0 fields using the existing pattern
@IsString()
AUTH0_JWKS_URI!: string;

@IsString()
AUTH0_AUDIENCE!: string;

@IsString()
AUTH0_ISSUER!: string;

@IsString()
AUTH0_NAMESPACE!: string;
```

### Anti-Patterns to Avoid

- **Hardcoding the namespace string:** CONTEXT.md D-03 locks this to `ConfigService.get('AUTH0_NAMESPACE')`. Never put `'https://exkuala.cv/roles'` directly in `JwtStrategy`.
- **Using `ignoreExpiration: true`:** This disables token expiry validation entirely. Never set this.
- **Using `app.useGlobalGuards()` instead of `APP_GUARD`:** Guards registered via `app.useGlobalGuards()` cannot receive injected dependencies (they run outside the DI container). `APP_GUARD` is the correct approach for guards that need `ConfigService` or `Reflector`.
- **Registering `JwtModule` with a symmetric secret:** We use `secretOrKeyProvider` (asymmetric RS256). Mixing a symmetric `JwtModule.register({ secret: ... })` alongside this causes confusion and is unnecessary.
- **Omitting `PassportModule` import:** Without `PassportModule` in `AuthModule`'s imports, `AuthGuard` factory calls fail at runtime.
- **`RolesGuard` not checking `@Public()`:** If `RolesGuard` does not bypass on public routes, it runs after `JwtAuthGuard` passes on a public route, finds `req.user` undefined, and throws 403. Both guards must check `IS_PUBLIC_KEY`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWKS key fetching and caching | Custom HTTP + LRU cache | `jwks-rsa` `passportJwtSecret` | Handles key rotation, kid lookup, rate limiting, TTL, error modes |
| JWT signature verification | Manual `crypto.verify` | `passport-jwt` strategy | Handles algorithm negotiation, expiry, audience/issuer validation |
| RS256 public key provider | Custom key provider function | `passportJwtSecret({ cache: true })` | Cache, rate-limit, and key rotation handled by Auth0's own library |
| Token extraction from headers | Manual header parsing | `ExtractJwt.fromAuthHeaderAsBearerToken()` | Handles edge cases (case-insensitive header, malformed auth header) |
| Guard metadata reflection | Custom decorator + Map | `SetMetadata` + `Reflector.getAllAndOverride` | NestJS built-in; handles class vs handler precedence correctly |

**Key insight:** The jwks-rsa + passport-jwt combination handles the entire JWKS lifecycle including key rotation (new `kid` triggers a fresh fetch, evicting the old key from cache). A hand-rolled solution would need to replicate this or risk serving 401s after Auth0 rotates keys.

---

## Common Pitfalls

### Pitfall 1: `config.get()` called in `super()` before `this` is available

**What goes wrong:** `JwtStrategy` constructor calls `super({ jwksUri: this.config.get('AUTH0_JWKS_URI') })` — but `this.config` is not yet assigned when `super()` runs.

**Why it happens:** JavaScript class construction order: `super()` runs before the constructor body; `this.config = config` is implicit after `super()` returns.

**How to avoid:** Pass the `config` values to `super()` by calling config on the parameter directly (e.g., `config.get('AUTH0_JWKS_URI')`) — not via `this.config.get()`. The injected `config` parameter is available as a closure variable before `super()` runs.

```typescript
constructor(private readonly config: ConfigService) {
  super({
    secretOrKeyProvider: passportJwtSecret({
      jwksUri: config.get<string>('AUTH0_JWKS_URI')!, // config parameter, not this.config
    }),
    ...
  });
}
```

**Warning signs:** `TypeError: Cannot read properties of undefined (reading 'get')` at application startup.

### Pitfall 2: `APP_GUARD` order matters

**What goes wrong:** `RolesGuard` registered before `JwtAuthGuard`. It runs first, finds `req.user` undefined, returns false for any route with `@Roles()`.

**Why it happens:** NestJS applies `APP_GUARD` providers in registration order. The first `provide: APP_GUARD` entry runs first.

**How to avoid:** Always register `JwtAuthGuard` before `RolesGuard` in the `providers` array.

**Warning signs:** `@Roles('admin')` routes return 403 even with a valid admin token.

### Pitfall 3: `@Public()` not short-circuiting `RolesGuard`

**What goes wrong:** `RolesGuard.canActivate()` does not check `IS_PUBLIC_KEY`. When a public route has no `@Roles()`, it passes (because `required` is empty). But if someone adds `@Roles()` to a public route in the future, it breaks.

**Why it happens:** Forgetting that both guards must independently check `@Public()`.

**How to avoid:** Both `JwtAuthGuard.canActivate()` and `RolesGuard.canActivate()` must call `reflector.getAllAndOverride(IS_PUBLIC_KEY, ...)` first and return `true` early if set.

**Warning signs:** Tests pass for a specific route combination but break when decorators are combined.

### Pitfall 4: OptionalJwtAuthGuard re-throwing on absent token

**What goes wrong:** `handleRequest` re-throws the `info` object unconditionally when `user === false`. When no token is present, `info` is the string `'No auth token'` — truthy — causing a 401 on unauthenticated requests to optional routes.

**Why it happens:** The `info` parameter is set in both the "no token" and "bad token" cases. The difference is type: string vs Error object.

**How to avoid:** Only re-throw when `info` is an instance of `Error` (or when both `err` and `info` are present). The recommended pattern checks `!user && info` — but `info` should be narrowed to `info instanceof Error` if using strict TypeScript.

**Warning signs:** GET request with no `Authorization` header to an optional-auth route returns 401 instead of 200.

### Pitfall 5: jwks-rsa `rateLimit` default is false

**What goes wrong:** `passportJwtSecret({ cache: true })` without `rateLimit: true` leaves rate limiting disabled. Under heavy traffic or key-rotation events, the JWKS endpoint can be hammered.

**Why it happens:** `jwks-rsa` defaults: `cache: true`, `cacheMaxAge: 600000`, but `rateLimit: false`. [VERIFIED: Context7/auth0/node-jwks-rsa docs]

**How to avoid:** Always include `rateLimit: true, jwksRequestsPerMinute: 10` in the `passportJwtSecret` call. Decision D-09 already specifies "default rate limit" — which means enabling it explicitly.

**Warning signs:** Auth0 JWKS endpoint logs showing unusual request volume.

### Pitfall 6: Forgetting `PassportModule` in `AuthModule` imports

**What goes wrong:** `AuthGuard('jwt')` factory fails at runtime with `Error: Unknown authentication strategy "jwt"`.

**Why it happens:** `@nestjs/passport` registers the Passport strategy registry via `PassportModule`. Without importing it, strategies are not wired up.

**How to avoid:** Always import `PassportModule` in `AuthModule`.

**Warning signs:** Application starts, but first authenticated request throws `Unknown authentication strategy "jwt"`.

---

## Code Examples

### Full JwtStrategy (production pattern)

```typescript
// Source: [CITED: https://github.com/auth0/node-jwks-rsa/blob/master/examples/passport-demo/README.md]
// + [CITED: https://github.com/nestjs/docs.nestjs.com/blob/master/content/recipes/passport.md]
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

interface JwtPayload {
  sub: string;
  [key: string]: unknown;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private readonly config: ConfigService) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: config.get<string>('AUTH0_JWKS_URI')!,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: config.get<string>('AUTH0_AUDIENCE'),
      issuer: config.get<string>('AUTH0_ISSUER'),
      algorithms: ['RS256'],
    });
  }

  validate(payload: JwtPayload): { sub: string; roles: string[] } {
    const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
    return {
      sub: payload.sub,
      roles: (payload[namespace] as string[]) ?? [],
    };
  }
}
```

### Test: guard integration pattern (no real JWKS call)

```typescript
// Source: [ASSUMED] — NestJS Testing module pattern based on established codebase conventions
import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

// Use a real JWT signed with a known RS256 key pair for integration tests.
// For unit tests, mock AuthGuard('jwt') and test IS_PUBLIC_KEY bypass logic in isolation.

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JwtAuthGuard, Reflector],
    }).compile();

    guard = module.get(JwtAuthGuard);
    reflector = module.get(Reflector);
  });

  it('returns true when route is @Public()', () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);
    const ctx = mockExecutionContext();
    expect(guard.canActivate(ctx)).toBe(true);
  });
});

function mockExecutionContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Symmetric HS256 secret in `JwtModule.register({ secret })` | RS256 with JWKS via `secretOrKeyProvider` | When Auth0 became the identity provider | No shared secret in code; key rotation is automatic |
| `app.useGlobalGuards()` | `APP_GUARD` provider in module | NestJS v7+ | Guards can receive injected dependencies via DI |
| `@UseGuards()` on every controller | `APP_GUARD` (fail-closed default) | Current best practice | Opt-out model — safer; no unprotected routes by accident |

**Deprecated/outdated:**
- `AuthGuard` with `session: true` — this API is sessionless (REST); always use `{ session: false }` behavior (default in passport-jwt).
- `JwtModule.register()` with a secret — only needed if this service signs tokens. Auth0 signs; this API only verifies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `handleRequest` distinguishes "no token" from "bad token" via `info` being a string vs Error instance | Pattern 3 / Pitfall 4 | `OptionalJwtAuthGuard` re-throws on absent token → all optional routes return 401. Mitigate: write a test covering absent-token case. |
| A2 | `@nestjs/jwt` should be installed even without `JwtModule` in module imports | Standard Stack / Pattern 5 | If it is truly not needed as a peer dep in NestJS 11, installation is harmless. Risk is low. |
| A3 | `RolesGuard` must independently check `IS_PUBLIC_KEY` because `req.user` may be undefined after `JwtAuthGuard` passes on a public route | Pattern 4 / Pitfall 3 | `RolesGuard` throws 403 on public routes that also have no `@Roles()` — passes in practice, but is fragile. Write a test for `@Public()` + `@Roles()` combined. |

---

## Open Questions

1. **`OptionalJwtAuthGuard` info-vs-error detection**
   - What we know: passport-jwt sets `info` to a string when no token is present and to an Error when token is invalid.
   - What's unclear: Whether this behavior is consistent across passport-jwt 4.x and whether `handleRequest` receives a string or an Error-like object for the absent-token case.
   - Recommendation: Write an integration test with a real RS256 key pair (generated locally with `node:crypto`) that covers three cases: no token, valid token, invalid token. This removes the assumption.

2. **`@nestjs/jwt` peer dependency requirement**
   - What we know: Auth0 does the signing; this API only verifies. `JwtModule` is not used in the planned `AuthModule`.
   - What's unclear: Whether `@nestjs/passport` 11.x has a hard peer dep on `@nestjs/jwt` at runtime.
   - Recommendation: Install it as listed in the standard stack. If it causes no issues, discard the question. If `pnpm` peer dep warnings appear, investigate.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | v24.15.0 | — |
| pnpm | Package manager | ✓ | (via npm 11.12.1) | npm |
| Auth0 JWKS endpoint | JwtStrategy validation | Unverified | — | No fallback — test with real or mocked JWKS |
| `@nestjs/passport` | AuthModule | ✗ (not installed) | — | Install required |
| `passport-jwt` | JwtStrategy | ✗ (not installed) | — | Install required |
| `jwks-rsa` | passportJwtSecret | ✗ (not installed) | — | Install required |
| `passport` | peer dep | ✗ (not installed) | — | Install required |

**Missing dependencies with no fallback:**
- All four auth packages must be installed before any implementation can run.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.x (ts-jest 29.x) |
| Config file | `package.json` (jest key) — `rootDir: src`, `testRegex: .*\\.spec\\.ts$` |
| Quick run command | `npm test -- --testPathPattern=auth --passWithNoTests` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | Valid JWT reaches protected route; no JWT → 401 | unit (guard) | `npm test -- --testPathPattern=jwt-auth.guard` | ❌ Wave 0 |
| AUTH-01 | JWKS cache: endpoint not called on every request | unit (strategy) | `npm test -- --testPathPattern=jwt.strategy` | ❌ Wave 0 |
| AUTH-02 | `@Roles('admin')` → 403 for `user` token, 200 for `admin` token | unit (guard) | `npm test -- --testPathPattern=roles.guard` | ❌ Wave 0 |
| AUTH-04 | `@Public()` route → 200 without Authorization header | unit (guard) | `npm test -- --testPathPattern=jwt-auth.guard` | ❌ Wave 0 |
| AUTH-04 | `@Public()` route → 200 without Authorization header (RolesGuard side) | unit (guard) | `npm test -- --testPathPattern=roles.guard` | ❌ Wave 0 |
| D-11 | Four Auth0 env vars required at boot | unit (validation) | `npm test -- --testPathPattern=env.validation` | ✅ (extends existing) |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPattern=auth --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/auth/guards/jwt-auth.guard.spec.ts` — covers AUTH-01 (absent token → 401), AUTH-04 (@Public bypass)
- [ ] `src/auth/guards/roles.guard.spec.ts` — covers AUTH-02 (role match/mismatch → 200/403), AUTH-04 (@Public bypass in RolesGuard)
- [ ] `src/auth/strategies/jwt.strategy.spec.ts` — covers AUTH-01 (validate() returns `{ sub, roles }`), namespace extraction from payload
- [ ] `src/auth/guards/optional-jwt-auth.guard.spec.ts` — covers D-07 (absent token passes), D-08 (invalid token → 401)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth0 (upstream), JWT validation via jwks-rsa + passport-jwt |
| V3 Session Management | no | Sessionless REST API; JWTs are stateless |
| V4 Access Control | yes | `RolesGuard` + `@Roles()` decorator; fail-closed via `APP_GUARD` |
| V5 Input Validation | yes | Token fields validated by passport-jwt (audience, issuer, expiry, algorithm); env vars validated by `class-validator` at boot |
| V6 Cryptography | yes | RS256 (asymmetric) via JWKS — never hand-roll; key material stays in Auth0 |

### Known Threat Patterns for NestJS + Auth0 + RS256

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token replay (stolen valid JWT) | Spoofing | Short token TTL configured in Auth0; this phase does not add refresh tokens |
| Algorithm confusion (alg:none or HS256) | Tampering | `algorithms: ['RS256']` locked in `passportJwtSecret` options — passport-jwt rejects other algorithms |
| JWKS endpoint SSRF | Elevation of privilege | `AUTH0_JWKS_URI` is an env var validated at boot; it must be the Auth0 JWKS URL, not user-supplied |
| Missing authorization header accepted | Spoofing | `JwtAuthGuard` throws 401 when no token present (unless `@Public()`); fail-closed by `APP_GUARD` |
| Namespace claim spoofing | Tampering | Namespace is a URL (`https://exkuala.cv/roles`) — Auth0 custom claims at non-reserved namespaces are trusted because Auth0 controls what goes into the token |
| Insufficient role check | Elevation of privilege | `RolesGuard` uses `includes()` on server-extracted claims; client cannot modify JWT payload (RS256 signature) |

---

## Sources

### Primary (HIGH confidence)

- `/nestjs/docs.nestjs.com` (Context7) — `APP_GUARD` pattern, `IS_PUBLIC_KEY` + `Reflector.getAllAndOverride`, `JwtAuthGuard` extending `AuthGuard('jwt')`, `RolesGuard`, `PassportModule` import requirement, `JwtModule` configuration pattern
- `/auth0/node-jwks-rsa` (Context7) — `passportJwtSecret` options (`cache`, `rateLimit`, `jwksRequestsPerMinute`, `cacheMaxAge` defaults), `JwksClient` configuration, Passport-JWT integration example
- npm registry (2026-04-28) — verified versions: `@nestjs/passport@11.0.5`, `@nestjs/jwt@11.0.2`, `passport@0.7.0`, `passport-jwt@4.0.1`, `jwks-rsa@4.0.1`, `@types/passport-jwt@4.0.1`, `@types/passport@1.0.17`
- Project codebase (direct read) — `src/app.module.ts`, `src/config/env.validation.ts`, `src/main.ts`, `package.json`, existing spec files

### Secondary (MEDIUM confidence)

- `/mikenicholson/passport-jwt` (Context7 library resolution) — confirmed as the correct passport-jwt library

### Tertiary (LOW confidence)

- `handleRequest` behavior for absent-token vs invalid-token (string info vs Error info) — [ASSUMED], needs integration test to confirm

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry on 2026-04-28
- Architecture: HIGH — guard chain pattern verified against NestJS official docs via Context7
- Pitfalls: HIGH/MEDIUM — most verified against docs; `handleRequest` behavior is ASSUMED
- Security: HIGH — threat patterns derived from standard RS256/JWKS model

**Research date:** 2026-04-28
**Valid until:** 2026-05-28 (stable libraries; NestJS 11.x cadence is slow)
