# Phase 1: Foundation - Pattern Map

**Mapped:** 2026-04-18
**Files analyzed:** 8 (6 new + 2 modified)
**Analogs found:** 6 / 8 (2 config/schema files have no intra-project analog; RESEARCH.md patterns apply)

---

## Critical Baseline Finding: Import Extensions

**Source:** `src/main.ts` (line 2), `src/app.module.ts` (lines 1-3)

The existing scaffold uses bare relative imports WITHOUT `.js` extensions:
```typescript
import { AppModule } from './app.module';      // NOT './app.module.js'
import { AppController } from './app.controller';
```

`tsconfig.json` uses `"module": "nodenext"` + `"moduleResolution": "nodenext"`, but the project
relies on `ts-node` + `tsconfig-paths` for local dev and `nest build` for compilation. The NestJS
CLI handles path resolution without requiring explicit extensions.

**Rule:** All new files in Phase 1 MUST use bare relative imports (no `.js` suffix). This overrides
the `.js` extension examples in RESEARCH.md code snippets. Match the existing scaffold pattern.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/main.ts` (modified) | bootstrap | request-response | `src/main.ts` (existing) | self — extend in place |
| `src/app.module.ts` (modified) | root module | config | `src/app.module.ts` (existing) | self — extend in place |
| `src/prisma/prisma.service.ts` | service | CRUD | `src/app.service.ts` | role-match (only service in project) |
| `src/prisma/prisma.module.ts` | module | config | `src/app.module.ts` | role-match (only module in project) |
| `src/config/env.validation.ts` | utility/config | transform | `src/app.service.ts` | partial (Injectable class structure) |
| `prisma/schema.prisma` | schema | — | none | no analog — use RESEARCH.md Pattern 3 |
| `prisma.config.ts` | config | — | none | no analog — use RESEARCH.md Pattern 1 |
| `src/config/env.validation.spec.ts` | test | — | `src/app.controller.spec.ts` | role-match (only unit test in project) |

---

## Pattern Assignments

### `src/main.ts` (modified — bootstrap, request-response)

**Analog:** `src/main.ts` (existing, lines 1-8) — extend in place

**Existing pattern to preserve** (lines 1-8):
```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Additions to insert before `app.listen`** (from RESEARCH.md Patterns 5, 6, 7):
```typescript
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix (applied before version segment)
  app.setGlobalPrefix('api');

  // URI versioning — produces /api/v1/... for all routes with no @Version() override
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  // ValidationPipe: whitelist strips unknown props; transform converts plain → DTO (D-08)
  // forbidNonWhitelisted intentionally omitted per D-08
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  // Swagger: non-production only (D-07); bearerAuth pre-armed for Phase 2 (D-06)
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

  // Prisma 7: no prismaService.enableShutdownHooks(app) — use NestJS native (D-RESEARCH)
  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

**Import extension rule:** Keep bare imports (`./app.module`, not `./app.module.js`). Match existing line 2.

---

### `src/app.module.ts` (modified — root module, config)

**Analog:** `src/app.module.ts` (existing, lines 1-10) — extend in place

**Existing pattern to preserve:**
```typescript
import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Modified form — add ConfigModule and PrismaModule to imports array:**
```typescript
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validate } from './config/env.validation';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,   // ConfigService injectable everywhere without re-importing
      validate,         // crashes process if DATABASE_URL or PORT missing/invalid (D-05)
    }),
    PrismaModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```

**Import extension rule:** Bare imports only — matches existing lines 2-3 pattern.

---

### `src/prisma/prisma.service.ts` (new — service, CRUD)

**Analog:** `src/app.service.ts` (lines 1-8) — same `@Injectable()` class structure

**Injectable class pattern from analog** (lines 1-8):
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHello(): string {
    return 'Hello World!';
  }
}
```

**PrismaService implementation** — extends analog's `@Injectable()` pattern, adds lifecycle hooks:
```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

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

