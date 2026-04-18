# Phase 1: Foundation - Research

**Researched:** 2026-04-18
**Domain:** NestJS 11 + Prisma 7 + ConfigModule + Swagger + ValidationPipe
**Confidence:** HIGH (all six focus areas verified against official docs and current sources)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Bootstrap with User + Event models only in Phase 1 migration. Organizer and Category models added in later phases.
- **D-02:** Event model: full schema — `id`, `title`, `description`, `startAt`, `endAt`, `location` (venue + address), `categoryId` (nullable FK), `ticketPrice`, `externalTicketUrl`, `status` (enum: DRAFT | PUBLISHED | CANCELLED), `organizerId` (nullable FK), `deletedAt` (soft delete — MUST be present from day one), `createdAt`, `updatedAt`.
- **D-03:** User model: minimal — `id`, `auth0Id` (unique), `createdAt`, `updatedAt` only.
- **D-04:** Use class-validator + class-transformer for ConfigModule env validation (via `validate` option).
- **D-05:** Phase 1 required vars: `DATABASE_URL`, `PORT` only. Missing required vars must crash the process.
- **D-06:** Bearer auth pre-armed — `addBearerAuth()` in Phase 1 `DocumentBuilder`.
- **D-07:** Swagger non-production only — guarded by `NODE_ENV !== 'production'`.
- **D-08:** ValidationPipe: `whitelist: true`, `transform: true`. `forbidNonWhitelisted` intentionally omitted.
- **D-09:** Default NestJS error shape — no custom ExceptionFilter.

### Claude's Discretion

- URI versioning global prefix and version string (`/api`, `v1`) — Claude decides implementation detail.
- `.env.example` file content and structure.
- Prisma client singleton pattern (module vs. direct injection).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

---

## Summary

Phase 1 establishes the production-quality base for all nine subsequent phases. The stack is NestJS 11 (TypeScript, CommonJS), Prisma 7 (driver-adapter architecture), `@nestjs/config` for validated env vars, `@nestjs/swagger` 11 for API documentation, and NestJS built-in `ValidationPipe`.

**Critical finding:** Prisma 7 (7.7.0, current npm latest) has a breaking architecture change compared to Prisma 5/6. It requires `@prisma/adapter-pg` for PostgreSQL, moves `DATABASE_URL` out of `schema.prisma` into a `prisma.config.ts` file, generates the client to a custom output path inside `src/`, and imports `PrismaClient` from that generated path rather than from `@prisma/client`. This is not an optional upgrade path — it is the only way to use Prisma 7. All Phase 1 patterns must account for this.

**Primary recommendation:** Install Prisma 7 with `@prisma/adapter-pg`, set generator output to `src/generated/prisma`, import `PrismaClient` from `src/generated/prisma/client`, configure `prisma.config.ts` for CLI, and use `OnModuleInit` + `OnModuleDestroy` (without the deprecated `beforeExit` shutdown hook).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Database schema and migrations | Database / Storage | — | Prisma schema-first; schema drives generated types |
| DB connection lifecycle | API / Backend | — | PrismaService is a NestJS provider; connection managed via DI lifecycle hooks |
| Env var validation | API / Backend | — | Runs at process boot before any request; `ConfigModule.forRoot({ validate })` |
| Request body validation | API / Backend | — | `ValidationPipe` globally registered; transforms + whitelists at the pipe layer |
| API versioning | API / Backend | — | NestJS `enableVersioning` + `setGlobalPrefix`; all routing is server-side |
| Swagger / API docs | API / Backend | — | `SwaggerModule` generates spec at startup from decorators; non-production only |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `prisma` | 7.7.0 | CLI, schema, migrations | Official Prisma devDependency; latest stable [VERIFIED: npm registry] |
| `@prisma/client` | 7.7.0 | Generated type-safe DB client | Peer of `prisma`; must match version [VERIFIED: npm registry] |
| `@prisma/adapter-pg` | 7.7.0 | PostgreSQL driver adapter (required in Prisma 7) | Replaces Rust engine; mandatory in v7 [VERIFIED: prisma.io docs] |
| `pg` | 8.20.0 | PostgreSQL Node.js driver (peer dep of adapter-pg) | Required by `@prisma/adapter-pg` [VERIFIED: npm registry] |
| `@nestjs/config` | 4.0.4 | ConfigModule, ConfigService, env loading | Official NestJS config package [VERIFIED: npm registry] |
| `class-validator` | 0.15.1 | Decorator-based validation for DTO and env classes | Single validation pattern across DTOs and env [VERIFIED: npm registry] |
| `class-transformer` | 0.5.1 | `plainToInstance` transform for validation | Required companion for `class-validator` with `enableImplicitConversion` [VERIFIED: npm registry] |
| `@nestjs/swagger` | 11.3.0 | OpenAPI spec generation and Swagger UI | Official NestJS package; version aligns with NestJS 11 [VERIFIED: npm registry] |

