---
phase: "04-categories"
plan: "03"
subsystem: "database"
tags: ["migration", "seeder", "typeorm", "categories", "i18n"]
dependency_graph:
  requires:
    - "04-01 (Wave 0 TDD RED stubs — spec files exist before entities)"
    - "04-02 (category.entity.ts and category-translation.entity.ts — seeder imports them)"
  provides:
    - "categories and category_translations database schema (migration)"
    - "10 seeded cultural categories with English + Portuguese translations"
    - "pnpm seed:categories script for development and testing"
  affects:
    - "04-04 (service + controller implementation uses the migrated schema)"
    - "04-05 (integration tests use seeded data)"
tech_stack:
  added: []
  patterns:
    - "Raw SQL TypeORM migration (mirrors 1745000000000-baseline.ts style)"
    - "Standalone AppDataSource seeder with upsert idempotency"
    - "FK drop order in down(): child before parent"
key_files:
  created:
    - "src/database/migrations/1746000000000-categories.ts"
    - "src/database/seeds/categories.seed.ts"
  modified:
    - "package.json (added seed:categories script)"
decisions:
  - "Seeder uses upsert with conflictPaths rather than save() to guarantee idempotency on re-run (RESEARCH.md Pitfall 4)"
  - "down() drops category_translations before categories to satisfy FK dependency order"
  - "seed:categories runs ts-node with tsconfig-paths/register to support path aliases without a pre-build step for ts-node itself; the script still runs pnpm build first for AppDataSource entity glob resolution"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 2
  files_modified: 1
---

# Phase 04 Plan 03: Migration and Seeder Summary

TypeORM migration creating `categories` and `category_translations` tables, plus a standalone idempotent seeder inserting 10 cultural categories with English defaults and Portuguese (`pt`) translations.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create TypeORM migration — categories and category_translations | `46f68b8` | `src/database/migrations/1746000000000-categories.ts` |
| 2 | Create seeder script and add seed:categories to package.json | `ffca3fa` | `src/database/seeds/categories.seed.ts`, `package.json` |

## What Was Built

**Migration (`1746000000000-categories.ts`):** Raw SQL migration in the exact style of `1745000000000-baseline.ts`. Creates `categories` (id, name, slug, timestamps) with `UQ_categories_name` and `UQ_categories_slug` unique constraints. Creates `category_translations` (id, categoryId, locale, name) with an FK to categories (`ON DELETE CASCADE`) and a `(categoryId, locale)` unique constraint. The `down()` method drops `category_translations` before `categories` to satisfy the FK dependency order.

**Seeder (`categories.seed.ts`):** Standalone script importing `AppDataSource` directly (same pattern as `data-source.ts` — no NestJS bootstrap). Seeds 10 cultural categories: Music, Theatre, Cinema, Dance, Visual Arts, Festivals, Talks, Workshops, Comedy, Exhibitions — each with an English default name and a Portuguese (`pt`) translation. Uses `catRepo.upsert(..., { conflictPaths: ['slug'] })` and `transRepo.upsert(..., { conflictPaths: ['categoryId', 'locale'] })` so the script is idempotent and safe to re-run without duplicate-key errors.

**package.json:** Added `seed:categories` script that runs `pnpm run build` first (to ensure entity globs in `dist/` are resolved by AppDataSource) then executes the seeder via `ts-node -r tsconfig-paths/register`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — migration and seeder contain no placeholder data. All 10 categories are production-ready reference data with both English and Portuguese translations.

## Threat Flags

No new network endpoints, auth paths, or file access patterns introduced. Migration SQL is static. Seeder uses hardcoded developer-controlled data with no user input.

## Self-Check: PASSED

- `src/database/migrations/1746000000000-categories.ts` — FOUND
- `src/database/seeds/categories.seed.ts` — FOUND
- `pnpm run build` — exits 0
- commit `46f68b8` — FOUND
- commit `ffca3fa` — FOUND
- `grep "seed:categories" package.json` — FOUND
- `grep -c "locale: 'pt'" src/database/seeds/categories.seed.ts` — outputs 10
