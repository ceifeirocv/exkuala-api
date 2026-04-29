# Phase 2: Auth Infrastructure - Pattern Map

**Mapped:** 2026-04-28
**Files analyzed:** 9 (7 new, 2 modified)
**Analogs found:** 2 / 9 (codebase has no existing guards, strategies, or decorators — RESEARCH.md patterns are authoritative for new auth files)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/auth/auth.module.ts` | module | request-response | `src/app.module.ts` | role-match (module registration pattern) |
| `src/auth/strategies/jwt.strategy.ts` | middleware/strategy | request-response | none | no analog |
| `src/auth/guards/jwt-auth.guard.ts` | middleware/guard | request-response | none | no analog |
| `src/auth/guards/roles.guard.ts` | middleware/guard | request-response | none | no analog |
| `src/auth/guards/optional-jwt-auth.guard.ts` | middleware/guard | request-response | none | no analog |
| `src/auth/decorators/roles.decorator.ts` | utility/decorator | — | none | no analog |
| `src/auth/decorators/public.decorator.ts` | utility/decorator | — | none | no analog |
| `src/config/env.validation.ts` | config | — | self (modify) | exact |
| `src/app.module.ts` | config/module | — | self (modify) | exact |

---

## Pattern Assignments

### `src/auth/auth.module.ts` (module, request-response)

**Analog:** `src/app.module.ts`

**Imports pattern** (lines 1-8 of analog):
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
```

**Module registration pattern** (lines 10-35 of analog — `@Module` decorator with `imports[]` and `providers[]`):
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        // ...
      }),
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Apply to `auth.module.ts`:** Use same `@Module` structure. Replace TypeORM imports with `PassportModule`. Register `JwtStrategy`, `JwtAuthGuard`, `RolesGuard` in `providers[]`. Add `{ provide: APP_GUARD, useClass: JwtAuthGuard }` and `{ provide: APP_GUARD, useClass: RolesGuard }` as provider objects. Export `JwtAuthGuard` and `OptionalJwtAuthGuard`. `APP_GUARD` registration order matters: `JwtAuthGuard` must come before `RolesGuard`.

**Core pattern for `auth.module.ts`** (from RESEARCH.md Pattern 5):
```typescript
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

---

### `src/auth/strategies/jwt.strategy.ts` (strategy, request-response)

**Analog:** none in codebase — use RESEARCH.md Pattern 1 and Code Example "Full JwtStrategy".

**Imports pattern** (from RESEARCH.md):
```typescript
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
```

**Core pattern** (RESEARCH.md Pattern 1 / full example, lines 517-544):
```typescript
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
        jwksUri: config.get<string>('AUTH0_JWKS_URI')!, // config param, NOT this.config
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

**Critical pitfall:** `config.get()` in `super()` must use the constructor parameter (`config`), not `this.config` — `this` is not yet bound when `super()` runs. See RESEARCH.md Pitfall 1.

---

### `src/auth/guards/jwt-auth.guard.ts` (guard, request-response)

**Analog:** none in codebase — use RESEARCH.md Pattern 2.

**Imports pattern**:
```typescript
import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
```

**Core pattern** (RESEARCH.md Pattern 2):
```typescript
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

---

### `src/auth/guards/roles.guard.ts` (guard, request-response)

**Analog:** none in codebase — use RESEARCH.md Pattern 4.

**Imports pattern**:
```typescript
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import { ROLES_KEY } from '../decorators/roles.decorator';
```

**Core pattern** (RESEARCH.md Pattern 4):
```typescript
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

**Critical pitfall:** `RolesGuard` MUST check `IS_PUBLIC_KEY` first (same as `JwtAuthGuard`). If it skips this check, a `@Public()` + `@Roles()` combined route will 403. See RESEARCH.md Pitfall 3.

---

### `src/auth/guards/optional-jwt-auth.guard.ts` (guard, request-response)

**Analog:** none in codebase — use RESEARCH.md Pattern 3.

**Imports pattern**:
```typescript
import { Injectable } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
```

**Core pattern** (RESEARCH.md Pattern 3):
```typescript
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  // err   — processing error from passport
  // user  — false when token absent or invalid
  // info  — string 'No auth token' when absent; Error object (JsonWebTokenError/TokenExpiredError) when invalid
  handleRequest<T>(err: Error | null, user: T | false, info: Error | null): T | undefined {
    if (err) throw err;             // processing error — propagate
    if (!user && info) throw info;  // token present but invalid — 401 (D-08)
    return user || undefined;       // token absent — pass through (D-07)
  }
}
```

**Open question from RESEARCH.md (A1):** The `info` type when no token is present may be a string (`'No auth token'`) rather than an `Error` object. If TypeScript strict mode rejects `throw info` on a string, narrow to `info instanceof Error`. Cover with an integration test (absent token → 200, invalid token → 401).

---

### `src/auth/decorators/public.decorator.ts` (utility/decorator, —)

**Analog:** none in codebase — use RESEARCH.md Pattern 6.

