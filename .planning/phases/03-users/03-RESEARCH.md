# Phase 3: Users - Research

**Researched:** 2026-05-03
**Domain:** NestJS PassportStrategy injection, TypeORM findOrCreate, Express module augmentation, Jest async mocking
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `req.user` is a **flat merge** of `UserEntity` fields + `roles` from JWT. Shape: `{ id: string, auth0Id: string, createdAt: Date, updatedAt: Date, roles: string[] }`. `roles` is a transient JWT-derived field, not a DB column.
- **D-02:** `AuthenticatedUser` interface exported from `src/types/auth.ts` as the single source of truth. `src/types/express.d.ts` imports it and augments `Express.Request.user`.
- **D-03:** On DB failure: `JwtStrategy.validate()` throws `UnauthorizedException`. Passport treats this as a 401.
- **D-04:** Add `findOrCreate(sub: string): Promise<UserEntity>` to `UsersService`. Does NOT modify `upsertFromAuth0()`. Implementation: `findOne({ where: { auth0Id: sub } })` → if null, call `upsertFromAuth0(sub)` → `findOneOrFail({ where: { auth0Id: sub } })`.
- **D-05:** `AuthModule` adds `UsersModule` to its `imports[]`. No duplicate provider registration.
- **D-06:** `jwt.strategy.spec.ts` updated in Phase 3: mock `UsersService.findOrCreate()`, assert async `validate()` returns `AuthenticatedUser` shape, assert `UnauthorizedException` thrown when `findOrCreate` throws.
- **D-07:** `@CurrentUser()` param decorator at `src/auth/decorators/current-user.decorator.ts`. Returns `AuthenticatedUser` (non-optional).
- **D-08:** No `@OptionalCurrentUser()` decorator in Phase 3.

### Claude's Discretion
- Exact error logging in `findOrCreate()` (structured log before re-throw vs silent throw)
- Whether `src/types/` is a new directory or files go elsewhere (e.g., `src/auth/types/`)
- How to handle `findOneOrFail` vs manual null-check + throw in `findOrCreate()`

### Deferred Ideas (OUT OF SCOPE)
- `@OptionalCurrentUser()` decorator
- Storing roles in DB
- User profile endpoints (`GET /me`, `PATCH /me`)
- Email/name columns on `UserEntity`
</user_constraints>

---

## Summary

All six research questions resolve cleanly with no surprises. The implementation is straightforward: `AuthModule` importing `UsersModule` is safe because `UsersModule` only imports `TypeOrmModule.forFeature` (no reference to `AuthModule` or its providers). Constructor injection of `UsersService` into `JwtStrategy` follows the standard NestJS multi-dependency pattern — `super()` only reads the constructor parameters directly, and `validate()` runs after construction so `this.usersService` is safe there.

TypeORM 0.3.28 `findOne` returns `Entity | null` and `findOneOrFail` throws `EntityNotFoundError` — both are correct for the `findOrCreate` pattern. The `handleRequest` implementation in `@nestjs/passport` 11.0.5 throws `UnauthorizedException` when `validate()` returns `null` OR when it throws, making D-03 (throw on failure) the correct and consistent approach.

The `Express.User` interface extension works via `declare global { namespace Express { interface User extends AuthenticatedUser {} } }` in a `.d.ts` file anywhere TypeScript can see it. No `tsconfig.json` changes are required — the project's `tsconfig.json` has no `typeRoots` override and no `paths` mapping, so any file under `src/` picked up by the compiler works. The `src/types/` directory is new (does not exist yet).

**Primary recommendation:** Implement in declaration order — `src/types/auth.ts` → `src/types/express.d.ts` → `UsersService.findOrCreate()` → `JwtStrategy` (async, inject `UsersService`) → `AuthModule` import → `@CurrentUser()` decorator → spec update. Each step has no blocking dependencies on the next.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| JWT validation and decoding | API / Backend (`JwtStrategy`) | — | Passport wires into NestJS request pipeline; runs server-side per request |
| DB-backed user lookup/creation | API / Backend (`UsersService`) | Database (TypeORM/PostgreSQL) | Business logic for findOrCreate belongs in the service layer |
| `req.user` shape / typed interface | API / Backend (`src/types/`) | — | TypeScript interface definition; consumed by guards and controllers |
| `@CurrentUser()` param decorator | API / Backend (NestJS decorator) | — | Extracts `req.user` from `ExecutionContext`; purely server-side |
| Module wiring (`AuthModule` ← `UsersModule`) | API / Backend (NestJS DI) | — | Module composition is a server-side DI concern |