**Notes:**
- Import from `'../generated/prisma/client'` (NOT `@prisma/client`) — Prisma 7 breaking change
- `OnModuleInit` / `OnModuleDestroy` replaces the removed `$on('beforeExit')` lifecycle hook
- No `enableShutdownHooks` method call — that is done once in `main.ts` via `app.enableShutdownHooks()`
- Import extension rule: bare relative import for `../generated/prisma/client`

---

### `src/prisma/prisma.module.ts` (new — module, config)

**Analog:** `src/app.module.ts` (lines 1-10) — same `@Module()` decorator structure

**Module class pattern from analog** (lines 1-10):
```typescript
import { Module } from '@nestjs/common';

@Module({
  imports: [],
  controllers: [...],
  providers: [...],
})
export class AppModule {}
```

**PrismaModule implementation** — adds `@Global()` and `exports`:
```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()   // PrismaService injectable in all modules without explicit import
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

**Notes:**
- `@Global()` is the standard singleton pattern for DB modules — avoids re-importing in every feature module
- No `controllers` or `imports` arrays needed (omit entirely per NestJS convention when empty)

---

### `src/config/env.validation.ts` (new — utility, transform)

**Analog:** `src/app.service.ts` (lines 1-8) — plain exported class pattern (closest available)

**Class export pattern from analog:**
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService { ... }
```

**env.validation.ts implementation** — plain class (no `@Injectable()`, used by ConfigModule directly):
```typescript
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
    { enableImplicitConversion: true }, // converts "3000" string to number (Pitfall 5)
  );
  const errors = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString()); // crashes process before any request (D-05)
  }
  return validatedConfig;
}
```

**Notes:**
- `enableImplicitConversion: true` is mandatory — `process.env` values are always strings; without it `PORT=3000` fails `@IsNumber()` (Pitfall 5)
- `skipMissingProperties: false` ensures missing required vars crash immediately
- `plainToInstance` (not deprecated `plainToClass`) — class-transformer 0.4+ current API
- No `@Injectable()` — this class is consumed by ConfigModule's `validate` option, not DI

---

### `src/config/env.validation.spec.ts` (new — unit test, transform)

**Analog:** `src/app.controller.spec.ts` (lines 1-22) — only unit test in codebase

**Unit test structure from analog** (lines 1-22):
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
```

**env.validation.spec.ts implementation** — no NestJS `Test.createTestingModule` needed (pure function test):
```typescript
import { validate } from './env.validation';

describe('validate (env)', () => {
  it('returns validated config when required vars are present', () => {
    const result = validate({ DATABASE_URL: 'postgresql://localhost/test', PORT: '3000' });
    expect(result.DATABASE_URL).toBe('postgresql://localhost/test');
    expect(result.PORT).toBe(3000); // coerced from string to number
  });

  it('throws when DATABASE_URL is missing', () => {
    expect(() => validate({ PORT: '3000' })).toThrow();
  });

  it('throws when PORT is missing', () => {
    expect(() => validate({ DATABASE_URL: 'postgresql://localhost/test' })).toThrow();
  });

  it('throws when PORT is out of range', () => {
    expect(() =>
      validate({ DATABASE_URL: 'postgresql://localhost/test', PORT: '99999' }),
    ).toThrow();
  });
});
```

**Notes:**
- No `Test.createTestingModule` — `validate` is a pure function, no NestJS DI needed
- `describe` / `it` / `expect` pattern matches analog exactly
- `PORT` passed as string `'3000'` to validate string-to-number coercion (mirrors `process.env` reality)

---

### `prisma/schema.prisma` (new — schema)

**Analog:** None in codebase. Use RESEARCH.md Pattern 1 and Pattern 3 directly.

**Complete schema** (from RESEARCH.md Patterns 1 + 3, CONTEXT.md D-01/D-02/D-03):
```prisma
generator client {
  provider = "prisma-client"       // Prisma 7: NOT "prisma-client-js" (breaking change)
  output   = "../src/generated/prisma"  // Must be inside src/ for nest build (Pitfall 4)
}

