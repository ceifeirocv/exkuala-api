# Phase 4: Categories - Pattern Map

**Mapped:** 2026-05-04
**Files analyzed:** 12 new/modified files
**Analogs found:** 11 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/categories/category.entity.ts` | model | CRUD | `src/users/user.entity.ts` | exact |
| `src/categories/category-translation.entity.ts` | model | CRUD | `src/users/user.entity.ts` | role-match (no existing relation entity) |
| `src/categories/categories.module.ts` | config | request-response | `src/users/users.module.ts` | exact |
| `src/categories/categories.service.ts` | service | CRUD | `src/users/users.service.ts` | role-match |
| `src/categories/categories.controller.ts` | controller | request-response | `src/webhooks/webhooks.controller.ts` | role-match |
| `src/categories/dto/create-category.dto.ts` | utility | request-response | `src/webhooks/dto/auth0-webhook.dto.ts` | role-match |
| `src/categories/dto/update-category.dto.ts` | utility | request-response | `src/webhooks/dto/auth0-webhook.dto.ts` | role-match |
| `src/categories/dto/category-response.dto.ts` | utility | request-response | `src/webhooks/dto/auth0-webhook.dto.ts` | role-match |
| `src/categories/categories.service.spec.ts` | test | CRUD | `src/users/users.service.spec.ts` | exact |
| `src/categories/categories.controller.spec.ts` | test | request-response | `src/webhooks/webhooks.controller.spec.ts` | exact |
| `src/database/migrations/{timestamp}-categories.ts` | migration | CRUD | `src/database/migrations/1745000000000-baseline.ts` | exact |
| `src/database/seeds/categories.seed.ts` | utility | batch | `src/database/data-source.ts` (bootstrap pattern) | partial (no seed analog exists) |
| `src/app.module.ts` (modified) | config | request-response | `src/app.module.ts` | self (modification) |

---

## Pattern Assignments

### `src/categories/category.entity.ts` (model, CRUD)

**Analog:** `src/users/user.entity.ts` (lines 1–31)

**Imports pattern** (lines 1–9):
```typescript
import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
```

**Core entity pattern** (lines 11–31):
```typescript
@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 128, unique: true })
  auth0Id: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

**Adaptation notes for `CategoryEntity`:**
- Replace `@Entity('users')` with `@Entity('categories')`
- Replace `auth0Id` column with `name varchar(100) unique` and `slug varchar(100) unique`
- Keep `@CreateDateColumn()` / `@UpdateDateColumn()` verbatim
- Keep `@BeforeInsert() generateId()` verbatim — guard `if (!this.id)` is critical

---

### `src/categories/category-translation.entity.ts` (model, CRUD)

**Analog:** `src/users/user.entity.ts` — same CUID2 PK and `@BeforeInsert` scaffold. No existing one-to-many relation entity in the codebase; use RESEARCH.md Pattern 2 for the `@ManyToOne` / `@Index` additions.

**Imports pattern** — extend user.entity.ts imports with relation decorators:
```typescript
import { createId } from '@paralleldrive/cuid2';
import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { CategoryEntity } from './category.entity';
```

**Core entity scaffold** (from `src/users/user.entity.ts` lines 11–31, adapted):
```typescript
// @Index on composite (categoryId, locale) is the DB-level unique guard for D-06.
// onDelete: 'CASCADE' ensures translation rows are removed when parent category is deleted.
@Entity('category_translations')
@Index(['categoryId', 'locale'], { unique: true })
export class CategoryTranslationEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  // ...columns and @ManyToOne

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

---

### `src/categories/categories.module.ts` (config, request-response)

**Analog:** `src/users/users.module.ts` (lines 1–12)

**Full pattern** (lines 1–12):
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  // exports is REQUIRED — WebhooksModule imports UsersModule to access UsersService (RESEARCH.md Pitfall 5)
  exports: [UsersService],
})
export class UsersModule {}
```

**Adaptation notes:**
- `TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])` — two entities
- Add `CategoriesController` to `controllers: [...]`
- No `exports` needed for Phase 4 (no downstream module imports `CategoriesService` yet)

---

### `src/categories/categories.service.ts` (service, CRUD)

**Analog:** `src/users/users.service.ts` (lines 1–43)

**Imports pattern** (lines 1–6):
```typescript
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { UserEntity } from './user.entity';
```

**Constructor / DI pattern** (lines 8–14):
```typescript
@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) {}
```

**Error handling + structured log pattern** (lines 21–32):
```typescript
  async upsertFromAuth0(sub: string): Promise<void> {
    try {
      await this.userRepository.upsert(
        { id: createId(), auth0Id: sub },
        { conflictPaths: ['auth0Id'] },
      );
    } catch (err) {
      // Structured log preserves sub for tracing; re-throw so Auth0 receives 500 and retries.
      this.logger.error({ event: 'upsert_failed', sub, error: (err as Error).message });
      throw err;
    }
  }
```

