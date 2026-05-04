# Phase 4: Categories - Context

**Gathered:** 2026-05-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a managed, translatable category reference list. `CategoryEntity` holds the canonical (default) name and slug. `CategoryTranslationEntity` holds per-locale name overrides. Admins control the list via authenticated CRUD endpoints. `GET /api/v1/categories` always returns all categories with default name + full translations map — clients resolve locale themselves. No Accept-Language server-side resolution for categories.

**In scope:**
- `CategoryEntity` (id, name, slug, createdAt, updatedAt) + `CategoryTranslationEntity` (id, categoryId, locale, name)
- Admin CRUD: `POST /categories`, `PATCH /categories/:id`, `DELETE /categories/:id` — all require `@Roles('admin')`
- Public `GET /categories` — returns all categories with default name + translations map
- Slug: auto-derived from `name` on creation, overridable in the same payload, write-once after creation, 409 on collision
- TypeORM seeder with ~10 cultural categories, each with English + Portuguese translations
- Wave 0 TDD RED stubs → Wave 1 implementation (established project pattern)

**Out of scope:**
- Accept-Language server-side resolution (clients resolve locale from translations map)
- Category reordering / priority / display order
- Category icons or images
- Attaching categories to events (Phase 6+)
- Soft delete for categories

</domain>

<decisions>
## Implementation Decisions

### Slug Strategy

- **D-01:** Slug is auto-derived from `Category.name` on creation: lowercase, spaces → hyphens, strip non-alphanumeric-hyphen chars. If admin provides an explicit `slug` field in the create payload, that value is used instead of auto-derivation.
- **D-02:** Slug is **write-once** — immutable after creation. `PATCH /categories/:id` ignores any `slug` field in the payload (or returns 400 if slug is included, planner decides which).
- **D-03:** Slug uniqueness collision returns **HTTP 409 Conflict** with a message that includes the conflicting slug value. No auto-suffix.
- **D-04:** Slug validation: lowercase, URL-safe pattern (`^[a-z0-9-]+$`). Applied at DTO level with `@Matches`.

### Entity Structure

- **D-05:** `Category.name` is the default/primary name (English by convention). `CategoryTranslation.name` is the locale-specific override.
- **D-06:** Translations table schema: `{ id (cuid2), categoryId (FK), locale (varchar, BCP-47 tag), name (varchar) }`. Unique constraint on `(categoryId, locale)`.
- **D-07:** Locale field is an open varchar (any valid BCP-47 tag accepted) — not a DB enum. No server-side locale allowlist enforced in Phase 4.
- **D-08:** Both entities use CUID2 primary keys (established pattern from `UserEntity`).
- **D-09:** All string columns have explicit `VarChar` lengths; DTOs mirror with `@MaxLength` (SEC-01 pattern).

### i18n Response Shape

- **D-10:** `GET /categories` response shape per item:
  ```json
  {
    "id": "...",
    "slug": "live-music",
    "name": "Live Music",
    "translations": { "pt": "Música ao Vivo", "fr": "Musique Live" }
  }
  ```
  `name` = default (entity-level). `translations` = map of `{ locale: name }` for all available `CategoryTranslation` rows.
- **D-11:** No Accept-Language header processing for categories. Server always returns full translations map. Clients resolve their preferred locale client-side.
- **D-12:** ROADMAP success criterion #3 (*"Accept-Language: pt returns Portuguese names"*) is superseded by this decision. The translations map satisfies the intent — clients can trivially extract `translations["pt"]`. Update ROADMAP criterion accordingly when planning.

### Seed Data

- **D-13:** Phase 4 ships a TypeORM seeder (~10 cultural categories): music, theatre, cinema, dance, visual arts, festivals, talks, workshops, comedy, exhibitions.
- **D-14:** Seed includes both English default names and Portuguese (`pt`) translations for every category.
- **D-15:** Seeder runs as a separate script (not part of migration). Command: `pnpm seed:categories` (or equivalent — planner decides exact script name).

### Claude's Discretion

- Whether `PATCH` with a slug field returns 400 or silently ignores it
- Exact `VarChar` lengths for `name` (suggestion: 100) and `locale` (suggestion: 10)
- Whether `GET /categories/:slug` (single category by slug) endpoint is included — not in roadmap but trivial to add; planner may include if needed for downstream
- Exact seeder script command name

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 4 goal, success criteria, and plan stubs (CAT-01, CAT-02, CAT-03, I18N-02)
- `.planning/REQUIREMENTS.md` — CAT-01 (managed list), CAT-02 (admin CRUD), CAT-03 (translations table), I18N-02 (category_translations table + locale fallback)
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar lengths + @MaxLength)

### Prior Phase Context
- `.planning/phases/03-users/03-CONTEXT.md` — Established entity patterns (CUID2 PK, VarChar lengths, TypeORM decorators)
- `.planning/phases/02-auth-infrastructure/02-CONTEXT.md` — `@Roles('admin')` guard pattern, `@Public()` decorator

### Existing Code to Extend or Mirror
- `src/users/user.entity.ts` — CUID2 PK pattern, TypeORM decorator style to mirror for `CategoryEntity`
- `src/auth/auth.module.ts` — Guard wiring pattern (`JwtAuthGuard` + `RolesGuard` global registration)
- `src/users/users.module.ts` — Module structure pattern (providers, exports)

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/users/user.entity.ts` — CUID2 `@BeforeInsert` PK generation; copy this pattern for `CategoryEntity` and `CategoryTranslationEntity`
- `src/auth/decorators/` — `@Roles('admin')` and `@Public()` decorators already implemented; use directly on category controller methods
- `@paralleldrive/cuid2` — already installed; `createId()` available for new entity IDs

### Established Patterns
- `@Entity`, `@Column({ type: 'varchar', length: N })`, `@PrimaryColumn`, `@CreateDateColumn`, `@UpdateDateColumn` — TypeORM decorator style from `UserEntity`
- `forRootAsync` / `TypeOrmModule.forFeature([])` — module wiring established in Phase 1.1
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation — established TDD contract
- Controller spec: direct instantiation (no `TestingModule`); service spec: `TestingModule` + `getRepositoryToken`

### Integration Points
- `src/app.module.ts` — Add `CategoriesModule` to `imports[]`
- New module: `src/categories/` — `CategoryEntity`, `CategoryTranslationEntity`, `CategoriesModule`, `CategoriesService`, `CategoriesController`
- Migration: new TypeORM migration for `categories` and `category_translations` tables

</code_context>

<specifics>
## Specific Ideas

- Translations map in response (not array) — `{ "pt": "Música ao Vivo" }` not `[{ locale: "pt", name: "..." }]`. Clients access by key, no looping needed.
- Slug derivation: use a slugify utility (e.g., `slugify` npm package or inline implementation); planner picks. Result must pass `^[a-z0-9-]+$` validation.
- Seed categories (English / Portuguese): music/música, theatre/teatro, cinema/cinema, dance/dança, visual arts/artes visuais, festivals/festivais, talks/palestras, workshops/workshops, comedy/comédia, exhibitions/exposições.

</specifics>

<deferred>
## Deferred Ideas

- Accept-Language server-side resolution for categories — skipped in favor of full translations map (client resolves). Revisit for events in Phase 7 (I18N-01, I18N-03) where server-side resolution IS scoped.
- Category soft delete — not needed for MVP reference list.
- Category display ordering / priority field.
- GET /categories/:slug endpoint — not in roadmap scope; planner may add if trivial.

</deferred>

---

*Phase: 04-categories*
*Context gathered: 2026-05-04*
