---
phase: "04-categories"
plan: "04"
subsystem: "api"
tags: ["nestjs", "typeorm", "categories", "slugify", "crud", "i18n", "tdd-green"]
dependency_graph:
  requires:
    - "04-01 (Wave 0 RED stubs — service and controller spec files)"
    - "04-02 (CategoryEntity, CategoryTranslationEntity, DTOs)"
    - "04-03 (migration and seeder — schema in place)"
  provides:
    - "CategoriesService: findAll, create (slug derivation + 409), update (404), remove (404)"
    - "CategoriesController: GET (public), POST/PATCH/DELETE (admin-only, 204 DELETE)"
    - "CategoriesModule: TypeOrmModule.forFeature with both entities"
    - "AppModule updated: CategoryEntity + CategoryTranslationEntity in entities array, CategoriesModule imported"
    - "slugify@1.6.9 installed as production dependency"
    - "All 12 category tests GREEN (8 service + 4 controller)"
  affects:
    - "04-05 (integration tests use this service and controller)"
    - "Phase 6+ (event CRUD may import CategoriesModule when attaching categories)"
tech_stack:
  added:
    - "slugify@1.6.9 — Unicode-safe slug derivation (Portuguese domain: ç→c, ã→a, õ→o)"
  patterns:
    - "Service catches QueryFailedError code 23505, rethrows as ConflictException (409)"
    - "findAll uses find({ relations: ['translations'] }) — single LEFT JOIN, no N+1"
    - "create pre-generates id with createId() (BeforeInsert unreliable on upsert paths)"
    - "Controller PATCH explicitly rejects slug field with 400 BadRequestException (write-once D-02)"
    - "DELETE returns 204 NO_CONTENT via @HttpCode(HttpStatus.NO_CONTENT)"
    - "@Public() on GET, @Roles('admin') on POST/PATCH/DELETE — no UseGuards needed (guards globally registered)"
key_files:
  created:
    - src/categories/categories.service.ts
    - src/categories/categories.controller.ts
    - src/categories/categories.module.ts
  modified:
    - src/app.module.ts
    - src/categories/categories.service.spec.ts
    - src/categories/categories.controller.spec.ts
    - package.json
    - pnpm-lock.yaml
key_decisions:
  - "slugify@1.6.9 ships CJS (no ESM issue) — transformIgnorePatterns unchanged"
  - "PATCH returns 400 on slug presence (explicit ergonomics) rather than silent strip"
  - "Service toResponseItem handles missing translations gracefully (defaults to empty object)"
  - "translationRepository injected but not directly called in service — cascade handles deletes, findAll uses join"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-04"
  tasks_completed: 2
  tasks_total: 2
  files_created: 3
  files_modified: 5
---

# Phase 4 Plan 04: Categories Wave 2 — Service, Controller, Module, AppModule Wiring

CategoriesService with slug derivation and 409 conflict handling, CategoriesController with public GET and admin-only CRUD, CategoriesModule, and AppModule wired with new entities — turning all 12 Wave 0 RED stubs GREEN.

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Install slugify, implement CategoriesService, GREEN service spec | `cdf6c90` | `categories.service.ts`, `categories.service.spec.ts`, `package.json`, `pnpm-lock.yaml` |
| 2 | Implement CategoriesController, CategoriesModule, wire AppModule, GREEN controller spec | `946b11c` | `categories.controller.ts`, `categories.module.ts`, `app.module.ts`, `categories.controller.spec.ts` |

## What Was Built

**CategoriesService (`categories.service.ts`):**
- `findAll()`: single `find({ relations: ['translations'] })` LEFT JOIN + `toResponseItem()` mapping to `{ id, slug, name, translations: Record<string, string> }` map
- `create()`: derives slug via `slugify(name, { lower: true, strict: true })` if absent; pre-generates CUID2 id; catches `QueryFailedError code 23505` → `ConflictException('Slug X is already taken')`
- `update()`: `findOneOrThrow` guard (404), patches name, saves
- `remove()`: `findOneOrThrow` guard (404), deletes by id (cascade handles translation rows)

**CategoriesController (`categories.controller.ts`):**
- `GET /categories`: `@Public()` — no JWT required (D-11)
- `POST /categories`: `@Roles('admin')` — 403 for non-admin before service call
- `PATCH /categories/:id`: `@Roles('admin')` — explicitly rejects slug in body with `400 BadRequestException` (D-02 write-once enforcement)
- `DELETE /categories/:id`: `@Roles('admin')` + `@HttpCode(204)`

**CategoriesModule (`categories.module.ts`):** Registers `TypeOrmModule.forFeature([CategoryEntity, CategoryTranslationEntity])`, declares `CategoriesController`, provides `CategoriesService`. No exports needed in Phase 4.

**AppModule (`app.module.ts`):** Added `CategoryEntity`, `CategoryTranslationEntity` to `entities` array (Pitfall 1 prevention). Added `CategoriesModule` to `imports`.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all service methods are fully implemented with real logic. No placeholder returns.

## Threat Flags

No new threat surface beyond what the plan's threat model covers. All mitigations applied:
- T-04-04-01/02/03: `@Roles('admin')` on POST/PATCH/DELETE — confirmed present (3 matches)
- T-04-04-04: `@MaxLength(100)` on DTOs from Plan 02 — already in place
- T-04-04-05: `@Matches(/^[a-z0-9-]+$/)` on CreateCategoryDto.slug + `slugify(strict: true)` — confirmed
- T-04-04-06: explicit slug rejection in PATCH handler — confirmed (`slug is immutable after creation`)
- T-04-04-07: `QueryFailedError code 23505` → `ConflictException` — confirmed
- T-04-04-08: `@Public()` on GET intentional — accepted risk, read-only public reference data

## Self-Check: PASSED

- `src/categories/categories.service.ts` — FOUND
- `src/categories/categories.controller.ts` — FOUND
- `src/categories/categories.module.ts` — FOUND
- `src/app.module.ts` contains `CategoriesModule` — FOUND
- `src/app.module.ts` contains `CategoryEntity, CategoryTranslationEntity` — FOUND
- `"slugify": "1.6.9"` in `package.json` dependencies — FOUND
- commit `cdf6c90` — FOUND
- commit `946b11c` — FOUND
- `pnpm test` → 55/55 pass, 14 suites — PASSED
- `pnpm run build` — exits 0