### Supporting (devDependencies)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `prisma` | 7.7.0 | CLI (`prisma migrate dev`, `prisma generate`) | devDependency; `@prisma/client` is runtime dep |
| `@types/pg` | latest | TypeScript types for pg | Needed when using `@prisma/adapter-pg` with pg directly |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@prisma/adapter-pg` | `@prisma/adapter-postgres` | `adapter-postgres` uses the `postgres` driver instead of `pg`; `adapter-pg` matches existing `pg` ecosystem familiarity |
| `class-validator` env validation | `zod` | Zod is type-first; but the project uses class-validator for DTOs — single pattern preferred (D-04) |
| `app.useGlobalPipes()` | `APP_PIPE` provider | `APP_PIPE` is DI-aware; `useGlobalPipes` is simpler for pipes with no injected deps — acceptable for Phase 1 |

**Installation:**
```bash
npm install @prisma/adapter-pg pg @nestjs/config class-validator class-transformer @nestjs/swagger
npm install -D @types/pg
```
(prisma + @prisma/client already listed above as existing dev/prod deps if pre-installed, or add both)

```bash
npm install prisma @prisma/client @prisma/adapter-pg pg @nestjs/config class-validator class-transformer @nestjs/swagger
npm install -D @types/pg
```

**Version verification:** All versions verified against npm registry on 2026-04-18. [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
startup
  │
  ├─► ConfigModule.forRoot({ validate })
  │        │
  │        └─► validate(process.env) ──► EnvironmentVariables class
  │                                           (class-validator validateSync)
  │                                           crash if invalid ──► process.exit
  │
  ├─► PrismaModule (global)
  │        │
  │        └─► PrismaService.onModuleInit()
  │                 │
  │                 └─► PrismaPg adapter ──► pg pool ──► PostgreSQL
  │
HTTP request
  │
  ├─► GlobalPrefix (/api)
  ├─► VersioningType.URI (v1)
  │        │
  │        └─► /api/v1/...
  │
  ├─► ValidationPipe (whitelist, transform)
  │        │
  │        └─► DTO validation ──► 400 Bad Request (default shape)
  │
  └─► Controller ──► Service ──► PrismaService ──► DB

/api/docs (non-production)
  │
  └─► SwaggerModule ──► DocumentBuilder (bearerAuth pre-armed)
```

### Recommended Project Structure
```
src/
├── prisma/
│   ├── prisma.module.ts     # Exports PrismaService globally
│   └── prisma.service.ts    # Extends PrismaClient, OnModuleInit/OnModuleDestroy
├── config/
│   └── env.validation.ts    # EnvironmentVariables class + validate() function
├── generated/
│   └── prisma/              # Prisma 7 generated client (output in schema.prisma)
│       └── client.ts        # Generated — do not edit
├── app.module.ts
└── main.ts
prisma/
├── schema.prisma
└── migrations/
prisma.config.ts             # Prisma 7 CLI config (datasource URL, schema path)
```

