# Phase 04: Categories - Research

**Researched:** 2026-05-04
**Domain:** NestJS CRUD + TypeORM one-to-many relations + slug derivation + seeder pattern
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Slug auto-derived from `Category.name` on creation (lowercase, spaces → hyphens, strip non-alphanumeric-hyphen). Explicit `slug` in create payload overrides.
- **D-02:** Slug is write-once — `PATCH /categories/:id` ignores (or 400s) any slug field. Planner decides 400 vs. silent ignore.
- **D-03:** Slug collision → HTTP 409 Conflict with conflicting slug value in message. No auto-suffix.
- **D-04:** Slug validation: `^[a-z0-9-]+$`, enforced at DTO level with `@Matches`.
- **D-05:** `Category.name` = default/primary name (English). `CategoryTranslation.name` = locale override.
- **D-06:** Translations schema: `{ id (cuid2), categoryId (FK), locale (varchar, BCP-47), name (varchar) }`. Unique constraint on `(categoryId, locale)`.
- **D-07:** Locale is open varchar — no DB enum, no allowlist in Phase 4.
- **D-08:** Both entities use CUID2 primary keys (established pattern from UserEntity).
- **D-09:** All string columns have explicit `VarChar` lengths; DTOs mirror with `@MaxLength` (SEC-01 pattern).
- **D-10:** `GET /categories` response per item: `{ id, slug, name, translations: { "pt": "..." } }`. `name` = default. `translations` = map of all available locale rows.
- **D-11:** No Accept-Language header processing for categories. Full translations map always returned.
- **D-12:** ROADMAP success criterion #3 (Accept-Language) is superseded by D-10/D-11. Translations map satisfies the intent; update ROADMAP criterion accordingly.
- **D-13:** TypeORM seeder ships with ~10 cultural categories: music, theatre, cinema, dance, visual arts, festivals, talks, workshops, comedy, exhibitions.
- **D-14:** Seed includes both English default names and Portuguese (`pt`) translations for every category.
- **D-15:** Seeder runs as a separate script (not part of migration). Command: `pnpm seed:categories` (exact name: planner's discretion).

### Claude's Discretion

- Whether `PATCH` with a slug field returns 400 or silently ignores it.
- Exact `VarChar` lengths for `name` (suggestion: 100) and `locale` (suggestion: 10).
- Whether `GET /categories/:slug` single-category-by-slug endpoint is included.
- Exact seeder script command name.

### Deferred Ideas (OUT OF SCOPE)

- Accept-Language server-side resolution for categories.
- Category soft delete.
- Category display ordering / priority field.
- GET /categories/:slug — not in roadmap scope; planner may add if trivial.
- Attaching categories to events (Phase 6+).
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Categories exist as a managed list (name + slug) | `CategoryEntity` with `name` + `slug` columns; public `GET /categories`; TypeORM migration |
| CAT-02 | Admin can create, edit, and delete categories | `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` behind `@Roles('admin')`; `RolesGuard` already wired globally |
| CAT-03 | Category names support translations via a separate translations table | `CategoryTranslationEntity` with FK to `Category`; TypeORM one-to-many relation; translations map in response |
| I18N-02 | Category names support translations via a separate `category_translations` table (locale, name) | Same as CAT-03; D-10 response shape delivers this without Accept-Language server-side logic |
</phase_requirements>

---

## Summary

Phase 4 delivers a standalone `CategoriesModule` with two TypeORM entities (`CategoryEntity`, `CategoryTranslationEntity`), a service layer handling CRUD + slug derivation, a controller exposing public GET and admin-only POST/PATCH/DELETE endpoints, a TypeORM migration, and a standalone seeder script.

The technical domain is well-understood: the codebase already demonstrates the full pattern stack needed (CUID2 PKs, TypeORM decorators, guard wiring, NestJS module structure, `TestingModule` service specs, direct-instantiation controller specs). The only new moving parts are: one-to-many TypeORM relation, slug derivation via `slugify`, 409 conflict handling on unique constraint violation, and assembling the `translations` map in the response DTO.

No third-party libraries beyond `slugify` (not yet installed) are needed. All auth, guard, and decorator infrastructure is in place from earlier phases.

**Primary recommendation:** Mirror `UserEntity` for CUID2 PK, mirror `UsersModule`/`UsersService` structure for module wiring, use TypeORM `@OneToMany`/`@ManyToOne` with `eager: false` + explicit repository queries to avoid N+1, and install `slugify@1.6.9` for slug derivation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category persistence (name, slug, timestamps) | Database / Storage | — | TypeORM entity + PostgreSQL table; slug uniqueness enforced by DB unique constraint |
| Translation persistence (locale overrides) | Database / Storage | — | Separate `category_translations` table; unique constraint on (categoryId, locale) |
| Admin CRUD (create/edit/delete) | API / Backend | — | Authenticated endpoints; `RolesGuard` enforces admin role server-side |
| Public category listing | API / Backend | — | Unauthenticated GET; `@Public()` bypasses JWT guard |
| Translations map assembly | API / Backend | — | Service layer joins CategoryTranslation rows and converts array → `{ locale: name }` map before returning |
| Slug derivation | API / Backend | — | Service layer, pre-save; `slugify` utility transforms `name` → URL-safe slug |
| Slug uniqueness enforcement | Database / Storage | API / Backend | DB unique constraint is authoritative; service catches duplicate key error and rethrows as HTTP 409 |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `typeorm` | `^0.3.28` (installed) | ORM, entity decorators, migrations | Already in use; established pattern in phases 1–3 |
| `@nestjs/typeorm` | `^11.0.1` (installed) | NestJS TypeORM integration | Provides `TypeOrmModule.forFeature`, `@InjectRepository` |
| `@paralleldrive/cuid2` | `^3.3.0` (installed) | CUID2 primary key generation | Already in use per D-08 |
| `class-validator` | `^0.15.1` (installed) | DTO validation (`@IsString`, `@MaxLength`, `@Matches`, `@IsOptional`) | SEC-01 pattern — already in use |
| `class-transformer` | `^0.5.1` (installed) | Response serialization (`@Exclude`, `@Expose`) | Already in use |
| `slugify` | `1.6.9` (NOT installed — needs install) | Slug derivation from category name | Lightweight, zero-config, already matches D-04 pattern |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@nestjs/common` `ConflictException` | built-in | Throws 409 when slug collision detected | Service layer duplicate-key catch |
| `@nestjs/common` `BadRequestException` | built-in | Throws 400 if slug included in PATCH payload (planner discretion) | PATCH validation |
| `@nestjs/common` `NotFoundException` | built-in | Throws 404 on PATCH/DELETE of non-existent category | Standard pattern |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `slugify` npm package | Inline `name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')` | Inline avoids new dependency but misses Unicode normalization (accented chars like `ç` in "Música" would be dropped rather than transliterated). `slugify` handles `ç → c`, `ã → a` etc. Given the Portuguese domain, `slugify` is preferable. |

**Installation:**
```bash
pnpm add slugify
```

**Version verification:** `npm view slugify version` → `1.6.9` [VERIFIED: npm registry]

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request
    │
    ▼
CategoriesController
    │
    ├── GET /categories ──────── @Public() ─────────────────────────────────────┐
    │                                                                             │
    ├── POST /categories ─────── @Roles('admin') ──────────────────────────────┐│
    │                                                                            ││
    ├── PATCH /categories/:id ── @Roles('admin') ──────────────────────────────┤│
    │                                                                            ││
    └── DELETE /categories/:id ─ @Roles('admin') ──────────────────────────────┤│
                                                                                 ││
                                                          CategoriesService ◄────┘│
                                                               │                  │
                               ┌───────────────────────────────┤                  │
                               │                               │                  │
                               ▼                               ▼                  │
                    CategoryRepository          CategoryTranslationRepository      │
                               │                               │                  │
                               └───────────── PostgreSQL ──────┘                  │
                                         categories table                         │
                                         category_translations table              │
                                                                                  │
                                 CategoryResponseDto ◄────────────────────────────┘
                                  { id, slug, name, translations: map }
```

### Recommended Project Structure
```
src/
├── categories/
│   ├── category.entity.ts              # CategoryEntity (CUID2 PK, name, slug, timestamps)
│   ├── category-translation.entity.ts  # CategoryTranslationEntity (FK, locale, name)
│   ├── categories.module.ts            # TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])
│   ├── categories.service.ts           # CRUD + slug derivation + translations map assembly
│   ├── categories.controller.ts        # REST endpoints, @Public / @Roles decorators
│   ├── dto/
│   │   ├── create-category.dto.ts      # name (required), slug (optional override)
│   │   ├── update-category.dto.ts      # name (optional), NO slug field (write-once)
│   │   └── category-response.dto.ts    # { id, slug, name, translations }
│   ├── categories.service.spec.ts
│   └── categories.controller.spec.ts
└── database/
    ├── migrations/
    │   └── {timestamp}-categories.ts   # categories + category_translations tables
    └── seeds/
        └── categories.seed.ts          # standalone seeder script
```

### Pattern 1: CategoryEntity with CUID2 PK
**What:** TypeORM entity mirroring `UserEntity`/`EventEntity` CUID2 pattern. `@BeforeInsert` fires on `save()` but NOT on `repository.upsert()` — use explicit `createId()` in service for upsert paths.
**When to use:** All new entities in this project (D-08).

```typescript
// Source: mirrors src/users/user.entity.ts [VERIFIED: codebase]
import { createId } from '@paralleldrive/cuid2';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('categories')
export class CategoryEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = createId();
  }
}
```

### Pattern 2: CategoryTranslationEntity with ManyToOne relation
**What:** Child entity with FK back to `CategoryEntity`. Unique constraint on `(categoryId, locale)` enforced at DB level (D-06).
**When to use:** Translation tables with category ownership.

```typescript
// Source: TypeORM docs — one-to-many relation pattern [CITED: typeorm.io/docs/relations]
import { createId } from '@paralleldrive/cuid2';
import { BeforeInsert, Column, Entity, Index, ManyToOne, PrimaryColumn } from 'typeorm';
import { CategoryEntity } from './category.entity';

