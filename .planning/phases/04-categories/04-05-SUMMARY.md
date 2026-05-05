---
phase: "04-categories"
plan: "05"
subsystem: "database"
tags: ["typeorm", "migration", "seeder", "categories", "postgresql", "idempotent"]

requires:
  - phase: "04-04"
    provides: "CategoriesService, CategoriesController, CategoriesModule, AppModule wiring, slugify"
  - phase: "04-03"
    provides: "Migration file 1746000000000-categories.ts and categories.seed.ts seeder"
provides:
  - "categories table in PostgreSQL (id, name, slug, createdAt, updatedAt — PK, UQ_name, UQ_slug)"
  - "category_translations table in PostgreSQL (id, categoryId, locale, name — FK CASCADE, UQ cat+locale)"
  - "10 seeded categories with Portuguese translations (music/Música through exhibitions/Exposições)"
  - "pnpm seed:categories is idempotent — safe to re-run; exits 0 on first and all subsequent runs"
  - "Phase 4 fully verified: GET /api/v1/categories returns 10 categories with translations map"
affects:
  - "Phase 5+ (Organizers, Events reference categories by slug)"
  - "Phase 7 (Public Event Discovery — category filter uses slugs from this seed data)"

tech-stack:
  added: []
  patterns:
    - "Migration run pattern: pnpm run build && npx typeorm migration:run -d dist/database/data-source.js"
    - "Seeder pattern: pnpm run build && node dist/...seed.js (compiled JS, not ts-node, to match dist/ entity paths in AppDataSource)"
    - "Find-or-insert for category upsert: avoids FK breakage caused by upsert updating PK (id) on slug conflict"
    - "Translation upsert on (categoryId, locale) conflict is safe — updates name only, no PK involved"

key-files:
  created: []
  modified:
    - package.json
    - src/database/seeds/categories.seed.ts

key-decisions:
  - "seed:categories uses node dist/...seed.js not ts-node — ts-node runs source TypeScript but AppDataSource.entities points to dist/**/*.entity.js, causing 'No metadata' error"
  - "Seeder uses find-or-insert (not upsert) for categories — catRepo.upsert on slug conflict updates all provided fields including id, breaking FK on category_translations"
  - "Translation upsert on (categoryId, locale) remains safe: only name is updated on conflict, no FK reference to translation id"

patterns-established:
  - "Seeder run pattern: always run compiled JS via node dist/, not ts-node, when AppDataSource uses dist/ entity glob"
  - "Find-or-insert for idempotent seeds where id is referenced by a FK in a child table"

requirements-completed: [CAT-01, CAT-02, CAT-03, I18N-02]

duration: ~10min
completed: 2026-05-05
---

# Phase 4 Plan 05: Categories Wave 3 — Migration Run, Seed, Verification

**PostgreSQL categories + category_translations tables created via migration, 10 cultural categories seeded with Portuguese translations, API human-verified returning correct JSON shape**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-05
- **Completed:** 2026-05-05
- **Tasks:** 2 auto + 1 human checkpoint
- **Files modified:** 2

## Accomplishments

- TypeORM migration `Categories1746000000000` executed — `categories` and `category_translations` tables exist in PostgreSQL with all constraints (PK, UQ, FK CASCADE)
- 10 cultural categories seeded with Portuguese translations, idempotent on re-run
- 55/55 unit tests GREEN after schema push
- Human checkpoint approved: `GET /api/v1/categories` returns 10 categories with `translations` map per item

## Task Commits

1. **Task 1: Run migration** — DB-only operation (no source file changes; migration SQL was in `04-03`)
2. **Task 2: Run seeder + full test suite** — `16af4b8` (fix: seed script and idempotency bugs)

**Plan metadata:** (this summary commit)

## Files Created/Modified

- `package.json` — Fixed `seed:categories` script: `ts-node src/...seed.ts` → `node dist/...seed.js`
- `src/database/seeds/categories.seed.ts` — Fixed idempotency: replaced `catRepo.upsert` with find-or-insert for categories to avoid FK breakage on re-run

## Decisions Made