---

## RQ-1: Circular Dependency Analysis — SAFE

**Verdict: No circular dependency.**

**Evidence from source code:**

`UsersModule` (`src/users/users.module.ts`) — **verified by read:**
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

`UsersModule` imports only `TypeOrmModule.forFeature([UserEntity])`. It does not import `AuthModule`, `JwtStrategy`, `PassportModule`, or any provider from `AuthModule`.

`AuthModule` (`src/auth/auth.module.ts`) — **verified by read:**
```typescript
@Module({
  imports: [PassportModule],
  providers: [JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard, ...],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
```

`AuthModule` currently imports only `PassportModule`. Adding `UsersModule` to `imports[]` creates a one-directional dependency: `AuthModule` → `UsersModule`. `UsersModule` has no reference to `AuthModule`. The dependency graph remains a DAG.

**Confidence: HIGH** — verified by reading both module files. [VERIFIED: source files]

---

## RQ-2: JwtStrategy Multi-Injection Pattern

**Verdict: Standard NestJS injection — safe to add `UsersService` as second constructor parameter.**

The Pitfall 1 comment in `jwt.strategy.ts` applies specifically to `super()` — you cannot use `this.config` inside `super()` because `this` is not yet bound. The rule does NOT mean you cannot inject multiple dependencies.

The correct pattern is to receive each injected value as a constructor parameter and use the parameters directly in `super()`. Any dependency assigned to `this.*` is safe to use in `validate()` because `validate()` is called after construction completes.

**Exact constructor signature for the updated `JwtStrategy`:**

```typescript
// Source: verified from existing jwt.strategy.ts + NestJS DI conventions [VERIFIED: source]
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly config: ConfigService,
    private readonly usersService: UsersService,
  ) {
    // Use `config` parameter directly — this.config is unbound here (Pitfall 1)
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
    // this.usersService is NOT used here — only in validate()
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
    const roles = (payload[namespace] as string[]) ?? [];
    const user = await this.usersService.findOrCreate(payload.sub);
    return { ...user, roles };
  }
}
```

NestJS DI resolves `@Injectable()` providers by their TypeScript type at class registration time. Adding `UsersService` as a second constructor parameter works identically to the existing `ConfigService` — NestJS injects both automatically. No `@Inject()` token needed because `UsersService` is a class (not an interface or string token). [VERIFIED: source files, NestJS DI patterns]

**Confidence: HIGH**

---

## RQ-3: TypeORM findOrCreate Pattern

**TypeORM installed version: 0.3.28** [VERIFIED: node_modules/typeorm/package.json]

**Exact signatures verified from `node_modules/typeorm/repository/Repository.d.ts`:**

```typescript
// Returns entity or null — never throws
findOne(options: FindOneOptions<Entity>): Promise<Entity | null>;

// Returns entity or throws EntityNotFoundError if not found
findOneOrFail(options: FindOneOptions<Entity>): Promise<Entity>;
```

**`findOneOrFail` error type:** Throws `typeorm.EntityNotFoundError` (extends `TypeORMError`). This is NOT the same as a NestJS `NotFoundException`. [VERIFIED: node_modules/typeorm/error/EntityNotFoundError.js]

**Error handling decision for `findOrCreate()`:**

D-03 says `validate()` throws `UnauthorizedException` on any DB failure. The cleanest implementation:

```typescript
async findOrCreate(sub: string): Promise<UserEntity> {
  const existing = await this.userRepository.findOne({ where: { auth0Id: sub } });
  if (existing) return existing;
  // Happy path: webhook should have pre-created this user. Fallback for first-ever login.
  await this.upsertFromAuth0(sub);
  // findOneOrFail throws EntityNotFoundError if upsert somehow left no row — propagates up
  return this.userRepository.findOneOrFail({ where: { auth0Id: sub } });
}
```

`validate()` wraps the `findOrCreate()` call in a try/catch and converts any thrown error to `UnauthorizedException`:

```typescript
async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
  const namespace = this.config.get<string>('AUTH0_NAMESPACE')!;
  const roles = (payload[namespace] as string[]) ?? [];
  try {
    const user = await this.usersService.findOrCreate(payload.sub);
    return { ...user, roles };
  } catch {
    throw new UnauthorizedException();
  }
}
```

This isolates `UnauthorizedException` creation in `validate()` (the Passport boundary) and keeps `findOrCreate()` throwing natural TypeORM errors — consistent with the logging pattern in `upsertFromAuth0()`.

**Logging recommendation (Claude's Discretion):** `findOrCreate()` should log before re-throwing (same pattern as `upsertFromAuth0()`), because `validate()` catches and replaces the error with `UnauthorizedException` — the original error information would otherwise be lost:

```typescript
// In findOrCreate, before the throw bubbles:
this.logger.error({ event: 'find_or_create_failed', sub, error: (err as Error).message });
```

**Confidence: HIGH** [VERIFIED: TypeORM source, actual node_modules]

---

## RQ-4: Express Module Augmentation

**`@types/express` installed version: 5.0.6** [VERIFIED: node_modules/@types/express/package.json]
**`@types/passport` installed version: 1.0.17** [VERIFIED: node_modules/@types/passport/package.json]

**How `req.user` typing works (verified from source):**

`@types/passport` declares in the global `Express` namespace:
```typescript
declare global {
  namespace Express {
    interface User {}       // empty — intended for augmentation
    interface Request {
      user?: User | undefined;
    }
  }
}
```

The `Express.Request.user` is typed as `Express.User | undefined`. To type it as `AuthenticatedUser`, extend `Express.User`.

**Correct augmentation pattern for this project:**

```typescript
// src/types/express.d.ts
import { AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    // Merges AuthenticatedUser fields into Express.User, making req.user typed as AuthenticatedUser
    interface User extends AuthenticatedUser {}
  }
}
```

**tsconfig.json analysis — NO changes required:**

The project's `tsconfig.json` has no `typeRoots`, no `types` override, and no `paths` mapping. The compiler includes all `.ts` and `.d.ts` files under the project root by default. Any file placed under `src/` is automatically included.

Key note: `src/types/express.d.ts` is a **declaration file** (`.d.ts`). Declaration files with `import` statements are module augmentations, not global scripts — the `import { AuthenticatedUser } from './auth'` line makes it a module. The `declare global { namespace Express { ... } }` block is required to augment the global namespace from within a module context. [VERIFIED: verified from @types/passport source, tsconfig.json read]

**Directory:** `src/types/` does not yet exist. It must be created. Two files needed:
1. `src/types/auth.ts` — the `AuthenticatedUser` interface (a `.ts` file, not `.d.ts`, because it exports a named type that other files import)
2. `src/types/express.d.ts` — the module augmentation (a `.d.ts` file, side-effect only, no exports)

**Confidence: HIGH**

---

## RQ-5: Jest Mock Pattern for Async PassportStrategy validate()

**Current spec pattern (verified from source):**
- `jest.mock('jwks-rsa')` and `jest.mock('@nestjs/passport')` at top
- `PassportStrategy` mock returns a base class with empty constructor
- `new JwtStrategy(config)` instantiation directly

**Updated pattern adding `UsersService` mock:**

```typescript
// jwt.strategy.spec.ts

import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

jest.mock('jwks-rsa', () => ({
  passportJwtSecret: jest.fn(() => jest.fn()),
}));

jest.mock('@nestjs/passport', () => ({
  PassportStrategy: (_Strategy: unknown) => {
    return class {
      constructor() {}
    };
  },
}));

import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../../users/users.service';

// Mock UsersService — only findOrCreate is used by JwtStrategy
const mockUsersService = {
  findOrCreate: jest.fn(),
} as unknown as UsersService;

const mockConfig = (key: string): string => { /* ... existing ... */ };

describe('JwtStrategy', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validate()', () => {
    it('returns AuthenticatedUser on successful findOrCreate', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      const fakeUser = {
        id: 'cuid_abc',
        auth0Id: 'auth0|abc123',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      };
      (mockUsersService.findOrCreate as jest.Mock).mockResolvedValue(fakeUser);

      const payload = { sub: 'auth0|abc123', 'https://exkuala.cv/roles': ['admin'] };
      const result = await strategy.validate(payload);

      expect(result).toEqual({ ...fakeUser, roles: ['admin'] });
      expect(mockUsersService.findOrCreate).toHaveBeenCalledWith('auth0|abc123');
    });

    it('throws UnauthorizedException when findOrCreate rejects', async () => {
      const config = { get: mockConfig } as unknown as ConfigService;
      const strategy = new JwtStrategy(config, mockUsersService);
      (mockUsersService.findOrCreate as jest.Mock).mockRejectedValue(new Error('DB error'));

      const payload = { sub: 'auth0|abc123' };
      await expect(strategy.validate(payload)).rejects.toThrow(UnauthorizedException);
    });
  });
});
```

**Key points:**
- `new JwtStrategy(config, mockUsersService)` — the second argument is the mocked service. This works because the `@nestjs/passport` mock removes the Passport base class constructor, so NestJS DI is bypassed in tests.
- `mockUsersService.findOrCreate` is typed as `jest.fn()`. Use `(mockUsersService.findOrCreate as jest.Mock).mockResolvedValue(...)` for async mock setup.
- `jest.clearAllMocks()` in `beforeEach` prevents state leakage between tests when the same `mockUsersService` object is reused.
- The existing `validate()` tests (sync) become async — update them to `await strategy.validate(payload)`.

**Confidence: HIGH** [VERIFIED: existing spec file, Jest 30.x patterns]

---

## RQ-6: Passport null vs throw

**Verdict: Both null and throw produce 401. D-03 (throw `UnauthorizedException`) is correct and preferable.**

**Verified from `node_modules/@nestjs/passport/dist/auth.guard.js`:**

```javascript
handleRequest(err, user, info, context, status) {
    if (err || !user) {
        throw err || new common_1.UnauthorizedException();
    }
    return user;
}
```

`handleRequest` checks `!user` — if `validate()` returns `null`, `!user` is true and NestJS throws `UnauthorizedException` internally. If `validate()` throws, Passport catches it and passes as `err`, which is then re-thrown.

**Why D-03 (throw, not return null) is the right choice:**

1. Explicit intent — throwing `UnauthorizedException` makes the failure reason visible in the stack trace and logs. Returning `null` silently delegates error creation to `handleRequest` with no context.
2. Consistent with `upsertFromAuth0()` error handling pattern — the codebase already throws and logs on DB failures.
3. The alternative (`return null`) would produce the same HTTP 401 but with no structured log entry capturing which `sub` caused the failure.

**Confidence: HIGH** [VERIFIED: node_modules/@nestjs/passport/dist/auth.guard.js]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Request user extraction | Custom middleware to read `req.user` | `createParamDecorator` from `@nestjs/common` | NestJS param decorators integrate with the DI and execution context pipeline |
| Module augmentation for `req.user` | Casting `req.user as AuthenticatedUser` everywhere | `Express.User` interface extension in `.d.ts` | Single source of truth; TypeScript picks it up project-wide |
| JWT claim extraction | Manually parsing `Authorization` header | `ExtractJwt.fromAuthHeaderAsBearerToken()` (already in use) | Handles Bearer prefix, edge cases |

---

## Common Pitfalls

### Pitfall 1: Using `this.usersService` inside `super()` (already documented in codebase)
**What goes wrong:** TypeScript compiles `this` inside a base-class `super()` call but at runtime `this` is unbound — NestJS/V8 throws "must call super constructor" or silently uses `undefined`.
**Why it happens:** `super()` executes before `this` is initialized in the derived class.
**How to avoid:** Use the constructor parameter directly inside `super()` (e.g., `config.get(...)` not `this.config.get(...)`). `this.usersService` is only accessed in `validate()` — safe.
**Warning signs:** Runtime error "ReferenceError: Must call super constructor before accessing 'this'" or `undefined` method errors on first request.

### Pitfall 2: `src/types/express.d.ts` import makes it a module — requires `declare global`
**What goes wrong:** If `express.d.ts` has an `import` statement (for `AuthenticatedUser`), TypeScript treats it as a module, not an ambient script. Namespace declarations in module files must use `declare global {}`.
**Why it happens:** TypeScript distinguishes ambient scripts (no imports/exports) from modules (has import/export). Without `declare global`, the `Express` namespace is scoped to the module and does not extend the global `Express.User`.
**How to avoid:** Always wrap in `declare global { namespace Express { ... } }` when the `.d.ts` file has an import.
**Warning signs:** `req.user` is still typed as `Express.User` (empty interface) despite the augmentation file existing.

### Pitfall 3: `findOneOrFail` throws `EntityNotFoundError`, not `NotFoundException`
**What goes wrong:** If `validate()` does not catch errors, `EntityNotFoundError` bubbles up as a 500 (Internal Server Error), not a 401.
**Why it happens:** TypeORM throws its own error class; NestJS exception filter does not map it to 401.
**How to avoid:** Wrap `findOrCreate()` call in `validate()` with a try/catch and convert all errors to `UnauthorizedException` (D-03).
**Warning signs:** 500 responses on requests where the user row was deleted between upsert and re-fetch.

### Pitfall 4: Updating existing sync spec tests to async
**What goes wrong:** The three existing `validate()` tests call `strategy.validate(payload)` without `await`. After making `validate()` async, they return a `Promise` that Jest does not wait for — tests pass vacuously.
**Why it happens:** Jest does not fail a test that returns an unresolved promise unless the test function is `async` and uses `await` or returns the promise.
**How to avoid:** Update all existing `it(...)` callbacks to `async` and `await strategy.validate(payload)`.
**Warning signs:** Tests pass even when `validate()` implementation is broken.

### Pitfall 5: Registering `UsersService` as provider in `AuthModule` instead of importing `UsersModule`
**What goes wrong:** Adding `UsersService` directly to `AuthModule.providers[]` bypasses `UsersModule`'s `TypeOrmModule.forFeature([UserEntity])` import — `UsersService` receives an unresolved `userRepository` injection at runtime.
**Why it happens:** `TypeOrmModule.forFeature()` registers the `Repository<UserEntity>` provider scoped to the module. Importing just the service class does not pull in its module's repository registration.
**How to avoid:** Import the full `UsersModule` in `AuthModule.imports[]` (D-05). `UsersModule` already exports `UsersService` — this is the correct NestJS module composition pattern.
**Warning signs:** `Nest can't resolve dependencies of UsersService (?). Please make sure that the argument Repository<UserEntity> at index [0] is available in the AuthModule context.`

---

## Code Examples

### `src/types/auth.ts`
```typescript
// Source: D-01 shape, UserEntity verified from user.entity.ts [VERIFIED: source]
export interface AuthenticatedUser {
  id: string;
  auth0Id: string;
  createdAt: Date;
  updatedAt: Date;
  roles: string[];
}
```

### `src/types/express.d.ts`
```typescript
// Source: @types/passport global namespace pattern [VERIFIED: node_modules/@types/passport]
import { AuthenticatedUser } from './auth';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}
  }
}
```

### `src/auth/decorators/current-user.decorator.ts`
```typescript
// Source: NestJS createParamDecorator pattern, same structure as public.decorator.ts [VERIFIED: source]
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../types/auth';

// @CurrentUser() — extracts req.user typed as AuthenticatedUser.
// Only safe on routes protected by JwtAuthGuard; returns undefined on @Public() routes (programmer error).
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as AuthenticatedUser;
  },
);
```

### `AuthModule` with `UsersModule` import
```typescript
// Source: auth.module.ts verified [VERIFIED: source]
@Module({
  imports: [PassportModule, UsersModule],
  providers: [JwtStrategy, JwtAuthGuard, OptionalJwtAuthGuard, ...],
  exports: [JwtAuthGuard, OptionalJwtAuthGuard],
})
export class AuthModule {}
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x with ts-jest 29.x |
| Config file | `package.json` (`"jest"` key) |
| Quick run command | `pnpm test -- --testPathPattern=jwt.strategy` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| D-01 | `validate()` returns flat-merge `AuthenticatedUser` shape | unit | `pnpm test -- --testPathPattern=jwt.strategy` | ✅ (update existing) |
| D-03 | `validate()` throws `UnauthorizedException` on DB failure | unit | `pnpm test -- --testPathPattern=jwt.strategy` | ✅ (add new test) |
| D-04 | `findOrCreate()` returns existing user without calling upsert | unit | `pnpm test -- --testPathPattern=users.service` | ❌ Wave 0 |
| D-04 | `findOrCreate()` calls `upsertFromAuth0` then re-fetches when user absent | unit | `pnpm test -- --testPathPattern=users.service` | ❌ Wave 0 |

### Wave 0 Gaps
- [ ] `src/users/users.service.spec.ts` — covers `findOrCreate()` happy path and upsert fallback path (D-04)

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is purely code changes. All dependencies (NestJS, TypeORM, PostgreSQL, Auth0) were verified as available in prior phases. No new external services introduced.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Auth0 JWT (RS256/JWKS) — already in place; this phase attaches DB user to validated token |
| V3 Session Management | no | Stateless JWT; no session |
| V4 Access Control | yes | `JwtAuthGuard` + `RolesGuard` read `req.user.roles`; roles derive from JWT claim only (v1) |
| V5 Input Validation | yes | `sub` from JWT payload — already validated by `passport-jwt` signature check; `findOrCreate` treats it as an opaque string, no further sanitization needed |
| V6 Cryptography | no | No new crypto; JWKS verification already handled by `jwks-rsa` |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Forged `sub` in JWT | Spoofing | RS256 signature verification via JWKS (already in place; this phase does not weaken it) |
| DB error reveals user existence | Information Disclosure | `validate()` converts all DB errors to generic `UnauthorizedException` (D-03) — no user enumeration information leaks |
| `roles` from DB instead of JWT | Elevation of Privilege | D-23 (prior): roles come from JWT claim only in v1; `roles` field is NOT stored in `UserEntity` — cannot be tampered via DB |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| — | — | — | — |

**All claims in this research were verified from source files, installed node_modules, or official type definitions. No assumed claims.**

---

## Sources

### Primary (HIGH confidence)
- `src/auth/strategies/jwt.strategy.ts` — existing constructor pattern, Pitfall 1 comment [VERIFIED: source]
- `src/users/users.service.ts` — `upsertFromAuth0()` signature and logging pattern [VERIFIED: source]
- `src/users/users.module.ts` — imports array (only TypeOrmModule.forFeature) [VERIFIED: source]
- `src/auth/auth.module.ts` — current imports array [VERIFIED: source]
- `src/auth/strategies/jwt.strategy.spec.ts` — existing mock pattern [VERIFIED: source]
- `src/users/user.entity.ts` — `UserEntity` field shape [VERIFIED: source]
- `node_modules/typeorm/repository/Repository.d.ts` — `findOne`/`findOneOrFail` signatures [VERIFIED: node_modules]
- `node_modules/typeorm/error/EntityNotFoundError.js` — error class for `findOneOrFail` failure [VERIFIED: node_modules]
- `node_modules/@nestjs/passport/dist/auth.guard.js` — `handleRequest` null/throw behavior [VERIFIED: node_modules]
- `node_modules/@nestjs/passport/dist/options.js` — `property: 'user'` default [VERIFIED: node_modules]
- `node_modules/@types/passport/index.d.ts` — `Express.User` interface and `Request.user` declaration [VERIFIED: node_modules]
- `tsconfig.json` — no typeRoots/paths override [VERIFIED: source]
- `package.json` — TypeORM 0.3.28, @nestjs/passport 11.0.5, @types/express 5.0.6 [VERIFIED: source]

### Secondary (MEDIUM confidence)
- NestJS multi-dependency constructor injection pattern — consistent with NestJS DI documentation conventions [ASSUMED from training knowledge; confirmed indirectly by existing single-dep pattern in jwt.strategy.ts]

---

## Metadata

**Confidence breakdown:**
- Circular dependency analysis: HIGH — both module files read directly
- Constructor injection pattern: HIGH — verified from existing code + node_modules
- TypeORM signatures: HIGH — verified from installed node_modules type declarations
- Express augmentation: HIGH — verified from @types/passport and tsconfig
- Jest mock pattern: HIGH — verified from existing spec file structure
- Passport null vs throw: HIGH — verified from installed @nestjs/passport source

**Research date:** 2026-05-03
**Valid until:** 2026-06-03 (stable libraries — NestJS, TypeORM, @types/passport change slowly)