@Entity('category_translations')
@Index(['categoryId', 'locale'], { unique: true })  // D-06: unique constraint on (categoryId, locale)
export class CategoryTranslationEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 30 })
  categoryId: string;

  @Column({ type: 'varchar', length: 10 })  // BCP-47 e.g. 'pt', 'fr', 'en-US'
  locale: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @ManyToOne(() => CategoryEntity, { onDelete: 'CASCADE' })
  category: CategoryEntity;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = createId();
  }
}
```

### Pattern 3: Slug derivation with slugify
**What:** Derive URL-safe slug from `name`. `slugify` handles Unicode transliteration (critical for Portuguese names like "Música", "Exposições").
**When to use:** `CategoriesService.create()` when no explicit slug is provided.

```typescript
// Source: slugify@1.6.9 npm package [VERIFIED: npm registry]
import slugify from 'slugify';

function deriveSlug(name: string): string {
  return slugify(name, { lower: true, strict: true });
  // strict: true removes chars not matching [a-z0-9-], satisfies D-04 pattern ^[a-z0-9-]+$
  // Example: "Visual Arts" → "visual-arts", "Música" → "musica", "Exposições" → "exposicoes"
}
```

### Pattern 4: 409 Conflict on unique constraint violation
**What:** TypeORM throws a `QueryFailedError` when a unique constraint is violated. Catch this specific error in the service and rethrow as NestJS `ConflictException` (D-03).
**When to use:** `create()` call when slug already exists.

```typescript
// Source: TypeORM error handling pattern [ASSUMED — common NestJS pattern]
import { ConflictException } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';