**Adaptation notes for `CategoriesService`:**
- Inject two repositories: `@InjectRepository(CategoryEntity)` and `@InjectRepository(CategoryTranslationEntity)`
- `create()` method: derive slug via `slugify(name, { lower: true, strict: true })` if no explicit slug in DTO; pre-generate id with `createId()` (same as `upsertFromAuth0` — `@BeforeInsert` is unreliable on upsert paths); catch `QueryFailedError` with `.code === '23505'` and rethrow as `ConflictException`
- `findAll()` method: `find({ relations: ['translations'] })` then map to `{ id, slug, name, translations: Object.fromEntries(...) }`
- `update()` method: `findOneOrFail` first (throws `NotFoundException` if absent), then `save()` patched entity
- `remove()` method: `findOneOrFail` first, then `delete({ id })`
- Keep `private readonly logger = new Logger(CategoriesService.name)` and structured log pattern for errors

---

### `src/categories/categories.controller.ts` (controller, request-response)

**Analog:** `src/webhooks/webhooks.controller.ts` (lines 1–22)

**Imports pattern** (lines 1–6):
```typescript
import { Body, Controller, HttpCode, Post, UseGuards } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { Auth0WebhookDto } from './dto/auth0-webhook.dto';
import { WebhookSecretGuard } from './guards/webhook-secret.guard';
```

**Controller scaffold** (lines 11–22):
```typescript
@Controller('webhooks')
export class WebhookController {
  constructor(private readonly usersService: UsersService) {}

  @Public()
  @UseGuards(WebhookSecretGuard)
  @Post('auth0')
  @HttpCode(200)
  async handleAuth0Webhook(@Body() dto: Auth0WebhookDto): Promise<void> {
    await this.usersService.upsertFromAuth0(dto.sub);
  }
}
```

**Adaptation notes for `CategoriesController`:**
- `@Controller('categories')` — registers under `/api/v1/categories` via global prefix
- `GET /` — `@Public()` decorator (bypasses `JwtAuthGuard`); no `@Roles` needed; calls `service.findAll()`
- `POST /` — `@Roles('admin')` decorator; `@Body() dto: CreateCategoryDto`; calls `service.create(dto)`
- `PATCH /:id` — `@Roles('admin')` decorator; `@Param('id')` + `@Body() dto: UpdateCategoryDto`; calls `service.update(id, dto)`
- `DELETE /:id` — `@Roles('admin')` decorator; `@Param('id')`; calls `service.remove(id)`
- Import `Roles` from `src/auth/decorators/roles.decorator.ts`; import `Public` from `src/auth/decorators/public.decorator.ts`
- No `@UseGuards()` needed — `JwtAuthGuard` and `RolesGuard` are globally registered via `APP_GUARD` in `src/auth/auth.module.ts` (lines 16–17)

**`@Roles` decorator** (`src/auth/decorators/roles.decorator.ts` lines 1–5):
```typescript
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
// @Roles('admin', 'organizer') — requires the authenticated user to have ALL listed roles
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
```

**`@Public` decorator** (`src/auth/decorators/public.decorator.ts` lines 1–5):
```typescript
import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';
// @Public() — decorates a route handler or controller class to bypass JwtAuthGuard and RolesGuard
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

---

### `src/categories/dto/create-category.dto.ts` (utility, request-response)

**Analog:** `src/webhooks/dto/auth0-webhook.dto.ts` (lines 1–15)

**DTO scaffold pattern** (lines 1–15):
```typescript
import { IsIn, IsNotEmpty, IsString } from 'class-validator';

export class Auth0WebhookDto {
  @IsString()
  @IsNotEmpty()
  sub: string;

