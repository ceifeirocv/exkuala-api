---
phase: 4
phase_name: "Categories"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 9
  lessons: 5
  patterns: 8
  surprises: 2
missing_artifacts:
  - "04-VERIFICATION.md"
  - "04-UAT.md"
---

# Phase 4 Learnings: Categories

## Decisions

### `UpdateCategoryDto` defined independently, not via `PartialType`
The update DTO declares only `name`; `slug` is deliberately absent.

**Rationale:** `PartialType(CreateCategoryDto)` would inherit `slug` as optional, breaking the write-once-slug invariant (D-02). An independent DTO enforces it at the type layer; `whitelist: true` strips any stray slug as a secondary guard.
**Source:** 04-02-SUMMARY.md

### Explicit `400` on slug in PATCH body, not silent strip
The controller throws `BadRequestException('slug is immutable after creation')` if a PATCH includes slug.

**Rationale:** Whitelisting would silently drop it; an explicit 400 tells the caller the field is immutable rather than letting them think the change took (D-02 ergonomics).
**Source:** 04-04-SUMMARY.md

### `eager: false` on the translations relation
The `OneToMany` translations are not eagerly loaded; the service requests `{ relations: ['translations'] }` only on `GET /categories`.

**Rationale:** Admin CRUD doesn't need translations; eager loading would add an N+1/join to every category query.
**Source:** 04-02-SUMMARY.md

### Composite unique `@Index(['categoryId','locale'])` on translations
Translation uniqueness is enforced by a composite unique index, with `ManyToOne` `onDelete: CASCADE`.

**Rationale:** One translation per (category, locale) at the DB level (D-06); CASCADE removes translations with their parent category.
**Source:** 04-02-SUMMARY.md

### `slugify(name, { lower: true, strict: true })` for Unicode-safe slugs
Slug derivation uses slugify with strict + lower.

**Rationale:** The Portuguese domain needs `ç→c`, `ã→a`, `õ→o`; `strict` drops other punctuation. slugify@1.6.9 ships CJS, so no `transformIgnorePatterns` change was needed (unlike cuid2/jose).
**Source:** 04-04-SUMMARY.md

### Map `QueryFailedError` code `23505` → `ConflictException` (409)
The service catches the Postgres unique-violation code and rethrows as 409.

**Rationale:** A duplicate slug is a client conflict, not a 500; catching the specific PG error code keeps the mapping precise.
**Source:** 04-04-SUMMARY.md

### `@Public()` on GET, `@Roles('admin')` on mutations — no `@UseGuards`
Decorators alone gate the routes; no per-route guard registration.

**Rationale:** `JwtAuthGuard`/`RolesGuard` are global `APP_GUARD`s (Phase 2); the route decorators are all that's needed. Public read of reference data is an accepted risk (T-04-04-08).
**Source:** 04-04-SUMMARY.md

### Seeder uses find-or-insert for categories (not upsert)
Categories are seeded with `findOne({ where: { slug } })` → skip-or-insert; only translations use `upsert` on `(categoryId, locale)`.

**Rationale:** `upsert({ id: createId(), ... }, { conflictPaths: ['slug'] })` emits `ON CONFLICT (slug) DO UPDATE SET id = ...`, mutating the PK and breaking the child FK from `category_translations`. Find-or-insert skips the write when the slug exists; the translation upsert is safe because it only updates `name` (D — fix in 04-05).
**Source:** 04-05-SUMMARY.md

### Seeder runs compiled `node dist/...seed.js`, not `ts-node`
The seed script builds first, then runs the compiled JS.

**Rationale:** `AppDataSource.entities` globs `dist/**/*.entity.js`; running the seeder via `ts-node` loads *source* entity classes that aren't in the dist-based metadata registry, throwing "No metadata for CategoryEntity".
**Source:** 04-05-SUMMARY.md

---

## Lessons

### `upsert` with a PK in `values` breaks FK integrity in child tables
`catRepo.upsert({ id: createId(), ... }, { conflictPaths: ['slug'] })` updates the PK on conflict; the existing child FK rows still point at the old id, so Postgres raises a FK violation.

**Context:** Use find-or-insert (not upsert) for idempotent seeds whose PK is referenced by a child FK. Upsert is only safe when the conflict update touches non-PK, non-FK-referenced columns.
**Source:** 04-05-SUMMARY.md

### `ts-node` seeders fail when `AppDataSource` uses a `dist/**` entity glob
The dist-based metadata registry has no entry for source-compiled entity classes, so `ts-node` execution throws "No metadata for <Entity>".