async create(dto: CreateCategoryDto): Promise<CategoryEntity> {
  const slug = dto.slug ?? deriveSlug(dto.name);
  const entity = this.categoryRepository.create({ id: createId(), name: dto.name, slug });
  try {
    return await this.categoryRepository.save(entity);
  } catch (err) {
    if (err instanceof QueryFailedError && (err as any).code === '23505') {
      throw new ConflictException(`Slug '${slug}' is already taken`);
    }
    throw err;
  }
}
```

> Note: PostgreSQL unique violation error code is `23505`. TypeORM exposes this via `(err as any).code` on the `QueryFailedError`. [VERIFIED: PostgreSQL docs error codes]

### Pattern 5: Translations map assembly in service
**What:** Fetch translations as array from repository; reduce to `{ locale: name }` map before returning response DTO.
**When to use:** `findAll()` in `CategoriesService` for `GET /categories`.

```typescript
// Source: derived from D-10 [VERIFIED: CONTEXT.md]
interface CategoryResponseItem {
  id: string;
  slug: string;
  name: string;
  translations: Record<string, string>;
}

// In service:
const categories = await this.categoryRepository.find({ relations: ['translations'] });
return categories.map(cat => ({
  id: cat.id,
  slug: cat.slug,
  name: cat.name,
  translations: Object.fromEntries(cat.translations.map(t => [t.locale, t.name])),
}));
```

> Important: use `find({ relations: ['translations'] })` to avoid N+1 queries. Do NOT use `eager: true` on the entity — eager loading applies to ALL repository queries including CRUD operations where translations are not needed.

### Pattern 6: Module wiring with two entities
**What:** `TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])` registers both repositories. Add `CategoriesModule` to `app.module.ts` entities array and imports.
**When to use:** Any NestJS module with multiple TypeORM entities.

```typescript
// Source: mirrors src/users/users.module.ts [VERIFIED: codebase]
@Module({
  imports: [TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])],
  providers: [CategoriesService],
  controllers: [CategoriesController],
})
export class CategoriesModule {}
```

Also update `app.module.ts`:
1. Add `CategoryEntity`, `CategoryTranslationEntity` to `entities: [...]` array in `TypeOrmModule.forRootAsync`
2. Add `CategoriesModule` to `imports: [...]`

### Pattern 7: Standalone TypeORM seeder
**What:** A standalone script (not a NestJS app bootstrap) that connects via `AppDataSource`, inserts seed rows, and disconnects. Added to `package.json` scripts.
**When to use:** Reference data seeding that should not run with every migration.

```typescript
// Source: mirrors src/database/data-source.ts pattern [VERIFIED: codebase]
import 'dotenv/config';
import { AppDataSource } from '../database/data-source';
import { CategoryEntity } from '../categories/category.entity';
import { CategoryTranslationEntity } from '../categories/category-translation.entity';
import { createId } from '@paralleldrive/cuid2';