**Important:** The `src/generated/prisma/` folder is git-ignored (generated artifact). It must be regenerated via `prisma generate` after `npm install`.

### Pattern 1: Prisma 7 Schema Configuration

**What:** Prisma 7 separates the datasource URL from `schema.prisma` into `prisma.config.ts`. The generator must use `provider = "prisma-client"` (not `"prisma-client-js"`) and specify a custom `output` path inside `src/`.

**When to use:** Always — this is the only supported configuration in Prisma 7.

```prisma
// prisma/schema.prisma
// Source: [VERIFIED: prisma.io/docs/guides/upgrade-prisma-orm/v7]

generator client {
  provider = "prisma-client"
  output   = "../src/generated/prisma"
}

datasource db {
  provider = "postgresql"
  // NOTE: url is NOT defined here in Prisma 7 — it lives in prisma.config.ts
}
```

```typescript
// prisma.config.ts (project root)
// Source: [VERIFIED: mgregersen.dk/upgrading-prisma-to-rust-free-client-in-nestjs/]
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

### Pattern 2: PrismaService (Prisma 7 + NestJS 11)

**What:** PrismaService extends PrismaClient (imported from the generated path), uses `PrismaPg` adapter for the connection, and implements `OnModuleInit` + `OnModuleDestroy` for lifecycle management.

**Critical change from Prisma 4/5/6:** The `enableShutdownHooks(app)` method and `this.$on('beforeExit')` are removed. Use `app.enableShutdownHooks()` in `main.ts` instead. [VERIFIED: prisma.io docs/upgrade-to-prisma-5]

```typescript
// src/prisma/prisma.service.ts
// Source: [VERIFIED: mgregersen.dk, dev.to Prisma 7 guides]
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

```typescript
// src/prisma/prisma.module.ts
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Note on `@Global()`:** Marking PrismaModule as global means other modules don't need to import it explicitly — they can inject `PrismaService` directly. This is the standard pattern for database modules. [ASSUMED — convenience pattern, not a strict requirement]

### Pattern 3: Prisma Schema Baseline (User + Event)

```prisma
// prisma/schema.prisma (models section)
// Source: CONTEXT.md D-01, D-02, D-03

enum EventStatus {
  DRAFT
  PUBLISHED
  CANCELLED
}

model User {
  id        String   @id @default(cuid())
  auth0Id   String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

model Event {
  id                String      @id @default(cuid())
  title             String
  description       String?
  startAt           DateTime
  endAt             DateTime?
  venueName         String?
  address           String?
  categoryId        String?     // Nullable FK placeholder — Category added Phase 4
  ticketPrice       Decimal?    @db.Decimal(10, 2)
  externalTicketUrl String?
  status            EventStatus @default(DRAFT)
  organizerId       String?     // Nullable FK placeholder — Organizer added Phase 5
  deletedAt         DateTime?   // Soft delete — MUST be present from day one (STATE.md)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@map("events")
}
```

### Pattern 4: ConfigModule with class-validator Validation

**What:** `ConfigModule.forRoot({ validate })` accepts a validate function. Use `plainToInstance` + `validateSync` from class-validator/class-transformer to validate env vars at startup.

```typescript
// src/config/env.validation.ts
// Source: [VERIFIED: github.com/nestjs/docs.nestjs.com configuration.md]
import { plainToInstance } from 'class-transformer';
import { IsNumber, IsString, Max, Min, validateSync } from 'class-validator';

export class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsNumber()
  @Min(1)
  @Max(65535)
  PORT: number;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true }, // converts "3000" string to number
  );
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
```

```typescript
// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validate } from './config/env.validation.js';
import { PrismaModule } from './prisma/prisma.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    PrismaModule,
  ],
})
export class AppModule {}
```

**Typed ConfigService injection** (for use in future phases):
```typescript
// Usage in any service
import { ConfigService } from '@nestjs/config';
import { EnvironmentVariables } from './config/env.validation.js';