**Full file pattern**:
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// @Public() — decorates a route handler or controller class to bypass JwtAuthGuard and RolesGuard
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

### `src/auth/decorators/roles.decorator.ts` (utility/decorator, —)

**Analog:** none in codebase — use RESEARCH.md Pattern 7.

**Full file pattern**:
```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// @Roles('admin', 'organizer') — requires ALL listed roles to be present in req.user.roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

---

### `src/config/env.validation.ts` (config, modify)

**Analog:** self — extend existing file at `/home/ceifeiro/Code/exkuala-api/src/config/env.validation.ts`

**Existing pattern** (lines 1-12 — imports and class):
```typescript
import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL!: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT!: number;
}
```

**Apply:** Add four `@IsString()` fields after `PORT` using the exact same decorator+field pattern as `DATABASE_URL`. No other changes to the file. `validate` function (lines 14-30) stays unchanged.

```typescript
// Fields to append inside EnvironmentVariables class, after PORT:
@IsString()
AUTH0_JWKS_URI!: string;

@IsString()
AUTH0_AUDIENCE!: string;

@IsString()
AUTH0_ISSUER!: string;

@IsString()
AUTH0_NAMESPACE!: string;
```

---

### `src/app.module.ts` (module, modify)

**Analog:** self — extend existing file at `/home/ceifeiro/Code/exkuala-api/src/app.module.ts`

**Existing imports pattern** (lines 1-8):
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { EventEntity } from './events/event.entity';
import { UserEntity } from './users/user.entity';
```

**Existing module structure** (lines 10-35):
```typescript
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: ... }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Apply:** Add `import { AuthModule } from './auth/auth.module';` to the import block. Add `AuthModule` to the `imports[]` array after `TypeOrmModule.forRootAsync(...)`. No other changes.

---

## Shared Patterns

### Dependency Injection via Constructor Parameter
**Source:** `src/app.module.ts` lines 17-29 (`inject: [ConfigService], useFactory: (cfg: ConfigService) => ...`)
**Apply to:** `src/auth/strategies/jwt.strategy.ts`

`ConfigService` is injected as a constructor parameter. In `JwtStrategy`, the constructor parameter is named `config` and passed directly to `super()` — not stored as `this.config` before `super()`. This avoids the "this not yet bound" pitfall.

```typescript
// From src/app.module.ts lines 17-19 — the forRootAsync injection pattern:
TypeOrmModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (cfg: ConfigService) => ({
    url: cfg.get<string>('DATABASE_URL'),
    // ...
  }),
}),
```

### class-validator `@IsString()` Field Pattern
**Source:** `src/config/env.validation.ts` lines 5-6
**Apply to:** `src/config/env.validation.ts` (the four new Auth0 fields)

```typescript
@IsString()
DATABASE_URL!: string;
```

Exact template: decorator on its own line, field with `!` non-null assertion on the next line. No `@IsNotEmpty()` or `@IsUrl()` — plain `@IsString()` only, matching existing fields.

### Jest Test Structure
**Source:** `src/users/user.entity.spec.ts` lines 1-36
**Apply to:** all four new `*.spec.ts` files under `src/auth/guards/` and `src/auth/strategies/`

```typescript
import { UserEntity } from './user.entity';

describe('UserEntity', () => {
  describe('generateId (BeforeInsert)', () => {
    it('should assign a cuid-format id when id is not set', () => {
      // arrange
      const user = new UserEntity();
      // act
      user.generateId();
      // assert
      expect(user.id).toBeDefined();
    });
  });
});
```

Pattern: top-level `describe` named after the class, nested `describe` per method/behavior, `it` with full-sentence description of what should happen. No `beforeAll`. Use `beforeEach` for module setup (as shown in RESEARCH.md test example at lines 562-570). Mock external dependencies with `jest.spyOn` — not inline stubs.

---

## No Analog Found

These files have no close match in the codebase. The planner must use RESEARCH.md patterns directly.

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/auth/strategies/jwt.strategy.ts` | strategy | request-response | No Passport strategies exist in the codebase |
| `src/auth/guards/jwt-auth.guard.ts` | guard | request-response | No NestJS guards exist in the codebase |
| `src/auth/guards/roles.guard.ts` | guard | request-response | No NestJS guards exist in the codebase |
| `src/auth/guards/optional-jwt-auth.guard.ts` | guard | request-response | No NestJS guards exist in the codebase |
| `src/auth/decorators/roles.decorator.ts` | decorator | — | No custom decorators exist in the codebase |
| `src/auth/decorators/public.decorator.ts` | decorator | — | No custom decorators exist in the codebase |

---

## Metadata

**Analog search scope:** `src/` (all subdirectories)
**Files scanned:** `src/app.module.ts`, `src/config/env.validation.ts`, `src/users/user.entity.ts`, `src/users/user.entity.spec.ts`, `src/events/event.entity.ts`
**Pattern extraction date:** 2026-04-28
