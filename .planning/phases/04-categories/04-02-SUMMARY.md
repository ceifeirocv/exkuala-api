---
phase: 04-categories
plan: "02"
subsystem: database
tags: [typeorm, postgres, class-validator, cuid2, i18n]

requires:
  - phase: 04-01
    provides: Wave 0 RED stub specs for CategoriesService and CategoriesController

provides:
  - CategoryEntity TypeORM entity (categories table, CUID2 PK, name+slug varchar(100) unique)
  - CategoryTranslationEntity TypeORM entity (category_translations table, ManyToOne CASCADE, composite unique index)
  - CreateCategoryDto with optional slug + @Matches pattern guard
  - UpdateCategoryDto with name only (no slug — write-once invariant)
  - CategoryResponseItem interface with translations map shape

affects:
  - 04-03 (service + controller implementation — imports all 5 files)
  - 04-04 (migration — mirrors entity column definitions)
  - 04-05 (seeder — uses CategoryEntity and CategoryTranslationEntity)

tech-stack:
  added: []
  patterns:
    - OneToMany/ManyToOne TypeORM relation with onDelete CASCADE and eager false
    - Composite @Index on (categoryId, locale) for unique translation constraint
    - Independent UpdateCategoryDto (not extending PartialType) to enforce write-once slug

key-files:
  created:
    - src/categories/category.entity.ts
    - src/categories/category-translation.entity.ts
    - src/categories/dto/create-category.dto.ts
    - src/categories/dto/update-category.dto.ts
    - src/categories/dto/category-response.dto.ts
  modified: []

key-decisions:
  - "UpdateCategoryDto defined independently (not PartialType(CreateCategoryDto)) to prevent slug field inheritance (D-02)"
  - "eager: false on OneToMany translations to prevent N+1 on all repository queries"
  - "CategoryResponseItem as plain TypeScript interface (no class-transformer) matching current codebase style"

patterns-established:
  - "OneToMany/ManyToOne relation pattern for translation tables: eager false, onDelete CASCADE on the child side"
  - "Composite @Index at entity class level for unique constraints spanning multiple columns"
  - "Independent DTO for update operations when partial field exclusion is a correctness requirement"

requirements-completed: [CAT-01, CAT-03, I18N-02]

duration: 3min
completed: 2026-05-04
---

# Phase 4 Plan 02: Categories Summary

**TypeORM entities and DTOs establishing the type contracts for categories: CUID2 PKs, varchar(100) columns, ManyToOne CASCADE translation relation, and write-once slug enforced at the DTO layer.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-05-04T19:18:37Z
- **Completed:** 2026-05-04T19:21:36Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `CategoryEntity` with CUID2 PK, unique `name` and `slug` varchar(100) columns, and `OneToMany` to translations (eager false to prevent N+1)
- `CategoryTranslationEntity` with `ManyToOne` to `CategoryEntity` (onDelete CASCADE) and composite `@Index(['categoryId', 'locale'], { unique: true })` enforcing D-06
- Three DTOs: `CreateCategoryDto` (slug optional with `@Matches(/^[a-z0-9-]+$/)`), `UpdateCategoryDto` (no slug field — write-once D-02), and `CategoryResponseItem` interface with `translations: Record<string, string>` map

## Task Commits

Each task was committed atomically:

1. **Task 1: Create CategoryEntity and CategoryTranslationEntity** - `4662f86` (feat)
2. **Task 2: Create DTOs (create, update, response)** - `d797b9d` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/categories/category.entity.ts` - CategoryEntity: CUID2 PK, name+slug (varchar 100, unique), OneToMany translations, BeforeInsert generateId
- `src/categories/category-translation.entity.ts` - CategoryTranslationEntity: CUID2 PK, categoryId+locale+name columns, ManyToOne with CASCADE, composite @Index
- `src/categories/dto/create-category.dto.ts` - CreateCategoryDto: name required, slug optional with @Matches pattern (D-04)
- `src/categories/dto/update-category.dto.ts` - UpdateCategoryDto: name only, slug deliberately omitted (D-02 write-once)
- `src/categories/dto/category-response.dto.ts` - CategoryResponseItem interface: id, slug, name, translations map

## Decisions Made

- `UpdateCategoryDto` defined independently rather than extending `PartialType(CreateCategoryDto)` — extending would inherit the `slug` field as optional, violating the write-once invariant (D-02). Global `ValidationPipe(whitelist: true)` strips any slug sent in PATCH body as a secondary guard.
- `eager: false` on the `OneToMany` translations relation — prevents loading translations on every category query (admin CRUD operations don't need them). The service layer explicitly requests `{ relations: ['translations'] }` only on `GET /categories`.
- `CategoryResponseItem` as a plain TypeScript interface (no class-transformer decorators) — consistent with the codebase pattern of returning plain objects from the service layer.

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- Wave 1 implementation (plan 04-03) can proceed: service and controller have concrete entity and DTO types to implement against
- Wave 0 RED stubs in `categories.service.spec.ts` and `categories.controller.spec.ts` import from these files — specs will now resolve at import level (no longer fail at import)
- `slugify` package installation required before Wave 1 service implementation begins

---
*Phase: 04-categories*
*Completed: 2026-05-04*

## Self-Check: PASSED

- All 5 source files exist on disk
- SUMMARY.md exists at `.planning/phases/04-categories/04-02-SUMMARY.md`
- Task commit `4662f86` (entities) confirmed in git log
- Task commit `d797b9d` (DTOs) confirmed in git log
- `pnpm run build` exits 0 (no TypeScript errors)