  @IsIn(['post-login', 'post-register'])
  event: 'post-login' | 'post-register';
}
```

**Adaptation notes:**
- Use `@IsString()`, `@MaxLength(100)` for `name`
- Use `@IsOptional()`, `@IsString()`, `@MaxLength(100)`, `@Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })` for optional `slug` field
- `slug` field omission causes service to derive from `name` via `slugify`

---

### `src/categories/dto/update-category.dto.ts` (utility, request-response)

**Analog:** `src/webhooks/dto/auth0-webhook.dto.ts` — same class-validator scaffold.

**Adaptation notes:**
- Only `name?: string` with `@IsOptional()`, `@IsString()`, `@MaxLength(100)`
- Deliberately omit `slug` field entirely — do NOT extend `PartialType(CreateCategoryDto)` as that would inherit `slug` (RESEARCH.md Pitfall 6)
- If `slug` appears in PATCH payload it is stripped by global `ValidationPipe(whitelist: true)` — no explicit 400 needed; document this in a comment

---

### `src/categories/dto/category-response.dto.ts` (utility, request-response)

**Analog:** No exact analog exists (no response DTO files in current codebase — controllers return plain objects/entities). Use interface/plain-object approach matching service return shape.

**Pattern:** Define as a plain TypeScript interface or class without class-transformer decorators (consistent with current codebase which returns raw entities):

```typescript
// CategoryResponseItem — shape returned by GET /categories
// translations is a locale→name map (D-10); clients resolve their preferred locale client-side (D-11)
export interface CategoryResponseItem {
  id: string;
  slug: string;
  name: string;
  translations: Record<string, string>;
}
```

---

### `src/categories/categories.service.spec.ts` (test, CRUD)

**Analog:** `src/users/users.service.spec.ts` (lines 1–86) — exact match: `TestingModule` + `getRepositoryToken` mock pattern.

**Test scaffold pattern** (lines 1–25):
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { UsersService } from './users.service';

const mockRepository = {
  upsert: jest.fn().mockResolvedValue({ raw: [], generatedMaps: [] }),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepository },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });
```

**Adaptation notes:**
- Two `mockRepository` objects: `mockCategoryRepository` and `mockCategoryTranslationRepository` — named constants, not inline stubs (CLAUDE.md: "Mock external I/O with named fake classes")
- Register both via `getRepositoryToken(CategoryEntity)` and `getRepositoryToken(CategoryTranslationEntity)` in `providers`
- `describe` blocks per method: `findAll()`, `create()`, `update()`, `remove()`
- Wave 0 spec: import non-existent source files at import level so tests are RED before implementation; stub `it('TODO', () => { expect(true).toBe(false); })` per test case

---

### `src/categories/categories.controller.spec.ts` (test, request-response)

**Analog:** `src/webhooks/webhooks.controller.spec.ts` (lines 1–20) — exact match: direct instantiation pattern (no `TestingModule`).

**Full test scaffold** (lines 1–20):
```typescript
import { UsersService } from '../users/users.service';
import { WebhookController } from './webhooks.controller';

const mockUsersService = {
  upsertFromAuth0: jest.fn().mockResolvedValue(undefined),
};

describe('WebhookController', () => {
  let controller: WebhookController;

  beforeEach(() => {
    jest.clearAllMocks();
    controller = new WebhookController(mockUsersService as unknown as UsersService);
  });

  it('calls usersService.upsertFromAuth0 with dto.sub', async () => {
    await controller.handleAuth0Webhook({ sub: 'auth0|abc123', event: 'post-register' });
    expect(mockUsersService.upsertFromAuth0).toHaveBeenCalledWith('auth0|abc123');
  });
});
```

**Adaptation notes:**
- `mockCategoriesService` = `{ findAll: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() }`
- `controller = new CategoriesController(mockCategoriesService as unknown as CategoriesService)`
- One `it()` per HTTP method verifying the controller delegates to the correct service method

---

### `src/database/migrations/{timestamp}-categories.ts` (migration, CRUD)

**Analog:** `src/database/migrations/1745000000000-baseline.ts` (lines 1–59) — exact match.

**Class / method scaffold** (lines 1–12):
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Baseline migration — squashes the entire schema from Phase 1 (Prisma) into a
 * single TypeORM migration. ...
 */
export class Baseline1745000000000 implements MigrationInterface {
  name = 'Baseline1745000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
```

**Raw SQL style** (lines 20–51) — multi-line template literal with inline CONSTRAINT naming:
```typescript
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id"        varchar(30)  NOT NULL,
        "auth0Id"   varchar(128) NOT NULL,
        "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_auth0Id" UNIQUE ("auth0Id")
      )
    `);
```

**`down()` pattern** (lines 54–58):
```typescript
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "events"`);
    await queryRunner.query(`DROP TABLE "users"`);
    await queryRunner.query(`DROP TYPE "public"."event_status"`);
  }