constructor(private config: ConfigService<EnvironmentVariables>) {
  const port = this.config.get('PORT', { infer: true }); // typed as number
}
```

### Pattern 5: URI Versioning + Global Prefix (main.ts)

**What:** `app.setGlobalPrefix('api')` + `app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })` produces `/api/v1/` for all routes. The version prefix `v` is added automatically.

```typescript
// src/main.ts
// Source: [VERIFIED: github.com/nestjs/docs.nestjs.com versioning.md]
import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix — applied before version segment
  app.setGlobalPrefix('api');

  // URI versioning — produces /api/v1/... for all routes
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // Prisma 7: no prismaService.enableShutdownHooks(app) — use NestJS native
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Resulting URL pattern:**
- `GET /api/v1/` — versioned global prefix active
- Routes with no explicit `@Version()` use `defaultVersion: '1'`
- Use `VERSION_NEUTRAL` on routes that should not be versioned (e.g., health check)

### Pattern 6: ValidationPipe Global Registration

**What:** Register at bootstrap with `app.useGlobalPipes`. `whitelist: true` strips unknown properties silently; `transform: true` converts plain objects to DTO class instances.

```typescript
// src/main.ts
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,       // strip unknown props (D-08)
    transform: true,       // transform to DTO instance (D-08)
    // forbidNonWhitelisted intentionally NOT set (D-08)
  }),
);
```

**`useGlobalPipes` vs `APP_PIPE`:** For a `ValidationPipe` with no injected dependencies, `useGlobalPipes` is the simpler and standard approach. `APP_PIPE` (module-level provider) is preferred only when the pipe needs DI. Since this pipe has no dependencies, `useGlobalPipes` is correct here. [VERIFIED: NestJS docs, community consensus]

### Pattern 7: Swagger Setup (non-production)

**What:** `DocumentBuilder` configures the OpenAPI spec; `addBearerAuth()` is pre-armed for Phase 2 JWT routes; `SwaggerModule.setup()` serves the UI at `/api/docs`.

```typescript
// src/main.ts
// Source: [VERIFIED: tessl.io/registry/npm-nestjs--swagger/11.2.0/docs/document-builder.md]
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

if (process.env.NODE_ENV !== 'production') {
  const config = new DocumentBuilder()
    .setTitle('Cultural Agenda API')
    .setDescription('Cultural events discovery platform')
    .setVersion('1.0')
    .addBearerAuth()     // Pre-armed for Phase 2 JWT (D-06)
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);
}
```

**`addBearerAuth()` default behavior:** Calling it with no arguments adds an HTTP Bearer scheme with the name `'bearer'`. The `@ApiBearerAuth()` decorator on controllers in Phase 2 references this name. [VERIFIED: nestjs/swagger DocumentBuilder source]

**`SwaggerModule.setup` path:** The first argument is the UI path. Using `'api/docs'` (without leading slash) is the documented convention. This produces the UI at `/api/docs`.

### Anti-Patterns to Avoid