**Context:** Match the runtime to the entity glob — run the compiled `dist` output. A standing constraint for every standalone script (seeders, one-offs) that imports `AppDataSource`.
**Source:** 04-05-SUMMARY.md

### `@BeforeInsert` is unreliable on upsert paths — pre-generate the id
`create()` and the seeder pre-generate the cuid2 id via `createId()` rather than trusting `@BeforeInsert`.

**Context:** Fourth confirmed member of the lifecycle-hook-bypass family — `repository.insert()` (Phase 5), `repository.upsert()` (Phase 2.1), `createQueryBuilder().insert()` (Phase 8), and the seeder upsert here. Any ORM insert shortcut skips entity hooks.
**Source:** 04-04-SUMMARY.md, 04-05-SUMMARY.md

### An "idempotent" seeder is only proven idempotent by a second run
The seeder "executed exactly as written" in plan 04-03; the FK-breaking bug surfaced only when 04-05 ran it a second time.

**Context:** Idempotency claims must be tested by actually re-running — the first run is always clean. The acceptance criterion ("safe to re-run") needs the re-run, not just the assertion.
**Source:** 04-03-SUMMARY.md, 04-05-SUMMARY.md

### Jest 30 `--testPathPattern` → `--testPathPatterns` again
The plan's verify commands used the old flag; tests were RED regardless, but the command errored on the flag.

**Context:** Recurs across the whole project; invoke `jest --testPathPatterns=...` directly.
**Source:** 04-01-SUMMARY.md

---

## Patterns

### Wave 0 RED stub specs (TDD)
Service (8 stubs) and controller (4 stubs) specs import non-existent modules to fail at load before implementation.

**When to use:** Opening wave of every TDD phase — project-wide.
**Source:** 04-01-SUMMARY.md

### Independent Update DTO for write-once fields
Hand-declare the update DTO (omit immutable fields) instead of `PartialType`, when partial-field exclusion is a correctness requirement.

**When to use:** Any entity with a write-once field (slug) that must never be patchable.
**Source:** 04-02-SUMMARY.md

### `eager: false` relation + explicit `relations` on read
Keep relations lazy; request them only on the endpoint that needs them.

**When to use:** Child collections (translations) needed on public reads but not on admin CRUD.
**Source:** 04-02-SUMMARY.md

### Composite unique `@Index` for multi-column constraints
Class-level `@Index([...], { unique: true })` for uniqueness spanning multiple columns.

**When to use:** Per-locale translation rows, or any natural composite key.
**Source:** 04-02-SUMMARY.md

### `QueryFailedError 23505` → `ConflictException`
Catch the Postgres unique-violation code and map to 409.

**When to use:** Surfacing DB unique constraints as client-facing conflicts instead of 500s.
**Source:** 04-04-SUMMARY.md

### Find-or-insert for idempotent seeds with FK-referenced PKs
Skip the write when the natural key exists; only insert when absent.

**When to use:** Seeding parent rows whose PK is referenced by a child FK — never `upsert` there.
**Source:** 04-05-SUMMARY.md

### Run standalone scripts as compiled `dist` JS
Build first, run `node dist/...js` for any script importing `AppDataSource` with a `dist` entity glob.

**When to use:** Seeders, migrations runners, and one-off maintenance scripts.
**Source:** 04-05-SUMMARY.md

### Global-guard decorators only (`@Public()` / `@Roles()`)
Gate routes with decorators alone; no per-route `@UseGuards` when guards are `APP_GUARD`.

**When to use:** Public-read + admin-write resources under the Phase 2 fail-closed guard chain.
**Source:** 04-04-SUMMARY.md

---

## Surprises

### "idempotent" upsert was the thing that broke idempotency
The seeder used `upsert` *for* idempotency, but on the second run the conflict-update mutated the PK and broke the child FK — the idiom chosen to make re-runs safe is exactly what made them fail.

**Impact:** Find-or-insert was correct; upsert is unsafe whenever its conflict path can change a PK that a child table references. The "obviously idempotent" tool was actively harmful here.
**Source:** 04-05-SUMMARY.md

### A clean plan hid a re-run-only failure
Plan 04-03 created the seeder and "executed exactly as written" — green, no deviations. The FK violation and the `ts-node`/metadata error only appeared in 04-05 when the seeder was actually run (and re-run) against the live DB.

**Impact:** Another "green ≠ correct" instance, specific to scripts: a seeder/migration that compiles and commits cleanly can still be broken until executed. First execution (and re-execution) is the real test, not plan completion.
**Source:** 04-03-SUMMARY.md, 04-05-SUMMARY.md