```

**Adaptation notes:**
- Drop `category_translations` before `categories` in `down()` — FK dependency order
- Class name: `Categories{timestamp}` e.g. `Categories1746000000000`
- `name` property must match class name exactly (TypeORM migration tracking)
- RESEARCH.md provides the exact SQL to copy for both tables

---

### `src/database/seeds/categories.seed.ts` (utility, batch)

**Analog:** `src/database/data-source.ts` — bootstrap pattern for standalone TypeORM script (no NestJS). No seeder files exist yet in the codebase.

**Standalone script scaffold** (`src/database/data-source.ts` lines 1–25):
```typescript
import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource for TypeORM CLI (migration:generate, migration:run, migration:revert).
 *
 * IMPORTANT: This file runs WITHOUT NestJS bootstrap — the CLI invokes it directly.
 * Do NOT import ConfigService here. Read DATABASE_URL from process.env directly.
 * ...
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['dist/**/*.entity.js'],
  migrations: ['dist/database/migrations/*.js'],
  synchronize: false,
  logging: false,
});
```

**Adaptation notes:**
- Begin with `import 'dotenv/config'` — same as data-source.ts; no ConfigService
- Import `AppDataSource` from `../database/data-source` (reuse existing DataSource, do not create a second one)
- `AppDataSource.initialize()` / `AppDataSource.destroy()` wrapping the seed loop
- Use `upsert` with `conflictPaths: ['slug']` on `CategoryEntity` to make seeder idempotent (re-runnable without 409 — RESEARCH.md Pitfall 4)
- `pnpm seed:categories` script in `package.json` pointing to `ts-node -r tsconfig-paths/register src/database/seeds/categories.seed.ts`

---

### `src/app.module.ts` (modified, config, request-response)

**Analog:** Self — modification of existing file.

**Current `entities` array** (`src/app.module.ts` line 23):
```typescript
        entities: [UserEntity, EventEntity],
```

**Current `imports` array** (`src/app.module.ts` lines 33–35):
```typescript
    AuthModule,
    WebhooksModule,   // registers /api/v1/webhooks/auth0 endpoint
```

**Required additions:**
- Add `CategoryEntity, CategoryTranslationEntity` to `entities: [...]` array (line 23)
- Add `CategoriesModule` import to `imports: [...]` array (after `WebhooksModule`)
- Add corresponding import statements at top of file

---

## Shared Patterns

### CUID2 Primary Key Generation
**Source:** `src/users/user.entity.ts` lines 25–30
**Apply to:** `CategoryEntity`, `CategoryTranslationEntity`
```typescript
@BeforeInsert()
generateId() {
  if (!this.id) {
    this.id = createId();
  }
}
```
**Note:** `@BeforeInsert` does NOT fire on `repository.upsert()`. Always call `createId()` explicitly in service methods that use upsert paths (see `src/users/users.service.ts` line 24: `{ id: createId(), auth0Id: sub }`).

### `@Roles('admin')` Access Control
**Source:** `src/auth/decorators/roles.decorator.ts` lines 1–5
**Apply to:** `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` handlers in `CategoriesController`
```typescript
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
// Usage: @Roles('admin') on the method
```
**Note:** `RolesGuard` is globally registered in `src/auth/auth.module.ts` lines 16–17 via `APP_GUARD`. No `@UseGuards(RolesGuard)` needed on the controller.

### `@Public()` Bypass
**Source:** `src/auth/decorators/public.decorator.ts` lines 1–5
**Apply to:** `GET /categories` handler in `CategoriesController`
```typescript
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
// Usage: @Public() on the method
```
**Note:** `JwtAuthGuard` is globally registered in `src/auth/auth.module.ts` line 16. `@Public()` sets metadata that `JwtAuthGuard` checks to skip JWT validation.

### Structured Error Logging
**Source:** `src/users/users.service.ts` lines 9, 27–30
**Apply to:** `CategoriesService` catch blocks
```typescript
private readonly logger = new Logger(UsersService.name);
// ...
this.logger.error({ event: 'upsert_failed', sub, error: (err as Error).message });
```

### Named Mock Repository Pattern
**Source:** `src/users/users.service.spec.ts` lines 6–10
**Apply to:** `categories.service.spec.ts`
```typescript
const mockRepository = {
  upsert: jest.fn().mockResolvedValue({ raw: [], generatedMaps: [] }),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
};
```
**Note:** Use named constants (`mockCategoryRepository`, `mockCategoryTranslationRepository`), not inline `useValue: { ... }`. Clear all mocks in `beforeEach` via `jest.clearAllMocks()`.

### Module Structure
**Source:** `src/users/users.module.ts` lines 1–12
**Apply to:** `CategoriesModule`
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([UserEntity])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| `src/database/seeds/categories.seed.ts` | utility | batch | No seed files exist in the codebase. Closest structural analog is `data-source.ts` (standalone TypeORM script). RESEARCH.md Pattern 7 provides the full implementation template. |
| `src/categories/dto/category-response.dto.ts` | utility | request-response | No response DTO / serialization class exists in the codebase — controllers currently return raw entities. Use plain TypeScript interface per RESEARCH.md Pattern 5. |

---

## Metadata

**Analog search scope:** `src/users/`, `src/webhooks/`, `src/auth/`, `src/database/`, `src/app.module.ts`
**Files scanned:** 13
**Pattern extraction date:** 2026-05-04