- **Importing PrismaClient from `@prisma/client`:** In Prisma 7, the legacy package no longer ships generated types. Import from `../generated/prisma/client.js` (the output path defined in schema.prisma). Mixing import sources causes runtime type mismatches.
- **Using `this.$on('beforeExit')`:** Removed in Prisma 5+. Use `app.enableShutdownHooks()` in `main.ts`.
- **Defining `url` in `schema.prisma` datasource block:** Prisma 7 moves the URL to `prisma.config.ts`. Leaving it in `schema.prisma` breaks the CLI.
- **Putting generated client output outside `src/`:** NestJS build cannot locate files outside `src/` during compilation. The `output` path in `generator` must be inside `src/`.
- **Calling `SwaggerModule.setup()` unconditionally:** Exposes the full API contract in production. Always guard with `NODE_ENV !== 'production'` (D-07).
- **`forbidNonWhitelisted: true` in Phase 1:** Explicitly excluded per D-08. Do not add it.
- **`prisma migrate deploy` in development:** Use `prisma migrate dev` for development (creates migration files + applies them). `migrate deploy` is for CI/production only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Env var validation at startup | Custom process.env parsing | `ConfigModule.forRoot({ validate })` + class-validator | Integrates with DI; same decorator pattern as DTOs; crashes cleanly |
| Request body validation and stripping | Manual object inspection | `ValidationPipe` with `whitelist: true` | Handles nested objects, arrays, class inheritance; battle-tested |
| API documentation | Manual Swagger JSON files | `@nestjs/swagger` decorators + `SwaggerModule` | Auto-syncs with code; DTO decorators double as docs |
| Database migrations | Manual SQL files | `prisma migrate dev` / `prisma migrate deploy` | Tracks schema history; generates rollback-safe SQL |
| DB connection pooling | Custom pool configuration | `@prisma/adapter-pg` with `pg.Pool` options | Handles pool lifecycle, idle timeouts, max connections |
| Type-safe db queries | Raw SQL or query builder | Prisma generated client with TypeScript types | Zero type-drift between schema and queries |

**Key insight:** In this stack, hand-rolling any of the above loses the type-safety chain: Prisma schema → generated types → DTO validation → response. Any gap in that chain causes runtime type surprises.

---

## Runtime State Inventory

Not applicable — this is a greenfield phase. No existing data, live service config, or OS-registered state to migrate.

---

## Common Pitfalls

### Pitfall 1: Prisma 7 Import Path Mismatch
**What goes wrong:** Code imports `PrismaClient` from `@prisma/client` (Prisma 4/5/6 pattern). TypeScript compiles but runtime fails with "PrismaClient not exported" or type mismatches between modules.
**Why it happens:** Prisma 7 moved the generated client out of `node_modules/@prisma/client` to the custom output path.
**How to avoid:** Always import from `'../generated/prisma/client.js'` (or the configured output path). Search for `@prisma/client` imports in all files before every build.
**Warning signs:** `Module '"@prisma/client"' has no exported member 'PrismaClient'` TypeScript error. [VERIFIED: github.com/prisma/prisma/discussions/28866]

### Pitfall 2: Missing `prisma generate` After Schema Change
**What goes wrong:** Migrations run successfully but queries fail with type errors or "field does not exist" runtime errors.
**Why it happens:** Prisma 7 does not auto-run `prisma generate` after `prisma migrate dev`. The generated client is stale.
**How to avoid:** Always run `prisma generate` after any schema change. Add to `postinstall` script in `package.json`: `"postinstall": "prisma generate"`.
**Warning signs:** TypeScript shows correct types but runtime throws `PrismaClientValidationError`.

### Pitfall 3: `prisma.config.ts` Missing DATABASE_URL
**What goes wrong:** `prisma migrate dev` or `prisma generate` fails with "Environment variable not found: DATABASE_URL".
**Why it happens:** Prisma 7 reads the DB URL from `prisma.config.ts` at CLI runtime, not from `schema.prisma`. The `.env` file must be loaded via `dotenv/config` or the `env()` helper.
**How to avoid:** Import `'dotenv/config'` at the top of `prisma.config.ts`, or use `env('DATABASE_URL')` from `prisma/config` which reads `.env` automatically.
**Warning signs:** CLI commands fail locally even though `.env` has `DATABASE_URL`. [VERIFIED: prisma.io upgrade guide v7]

### Pitfall 4: Generated Client Outside `src/` Breaks NestJS Build
**What goes wrong:** `nest build` succeeds but the compiled `dist/` folder cannot find Prisma types at runtime.
**Why it happens:** NestJS `tsconfig` only compiles files under `rootDir` (usually `src/`). Files outside `src/` are not included in the output.
**How to avoid:** Set `output = "../src/generated/prisma"` in `schema.prisma` generator block. [VERIFIED: mgregersen.dk NestJS Prisma 7 guide]
**Warning signs:** `Cannot find module './generated/prisma/client'` at runtime after `nest build`.