const SEED_CATEGORIES = [
  { name: 'Music', slug: 'music', translations: [{ locale: 'pt', name: 'Música' }] },
  // ... (full list in D-13/D-14)
];

async function seed() {
  await AppDataSource.initialize();
  const catRepo = AppDataSource.getRepository(CategoryEntity);
  const transRepo = AppDataSource.getRepository(CategoryTranslationEntity);
  for (const data of SEED_CATEGORIES) {
    const cat = catRepo.create({ id: createId(), name: data.name, slug: data.slug });
    const saved = await catRepo.save(cat);
    for (const t of data.translations) {
      await transRepo.save(transRepo.create({ id: createId(), categoryId: saved.id, locale: t.locale, name: t.name }));
    }
  }
  await AppDataSource.destroy();
}

seed().catch(err => { console.error(err); process.exit(1); });
```

The seeder script runs via `ts-node` since the rest of the migration tooling uses `dist/`. A `pnpm seed:categories` script can point to `ts-node -r tsconfig-paths/register src/database/seeds/categories.seed.ts`.

### Anti-Patterns to Avoid

- **`eager: true` on translations relation:** Loads translations for every repository query (including admin CRUD). Use explicit `find({ relations: ['translations'] })` only where the map is needed (GET /categories).
- **`synchronize: true` in production:** Already guarded in `app.module.ts` — do not change. Always generate and run an explicit migration for `categories` and `category_translations` tables.
- **Calling `repository.save()` without `createId()` explicitly:** `@BeforeInsert` does NOT fire on `repository.upsert()`. Always pre-generate id in service. For the seeder which uses `save()`, `@BeforeInsert` does fire — but being explicit is safer.
- **Building the translations map in the controller:** Belongs in the service layer; controller only serializes the DTO.
- **Accepting slug in PATCH DTO:** Write-once (D-02). Either omit `slug` from `UpdateCategoryDto` entirely (planner's preferred approach since class-validator `@IsOptional` would still pass it through) or add explicit logic to strip/reject it.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Slug derivation | Custom regex replace chain | `slugify` npm package | Unicode transliteration for Portuguese accents (`ç`, `ã`, `õ`) — custom regex drops accented characters silently; `slugify` transliterates correctly |
| Unique constraint error detection | Check existence before insert (TOCTOU race) | Catch `QueryFailedError` with code `23505` | Check-then-insert has a race condition; let the DB enforce the constraint and catch the error |
| Role enforcement | Custom middleware checking JWT claims | `@Roles('admin')` + existing `RolesGuard` | Guard already wired globally from Phase 2; just decorate the handler |
| Public route bypass | Separate router prefix for public routes | `@Public()` decorator | Decorator already implemented from Phase 2 |

**Key insight:** All guard and auth infrastructure is already in place. Phase 4 is purely additive — new module, no guard changes needed.

---

## Common Pitfalls

### Pitfall 1: Forgetting to register new entities in app.module.ts
**What goes wrong:** `CategoriesModule` works in isolation but TypeORM throws "Entity metadata for CategoryEntity#0 was not found" at runtime because `entities: [UserEntity, EventEntity]` in `app.module.ts` does not include the new entities.
**Why it happens:** `TypeOrmModule.forRootAsync` has an explicit `entities` array — new entities must be added there AND in `TypeOrmModule.forFeature([])`.
**How to avoid:** Update `app.module.ts` `entities` array to include `CategoryEntity` and `CategoryTranslationEntity` when wiring the module.
**Warning signs:** App starts but throws entity-not-found errors on first request.

### Pitfall 2: @BeforeInsert not firing on upsert
**What goes wrong:** `id` stays undefined when calling `repository.upsert()`.
**Why it happens:** TypeORM lifecycle hooks (`@BeforeInsert`) do not fire on the upsert code path — only on `repository.save()` with a new entity.
**How to avoid:** Always call `createId()` explicitly in the service before `save()` or `upsert()`. This is already documented in `users.service.ts`. [VERIFIED: codebase comment]
**Warning signs:** `id` is null/undefined in the DB row; TypeORM throws a PK constraint error.

### Pitfall 3: N+1 query on GET /categories
**What goes wrong:** 10 categories → 10 extra queries to fetch translations for each.
**Why it happens:** Using `eager: true` on the relation, or fetching categories then looping to call `find({ where: { categoryId } })` for each.
**How to avoid:** Single `find({ relations: ['translations'] })` call — TypeORM generates a LEFT JOIN in one query.
**Warning signs:** Slow GET /categories in development with logging:true; N+1 queries visible in logs.

### Pitfall 4: Slug collision on seeder re-run
**What goes wrong:** Re-running `pnpm seed:categories` inserts duplicate slug rows, causing 409 or DB unique constraint violation.
**Why it happens:** Seeder does a plain `save()` without checking for existing data.
**How to avoid:** Use `upsert` with `conflictPaths: ['slug']` in the seeder, or add a guard `if (await catRepo.findOne({ where: { slug } })) continue;` at the start of each iteration.
**Warning signs:** Seeder exits with PostgreSQL unique violation error on second run.

### Pitfall 5: `slugify` ESM-only import in CommonJS context
**What goes wrong:** `import slugify from 'slugify'` compiles but throws at runtime: "slugify is not a function" or module loading error.
**Why it happens:** Some versions of `slugify` ship ESM-only. Version 1.6.9 ships CJS-compatible build and works with `require`/`import`.
**How to avoid:** Use `slugify@1.6.9` (latest stable as of verification). If import errors appear, add `"slugify"` to `transformIgnorePatterns` in jest config (similar to existing `@paralleldrive/cuid2` entry).
**Warning signs:** Works in app but fails in Jest tests with "SyntaxError: Cannot use import statement" or "slugify is not a function".

### Pitfall 6: UpdateCategoryDto silently accepting slug
**What goes wrong:** Admin sends `{ "name": "Rock Music", "slug": "rock-music" }` to PATCH endpoint. The slug changes, violating D-02.
**Why it happens:** If `UpdateCategoryDto` extends `PartialType(CreateCategoryDto)`, the slug field is inherited as optional.
**How to avoid:** Do NOT extend `PartialType(CreateCategoryDto)` for the update DTO. Define `UpdateCategoryDto` independently with only `name` (optional). Or if extending, explicitly override slug with a private/omitted type.
**Warning signs:** Integration test shows slug changing after PATCH; regression in write-once invariant.

---

## Code Examples

### CreateCategoryDto
```typescript
// Source: class-validator patterns + D-04, D-09 [VERIFIED: CONTEXT.md + codebase conventions]
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // Optional explicit slug override (D-01). If absent, service derives from name.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9-]+$/, { message: 'slug must be lowercase alphanumeric with hyphens' })
  slug?: string;
}
```

### UpdateCategoryDto (independent — no slug field)
```typescript
// Source: D-02 write-once slug decision [VERIFIED: CONTEXT.md]
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
  // slug intentionally omitted — write-once after creation (D-02)
}
```

### Migration raw SQL pattern (mirrors Baseline migration style)
```typescript
// Source: mirrors src/database/migrations/1745000000000-baseline.ts [VERIFIED: codebase]
public async up(queryRunner: QueryRunner): Promise<void> {
  await queryRunner.query(`
    CREATE TABLE "categories" (
      "id"        varchar(30)  NOT NULL,
      "name"      varchar(100) NOT NULL,
      "slug"      varchar(100) NOT NULL,
      "createdAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ  NOT NULL DEFAULT now(),
      CONSTRAINT "PK_categories" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_categories_name" UNIQUE ("name"),
      CONSTRAINT "UQ_categories_slug" UNIQUE ("slug")
    )
  `);
  await queryRunner.query(`
    CREATE TABLE "category_translations" (
      "id"         varchar(30)  NOT NULL,
      "categoryId" varchar(30)  NOT NULL,
      "locale"     varchar(10)  NOT NULL,
      "name"       varchar(100) NOT NULL,
      CONSTRAINT "PK_category_translations" PRIMARY KEY ("id"),
      CONSTRAINT "FK_category_translations_category"
        FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE,
      CONSTRAINT "UQ_category_translations_cat_locale"
        UNIQUE ("categoryId", "locale")
    )
  `);
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Prisma (was used in Phase 1) | TypeORM (migrated in Phase 1.1) | Phase 1.1 | All entity code uses TypeORM decorators, not Prisma schema |
| `synchronize: true` during dev | Explicit migrations always | Phase 1 decision | Never change; use `migration:generate` + `migration:run` |

**Deprecated/outdated:**
- Prisma `schema.prisma` references: superseded by TypeORM entity files. The existing `prisma/` directory (if still present) is inactive.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PostgreSQL unique constraint violation error code is `23505` | Pattern 4 — 409 conflict handling | If code is different, slug collision would throw unhandled error instead of 409. Mitigated: `23505` is documented PostgreSQL standard; low risk. |
| A2 | `slugify@1.6.9` ships CJS-compatible build (no ESM-only issue) | Pitfall 5 / Standard Stack | If ESM-only, Jest tests break; requires `transformIgnorePatterns` addition. Easy to fix at implementation time. |
| A3 | `@BeforeInsert` fires on `repository.save()` for new entities (not on `upsert()`) | Pattern 1, Pitfall 2 | Confirmed by existing codebase comment in `users.service.ts` [VERIFIED: codebase] — not actually assumed |

---

## Open Questions (RESOLVED)

1. **PATCH with slug: 400 or silent ignore?**
   - What we know: D-02 says slug is write-once; planner decides 400 vs. silent ignore.
   - What's unclear: 400 is more explicit and helps API consumers detect bugs; silent ignore is simpler.
   - RESOLVED: Return 400 `BadRequestException('slug is immutable after creation')` — explicit feedback is better API ergonomics than silent data loss. Implemented in plan 04-04 Task 2.

2. **GET /categories/:slug single-category endpoint?**
   - What we know: Not in roadmap but flagged as planner's discretion in CONTEXT.md.
   - What's unclear: Whether downstream consumers (Phase 6+ event creation) will need it.
   - RESOLVED: Omit — Phase 6 can look up by slug at that time. Not included in plans.

3. **Seeder script name?**
   - What we know: D-15 suggests `pnpm seed:categories`.
   - RESOLVED: Use `seed:categories` in `package.json` scripts, pointing to `ts-node -r tsconfig-paths/register src/database/seeds/categories.seed.ts`. Implemented in plan 04-03 Task 2.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | Migrations, seeder | ✓ (assumed via DATABASE_URL in .env) | — | — |
| `slugify` npm package | Slug derivation | ✗ (not installed) | 1.6.9 (latest) | Inline regex (loses Unicode transliteration for Portuguese) |
| `ts-node` | Seeder script execution | ✓ | present in devDependencies | — |
| `tsconfig-paths` | Seeder + migration script path aliases | ✓ | present in devDependencies | — |

**Missing dependencies with no fallback:**
- `slugify` — must be installed before implementation: `pnpm add slugify`

**Missing dependencies with fallback:**
- None beyond slugify.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30.x + ts-jest |
| Config file | `package.json` → `"jest"` key |
| Quick run command | `pnpm test -- --testPathPattern=categories` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | `CategoriesService.findAll()` returns categories with slug | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-01 | `GET /categories` controller calls `service.findAll()` | unit | `pnpm test -- --testPathPattern=categories.controller` | ❌ Wave 0 |
| CAT-02 | `create()` saves entity and returns it | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-02 | `create()` returns 409 on slug collision | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-02 | `update()` ignores/rejects slug field | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-02 | `delete()` removes category and cascades translations | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-03 / I18N-02 | `findAll()` response includes `translations` map | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |
| CAT-03 / I18N-02 | POST body can include translations array; translations persisted | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ Wave 0 |

**Controller spec pattern:** Direct instantiation (no `TestingModule`) — mirrors `webhooks.controller.spec.ts`.
**Service spec pattern:** `TestingModule` + `getRepositoryToken(CategoryEntity)` + `getRepositoryToken(CategoryTranslationEntity)` mock repositories — mirrors `users.service.spec.ts`.

### Sampling Rate
- **Per task commit:** `pnpm test -- --testPathPattern=categories`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/categories/categories.service.spec.ts` — RED stub, covers CAT-01, CAT-02, CAT-03, I18N-02
- [ ] `src/categories/categories.controller.spec.ts` — RED stub, covers CAT-01, CAT-02 controller layer
- [ ] `pnpm add slugify` — install before Wave 1 implementation begins

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | Auth0 JWT handled by existing `JwtAuthGuard` globally |
| V3 Session Management | no | Stateless JWT — no session |
| V4 Access Control | yes | `@Roles('admin')` + `RolesGuard` (globally registered from Phase 2) |
| V5 Input Validation | yes | `class-validator` + `ValidationPipe` whitelist mode — DTO decorators on all create/update inputs |
| V6 Cryptography | no | No new crypto in this phase |

### Known Threat Patterns for this Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Oversized string input to DB column | Tampering / DoS | `@MaxLength(100)` on all DTO string fields + `varchar(100)` DB column (SEC-01) |
| Slug injection (special chars) | Tampering | `@Matches(/^[a-z0-9-]+$/)` on explicit slug field; `slugify(name, { strict: true })` on derived slug |
| Unauthorized category mutation | Elevation of Privilege | `@Roles('admin')` decorator on POST/PATCH/DELETE; `RolesGuard` checks `user.roles` from JWT claims |
| Slug collision race condition | Tampering | DB unique constraint on `slug` column is the authoritative guard; `catch QueryFailedError code 23505` → 409 |

---

## Project Constraints (from CLAUDE.md)

| Directive | Implication for Phase 4 |
|-----------|------------------------|
| Functions: 4-20 lines; split if longer | `CategoriesService` methods must stay focused; slug derivation, collision handling, translations map assembly each in their own private helper if needed |
| Files: under 500 lines | Split `categories.service.ts` if CRUD + translations map + seeder logic approaches limit |
| Names: specific, unique (< 5 grep hits) | Use `CategoryTranslationEntity` not `TranslationEntity`; `deriveSlug` not `toSlug` |
| Types: explicit, no `any` | Catch `QueryFailedError` must be properly typed; `translations` map typed as `Record<string, string>` |
| Every new function gets a test | `deriveSlug` utility function needs a test; service methods each get at least one |
| Mock external I/O with named fake classes | Repository mocks use named const (e.g., `const mockCategoryRepository = { ... }`) not inline stubs |
| No `any` in types | `(err as any).code === '23505'` is acceptable as a narrowing cast for untyped TypeORM error; document why |
| Inject dependencies through constructor | `CategoriesService` receives `Repository<CategoryEntity>` and `Repository<CategoryTranslationEntity>` via `@InjectRepository` |
| No agent co-authoring | All commits authored by human |

---

## Sources

### Primary (HIGH confidence)
- `src/users/user.entity.ts` — CUID2 PK pattern [VERIFIED: codebase]
- `src/users/users.module.ts` — Module structure [VERIFIED: codebase]
- `src/users/users.service.ts` — Service pattern, upsert + `createId()` explicit call [VERIFIED: codebase]
- `src/database/migrations/1745000000000-baseline.ts` — Migration raw SQL style [VERIFIED: codebase]
- `src/app.module.ts` — entities array registration requirement [VERIFIED: codebase]
- `src/auth/decorators/roles.decorator.ts` — `@Roles('admin')` decorator [VERIFIED: codebase]
- `src/auth/decorators/public.decorator.ts` — `@Public()` decorator [VERIFIED: codebase]
- `src/auth/guards/roles.guard.ts` — RolesGuard implementation [VERIFIED: codebase]
- `.planning/phases/04-categories/04-CONTEXT.md` — All D-0x decisions [VERIFIED: codebase]
- `npm view slugify version` → `1.6.9` [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `package.json` dependencies + jest config — existing libraries and test setup [VERIFIED: codebase]

### Tertiary (LOW confidence)
- PostgreSQL error code `23505` for unique constraint violation — standard PostgreSQL documented behavior [CITED: postgresql.org/docs/current/errcodes-appendix.html]; not run against live DB in this session

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified via npm registry and codebase inspection
- Architecture: HIGH — patterns directly mirror existing verified codebase code
- Pitfalls: HIGH — derived from codebase comments and established patterns; one LOW item (slugify ESM) flagged
- Test patterns: HIGH — mirrors confirmed existing spec patterns in codebase

**Research date:** 2026-05-04
**Valid until:** 2026-06-04 (stable domain; TypeORM and NestJS are pinned in package.json)