- Used `node dist/database/seeds/categories.seed.js` (compiled JS) instead of `ts-node` for the seeder — `AppDataSource.entities` uses `dist/**/*.entity.js` glob, so running via `ts-node` loads source-file entity classes that are not registered in the dist-based metadata registry, producing "No metadata for CategoryEntity" error.
- Used find-or-insert instead of upsert for categories — `upsert` with `conflictPaths: ['slug']` generates `ON CONFLICT (slug) DO UPDATE SET id = $newId, ...` which updates the primary key. TypeORM then tries to remap child FK rows to the new `id`, but PostgreSQL's FK constraint fires immediately, causing a violation. Find-or-insert skips the write entirely if the slug already exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seed:categories script used ts-node against TypeScript source**
- **Found during:** Task 2 (Run seeder)
- **Issue:** `pnpm seed:categories` was defined as `pnpm run build && ts-node -r tsconfig-paths/register src/database/seeds/categories.seed.ts`. The seeder imports `AppDataSource` which has `entities: ['dist/**/*.entity.js']`. When `ts-node` runs the seeder, it loads entity classes from TypeScript source — but TypeORM's metadata registry has no entry for those classes (no decorator reflection from the dist globs), throwing `No metadata for "CategoryEntity" was found`.
- **Fix:** Changed script to `pnpm run build && node dist/database/seeds/categories.seed.js` — runs the already-compiled output, matching the entity glob in `AppDataSource`.
- **Files modified:** `package.json`
- **Verification:** `pnpm seed:categories` exits 0, outputs `Seeded 10 categories.`
- **Committed in:** `16af4b8`

**2. [Rule 1 - Bug] Seeder catRepo.upsert broke FK on second run**
- **Found during:** Task 2 — idempotency check (second `pnpm seed:categories` run)
- **Issue:** `catRepo.upsert({ id: createId(), name, slug }, { conflictPaths: ['slug'] })` on slug conflict generated SQL updating ALL provided fields including `id`. PostgreSQL applied the `id` change but the existing `category_translations` rows still referenced the old `id` via FK, causing `update or delete on table "categories" violates foreign key constraint "FK_category_translations_category"`.
- **Fix:** Replaced upsert with find-or-insert: `findOne({ where: { slug } })` — if found, skip; if not, `catRepo.save(catRepo.create({ id: createId(), name, slug }))`. Translation upsert on `(categoryId, locale)` remains unchanged (safe: only updates `name`, no FK reference to translation id).
- **Files modified:** `src/database/seeds/categories.seed.ts`
- **Verification:** `pnpm seed:categories` exits 0 on first run (`Seeded 10 categories.`) and on second run (`Seeded 10 categories.`)
- **Committed in:** `16af4b8`

---

**Total deviations:** 2 auto-fixed (2x Rule 1 — Bug)
**Impact on plan:** Both fixes essential for correctness. Script fix unblocked the seeder entirely. Idempotency fix satisfied the plan's explicit acceptance criterion. No scope creep.

## Issues Encountered

None beyond the two auto-fixed bugs above.

## User Setup Required

None — no external service configuration required. Database connection uses existing `DATABASE_URL` from `.env`.

## Known Stubs

None — all 10 categories are fully seeded with real data. The API returns live data from PostgreSQL.

## Threat Flags

No new threat surface. All mitigations from the plan's threat model apply:
- T-04-05-01: Migration SQL is static, version-controlled; developer-only operation — accepted.
- T-04-05-02: Seeder data is hardcoded; idempotent via find-or-insert; developer-only — accepted.

## Self-Check

- `package.json` seed:categories script uses `node dist/...` — CONFIRMED
- `src/database/seeds/categories.seed.ts` uses find-or-insert for categories — CONFIRMED
- `categories` table exists in PostgreSQL (migration ran) — CONFIRMED (migration output)
- `category_translations` table exists in PostgreSQL — CONFIRMED (migration output)
- `pnpm seed:categories` exits 0, outputs "Seeded 10 categories." — CONFIRMED
- `pnpm seed:categories` (second run) exits 0 — CONFIRMED
- `pnpm test` → 55/55 pass, 14 suites — CONFIRMED
- commit `16af4b8` exists — CONFIRMED
- Human checkpoint approved — CONFIRMED

## Self-Check: PASSED

## Next Phase Readiness

- Phase 4 is fully complete: schema, seed data, API, and tests all verified
- `GET /api/v1/categories` is a stable public endpoint Phase 6+ (Events) can reference for category slugs
- Phase 5 (Organizers) can proceed — no Phase 4 blockers

---
*Phase: 04-categories*
*Completed: 2026-05-05*