### Pitfall 5: `enableImplicitConversion: false` Breaks Port Validation
**What goes wrong:** `PORT` env var (always a string from `process.env`) fails `@IsNumber()` validation even when set to `"3000"`.
**Why it happens:** class-transformer does not coerce strings to numbers unless `enableImplicitConversion: true` is set in `plainToInstance` options.
**How to avoid:** Always pass `{ enableImplicitConversion: true }` to `plainToInstance` in the `validate()` function.
**Warning signs:** App crashes at startup with `PORT must be a number` even when `PORT=3000` is set. [VERIFIED: github.com/nestjs/docs.nestjs.com configuration.md]

### Pitfall 6: `setGlobalPrefix` Affects Swagger UI Path
**What goes wrong:** `SwaggerModule.setup('docs', app, document)` places the UI at `/api/docs` only if the path argument does not already include the prefix — or places it at `/api/api/docs` if it does.
**Why it happens:** `SwaggerModule.setup` path is relative to the app root, not affected by `setGlobalPrefix`. The prefix is applied only to controller routes, not to Swagger.
**How to avoid:** Use `SwaggerModule.setup('api/docs', app, document)` to place the UI at `/api/docs` regardless of global prefix.
**Warning signs:** Swagger UI returns 404 or the JSON spec is at an unexpected path. [ASSUMED — based on NestJS Swagger behavior; verify during implementation]

### Pitfall 7: Swagger Docs Path Conflicts with Versioned Routes
**What goes wrong:** `GET /api/docs` returns a versioned controller response instead of the Swagger UI.
**Why it happens:** `defaultVersion: '1'` applies to all routes, but Swagger setup path is not a controller — it is registered directly on the Express adapter and bypasses NestJS routing.
**How to avoid:** No conflict in practice — Swagger registers its own Express routes before NestJS controller routing. The `api/docs` path does not collide with `/api/v1/docs`.
**Warning signs:** None expected, but verify during smoke test.

### Pitfall 8: Soft Delete Not Filtering Automatically in Phase 1
**What goes wrong:** Queries return soft-deleted records because there is no global filter on `deletedAt` yet.
**Why it happens:** The `deletedAt` field is present in the schema but no Prisma extension or middleware filters it automatically in Phase 1.
**How to avoid:** This is intentional for Phase 1 — the schema establishes the field, but the automatic filtering via `$extends` is a Phase 6 concern (when Event CRUD is implemented). All direct queries in the meantime must manually include `where: { deletedAt: null }`.
**Warning signs:** Not a bug — a deliberate Phase 1 boundary. Document for Phase 6.

---

## Code Examples

### Complete main.ts for Phase 1

```typescript
// src/main.ts
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Cultural Agenda API')
      .setDescription('Cultural events discovery platform')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

### Prisma Migration Workflow

```bash
# Development workflow (creates migration file + applies to DB)
npx prisma migrate dev --name init

# After any schema change
npx prisma generate

# Verify connection and schema
npx prisma db pull  # optional — confirms DB matches schema