datasource db {
  provider = "postgresql"
  // url is NOT defined here in Prisma 7 — lives in prisma.config.ts (Pitfall 3)
}

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
  categoryId        String?     // Nullable FK — Category model added Phase 4
  ticketPrice       Decimal?    @db.Decimal(10, 2)
  externalTicketUrl String?
  status            EventStatus @default(DRAFT)
  organizerId       String?     // Nullable FK — Organizer model added Phase 5
  deletedAt         DateTime?   // Soft delete — MUST be present from Phase 1 (STATE.md)
  createdAt         DateTime    @default(now())
  updatedAt         DateTime    @updatedAt

  @@map("events")
}
```

---

### `prisma.config.ts` (new — config, project root)

**Analog:** None in codebase. Use RESEARCH.md Pattern 1 directly.

```typescript
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: env('DATABASE_URL') },
});
```

**Notes:**
- Must be at project root (not in `src/`) — Prisma CLI reads it before TypeScript compilation
- `import 'dotenv/config'` loads `.env` so `env('DATABASE_URL')` resolves locally (Pitfall 3)
- If CLI rejects `.ts` extension, rename to `prisma.config.mts` (RESEARCH.md open question 2)

---

## Shared Patterns

### Module Decorator Structure
**Source:** `src/app.module.ts` (lines 5-9)
**Apply to:** `src/prisma/prisma.module.ts`
```typescript
@Module({
  imports: [],       // omit key entirely if empty
  providers: [...],
  exports: [...],    // required when other modules need the service
})
```

### Injectable Service Structure
**Source:** `src/app.service.ts` (lines 1-8)
**Apply to:** `src/prisma/prisma.service.ts`
```typescript
import { Injectable } from '@nestjs/common';

@Injectable()
export class XxxService {
  // methods
}
```

### Unit Test Structure
**Source:** `src/app.controller.spec.ts` (lines 1-22)
**Apply to:** `src/config/env.validation.spec.ts`
```typescript
describe('FeatureName', () => {
  beforeEach(async () => { /* setup */ });
  describe('method', () => {
    it('should ...', () => {
      expect(...).toBe(...);
    });
  });
});
```

### Import Extension Convention
**Source:** `src/main.ts` (line 2), `src/app.module.ts` (lines 2-3)
**Apply to:** ALL new TypeScript files
```typescript
// CORRECT — bare relative import (no .js extension)
import { AppModule } from './app.module';
import { PrismaService } from './prisma.service';

// WRONG — do not add .js extensions despite nodenext tsconfig
import { AppModule } from './app.module.js';
```
**Rationale:** Existing scaffold files do not use `.js` extensions. NestJS CLI (`nest build`) handles
resolution. Adding `.js` would be inconsistent with the project's established convention.

### Bootstrap Function Shape
**Source:** `src/main.ts` (lines 4-8)
**Apply to:** `src/main.ts` (modified)
```typescript
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // ... middleware/pipes/swagger setup ...
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `prisma/schema.prisma` | schema | — | No Prisma schema exists; follow RESEARCH.md Pattern 3 |
| `prisma.config.ts` | config | — | No Prisma CLI config exists; follow RESEARCH.md Pattern 1 |

---

## Metadata

**Analog search scope:** `src/` (all existing source files)
**Files scanned:** 6 (main.ts, app.module.ts, app.controller.ts, app.service.ts, app.controller.spec.ts, test/app.e2e-spec.ts)
**Key finding:** This is a greenfield NestJS scaffold. All intra-project analogs come from the 4 stub files. Pattern quality is "role-match" at best — RESEARCH.md verified patterns are the authoritative source for implementation detail.
**Import extension decision:** Bare imports (no `.js`) confirmed from existing files. All RESEARCH.md code examples showing `.js` extensions must be adapted to match project convention.
**Pattern extraction date:** 2026-04-18