# Production (applies existing migrations without creating new ones)
npx prisma migrate deploy
```

### package.json Scripts to Add

```json
{
  "scripts": {
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:studio": "prisma studio",
    "postinstall": "prisma generate"
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `provider = "prisma-client-js"` in generator | `provider = "prisma-client"` | Prisma 7.0 | Required change; old provider name rejected |
| Import from `@prisma/client` | Import from generated output path | Prisma 7.0 | Import paths change throughout codebase |
| `url = env("DATABASE_URL")` in `datasource` block | URL moves to `prisma.config.ts` | Prisma 7.0 | schema.prisma no longer holds connection string |
| `PrismaService.enableShutdownHooks(app)` with `$on('beforeExit')` | `app.enableShutdownHooks()` in main.ts | Prisma 5.0 | beforeExit event removed from library engine |
| Rust binary engine (`queryEngine`) | Node.js driver adapter engine | Prisma 7.0 | Smaller binaries; no Alpine issues; requires explicit adapter |
| `plainToClass` from class-transformer | `plainToInstance` | class-transformer 0.4 | `plainToClass` deprecated; `plainToInstance` is current |

**Deprecated/outdated:**
- `prisma-client-js` generator provider: Rejected in Prisma 7 — use `prisma-client`.
- `this.$on('beforeExit', ...)` in PrismaService: Removed in Prisma 5; causes runtime error in Prisma 7.
- `plainToClass`: Deprecated alias; use `plainToInstance`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@Global()` on PrismaModule is the right singleton approach for this project | Pattern 2 | Minor — could use module imports instead; no functional difference |
| A2 | `SwaggerModule.setup('api/docs', ...)` is the correct path for `/api/docs` URL | Pattern 7 / Pitfall 6 | Swagger UI unreachable at expected path; easy to fix during implementation |
| A3 | `module: "nodenext"` in tsconfig requires `.js` extensions on local imports | Code Examples | Build failures if extensions wrong; verify during first compile |

---

## Open Questions

1. **`.js` import extensions with `module: "nodenext"`**
   - What we know: `tsconfig.json` uses `"module": "nodenext"` and `"moduleResolution": "nodenext"`, which requires explicit `.js` file extensions on relative imports in TypeScript.
   - What's unclear: Whether the existing NestJS 11 scaffold already handles this or whether the build is configured to avoid it (some setups use path aliases or a different `tsconfig` for `nest build`).
   - Recommendation: Verify by checking if `app.module.ts` uses `.js` extensions on imports. If not, the project may be relying on `tsconfig-paths` to resolve without extensions. Match the existing pattern — do not change the module resolution strategy in Phase 1.

2. **Prisma 7 + `module: "nodenext"` compatibility**
   - What we know: Prisma 7 ships as an ES module. The tsconfig uses `nodenext` module resolution, which should be compatible.
   - What's unclear: Whether `prisma.config.ts` needs to be `prisma.config.mts` or can stay as `.ts` given the project's module setup.
   - Recommendation: Start with `prisma.config.ts` using `import 'dotenv/config'`. If the CLI rejects it, rename to `.mts`.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | ✓ | Inferred from @types/node ^24 | — |
| PostgreSQL | Prisma / Database | Unknown | — | Developer must provision local PostgreSQL |
| npm | Package installation | ✓ | Inferred from package.json | — |

**Missing dependencies with no fallback:**
- PostgreSQL: Must be running locally (or via Docker) before `prisma migrate dev` can execute. No fallback — the phase cannot succeed without it.

**Recommendation:** Include a `docker-compose.yml` task in Plan 01-01 that starts a PostgreSQL instance, or document the requirement clearly in the `.env.example`.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 (configured in package.json) |
| Config file | `package.json` jest section (rootDir: src, testRegex: `.*\\.spec\\.ts$`) |
| Quick run command | `npm test` |
| Full suite command | `npm run test:cov` |
| E2E command | `npm run test:e2e` (jest-e2e.json) |

### Phase Requirements → Test Map
Phase 1 has no REQ-IDs (infrastructure phase), but success criteria drive test needs:

| Success Criteria | Behavior | Test Type | Automated Command | File Exists? |
|-----------------|----------|-----------|-------------------|-------------|
| SC-1: `/api/v1/` returns a response | URI versioning + prefix active | e2e smoke | `npm run test:e2e` | ❌ Wave 0 |
| SC-2: Prisma connects + migrations run | DB connection established | manual / integration | `npx prisma migrate dev` (manual) | N/A |
| SC-3: Swagger at `/api/docs` | Swagger UI accessible | e2e smoke | `npm run test:e2e` | ❌ Wave 0 |
| SC-4: Missing env vars crash process | validate() throws on bad config | unit | `npm test` | ❌ Wave 0 |
| SC-5: ValidationPipe rejects malformed bodies | 400 on invalid body | e2e / unit | `npm run test:e2e` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm test` (unit tests only)
- **Per wave merge:** `npm run test:e2e`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `test/app.e2e-spec.ts` — SC-1, SC-3, SC-5 (check if file exists; scaffold has it but may need updates)
- [ ] `src/config/env.validation.spec.ts` — SC-4: unit test for validate() with missing/invalid vars
- [ ] `test/jest-e2e.json` — exists in scaffold but verify it references correct module paths

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 2) | — |
| V3 Session Management | No (stateless JWT, Phase 2) | — |
| V4 Access Control | No (Phase 2) | — |
| V5 Input Validation | Yes | `ValidationPipe` with `whitelist: true` + `class-validator` |
| V6 Cryptography | No (Phase 1) | — |
| V7 Error Handling | Partial | Default NestJS exception filter (D-09); no stack traces in production |
| V14 Configuration | Yes | `ConfigModule validate` crashes process on invalid env; `NODE_ENV` guard for Swagger |

### Known Threat Patterns for NestJS + Prisma

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Mass assignment (extra body props) | Tampering | `ValidationPipe whitelist: true` strips unknown properties |
| Env secret leakage via Swagger | Information Disclosure | Swagger guarded by `NODE_ENV !== 'production'` (D-07) |
| DB connection string in committed code | Information Disclosure | `DATABASE_URL` in `.env` (gitignored); `prisma.config.ts` uses `env()` helper |
| Unvalidated env vars causing undefined behavior | Denial of Service | `validate()` in ConfigModule crashes process before serving requests |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: prisma.io/docs/guides/upgrade-prisma-orm/v7] — Prisma 7 breaking changes: driver adapters required, URL moves to prisma.config.ts, generator provider change
- [VERIFIED: github.com/nestjs/docs.nestjs.com configuration.md] — ConfigModule validate option, EnvironmentVariables class, plainToInstance + validateSync pattern
- [VERIFIED: github.com/nestjs/docs.nestjs.com versioning.md] — URI versioning, enableVersioning, VERSION_NEUTRAL, defaultVersion
- [VERIFIED: tessl.io/registry/npm-nestjs--swagger/11.2.0/docs/document-builder.md] — DocumentBuilder API, addBearerAuth() signature
- [VERIFIED: prisma.io/docs upgrade-to-prisma-5] — beforeExit hook removed; app.enableShutdownHooks() replacement
- [VERIFIED: npm registry, 2026-04-18] — All package versions confirmed current

### Secondary (MEDIUM confidence)
- [mgregersen.dk/upgrading-prisma-to-rust-free-client-in-nestjs/] — Complete Prisma 7 NestJS migration guide; schema.prisma generator, prisma.config.ts, PrismaService, pitfalls
- [dev.to/robson_idongesitsamuel_b Prisma 7 Docker NestJS guide] — PrismaService with OnModuleInit/OnModuleDestroy pattern
- [github.com/prisma/prisma/issues/20171] — beforeExit event removed confirmation; community workaround discussion

### Tertiary (LOW confidence)
- [WebSearch community sources] — APP_PIPE vs useGlobalPipes tradeoff (consensus from multiple sources; no single authoritative doc)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-04-18
- Prisma 7 architecture: HIGH — verified against prisma.io official upgrade guide
- ConfigModule pattern: HIGH — verified against nestjs/docs.nestjs.com source
- URI versioning: HIGH — verified against nestjs/docs.nestjs.com versioning.md
- Swagger setup: HIGH — verified against nestjs/swagger 11.2.0 DocumentBuilder docs
- ValidationPipe: HIGH — verified against NestJS docs and community consensus
- Soft delete: MEDIUM — $extends approach verified, but Phase 1 only adds the field (no filtering); Phase 6 implements filtering

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days; Prisma 7 is stable; NestJS 11 is stable)
