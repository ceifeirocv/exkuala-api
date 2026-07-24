---
phase: 7
phase_name: "Public Event Discovery"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 9
  lessons: 6
  patterns: 7
  surprises: 2
missing_artifacts:
  - "07-VERIFICATION.md"
  - "07-UAT.md"
---

# Phase 7 Learnings: Public Event Discovery

## Decisions

### Composite PK `(eventId, locale)` on `EventTranslationEntity`
Translation rows use a natural composite primary key — no surrogate `id`, no `@BeforeInsert`/`createId()`.

**Rationale:** `(eventId, locale)` is the natural upsert key (D-01); a surrogate id would add nothing and complicate the `conflictPaths` upsert.
**Source:** 07-02-SUMMARY.md, 07-03-SUMMARY.md

### Client-side i18n via a full translations map per response
Every event response carries `translations: Record<locale, {title, description}>`; the client resolves the locale, not the server.

**Rationale:** Avoids per-request `Accept-Language` negotiation server-side and lets clients cache one payload across locales (D-01); implemented via `buildTranslationsMap()`.
**Source:** 07-02-SUMMARY.md, 07-04-SUMMARY.md

### `searchVector` column is `select:false`, maintained only by DB triggers
The `tsvector` column is never written by TypeORM and is excluded from default SELECTs.

**Rationale:** Full-text vector maintenance belongs in the DB where both default and translated content can be aggregated atomically (D-04); excluding it from SELECT avoids shipping the vector to clients.
**Source:** 07-02-SUMMARY.md, 07-03-SUMMARY.md

### DB-side `tsvector` maintenance via two triggers
A BEFORE INSERT/UPDATE trigger on `events` sets `NEW.search_vector`; an AFTER INSERT/UPDATE/DELETE trigger on `event_translations` recomputes the parent event's vector.

**Rationale:** Keeps the search index consistent across both tables without application-layer write coordination; the AFTER trigger covers translation deletes too.
**Source:** 07-03-SUMMARY.md

### Functional `LOWER(city)` index for case-insensitive prefix filter
A functional index on `LOWER(city)` backs `WHERE LOWER(city) LIKE LOWER(:city) || '%'`.

**Rationale:** A plain `city` index can't serve a case-insensitive `LOWER()` predicate via index scan; the functional index does (D-09).
**Source:** 07-03-SUMMARY.md, 07-04-SUMMARY.md

### Two controllers on one module at different prefixes
`EventsController` (OrganizerGuard, `organizer/events`) and `PublicEventsController` (`@Public()`, `events`) both live in EventsModule.

**Rationale:** Separates authenticated organizer CRUD from unauthenticated public discovery without route conflict, since the prefixes differ; class-level `@Public()` bypasses the global JWT guard cleanly.
**Source:** 07-05-SUMMARY.md

### Parametrized `plainto_tsquery('simple', :q)` for search
Full-text queries pass user input only as a bound parameter to `plainto_tsquery`.

**Rationale:** No string interpolation into SQL — eliminates the injection path on the search filter (D-07).
**Source:** 07-04-SUMMARY.md

### `findPublishedOrThrow` returns 404 for non-published or non-existent
Detail lookups for unpublished or missing events return 404, mirroring `findOwnedOrThrow`.

**Rationale:** A 403-vs-404 distinction would leak the existence of unpublished events to anonymous callers (EVT-04, no info leakage).
**Source:** 07-04-SUMMARY.md

### `organizerId` always sourced from the guard-resolved entity
Translation upsert takes `organizerId` from `@CurrentOrganizer()`, never from the request body.

**Rationale:** Prevents an organizer from writing translations on another organizer's event by spoofing a body field (T-07-05-03).
**Source:** 07-05-SUMMARY.md

---

## Lessons

### Jest 30 renamed `--testPathPattern` → `--testPathPatterns`
`pnpm test -- --testPathPattern=...` silently matched 0 files under Jest 30; the run looked green because nothing ran.

**Context:** Verification had to use `npx jest --testPathPatterns=...`. A silent 0-match is worse than a failure — confirm the suite count, not just the exit code.
**Source:** 07-01-SUMMARY.md

### `OrganizerEntity` has no `bio`/`contact` fields — D-11 was aspirational
The detail DTO's `organizer.bio`/`organizer.contact` mapped to `null` because the entity only has `description`/`email`/`website`/`socialLinks`.

**Context:** A planning decision (D-11) assumed entity fields that never existed; `toPublicDetailDto` coalesces to null pending a future entity extension. Validate DTO-to-entity field assumptions against the actual entity before planning the mapping.
**Source:** 07-04-SUMMARY.md

### Neon does not expose `tsvector_agg` despite reporting PG 17
The migration aggregated translation vectors with `tsvector_agg()`, which passed on local PG 17.8 but is unavailable on Neon (the production host) — FTS had to be reworked to `string_agg + to_tsvector`.

**Context:** "PostgreSQL 14+" was treated as sufficient, but a managed host can omit functions present in stock Postgres. Verify FTS helpers against the actual deployment target, not just a local instance.
**Source:** .planning/STATE.md (Phase 07 decisions)

### TypeORM `orderBy('alias."camelCol"')` fails at runtime
Quoting a camelCase column in `orderBy` compiles fine but throws at query time; the fix is the unquoted property-name form `orderBy('alias.prop')`.

**Context:** A runtime-only failure that unit tests with mocked query builders do not catch — needs a live DB query in verification.
**Source:** .planning/STATE.md (Phase 07 decisions)

### Snake_case migration columns need `name:'snake_case'` on the entity
When a migration creates a snake_case column, the entity `@Column` must set `name: 'snake_case'`; otherwise TypeORM sync creates a duplicate camelCase column.

**Context:** Entity/migration column-name parity is required or dev-sync silently adds a second column.
**Source:** .planning/STATE.md (Phase 07 decisions)

### No naming strategy means camelCase property names in raw query builders
`searchVector` is referenced as `event."searchVector"` in query builders because no snake_case naming strategy is configured.

**Context:** Raw column references in QueryBuilder must match TypeORM's default (property name), not the DB column name — a recurring trap when hand-writing SQL fragments.
**Source:** 07-04-SUMMARY.md

---

## Patterns

### Wave 0 TDD RED stub via import-level compile failure
Spec files import not-yet-existing source modules so the suite fails at compile time, guaranteeing the test cannot pass before implementation.

**When to use:** Opening wave of any TDD phase, to establish a verifiable RED baseline distinct from assertion failures.
**Source:** 07-01-SUMMARY.md

### `makeQb()` factory for isolated query-builder mocks
Return a fresh mock query builder per test instead of sharing one instance.

**When to use:** Any service spec asserting `andWhere`/`where` call counts, to prevent state bleed between tests.
**Source:** 07-01-SUMMARY.md

### `buildTranslationsMap()` reduce helper
Reduce `EventTranslationEntity[]` into `Record<locale, {title, description}>` for every response.

**When to use:** Serving client-side-resolved i18n content where the full locale set ships per item.
**Source:** 07-04-SUMMARY.md

### `COALESCE(NEW.eventId, OLD.eventId)` in mutation triggers
Handle DELETE rows (where `NEW` is NULL) by coalescing to `OLD` inside the trigger function.

**When to use:** AFTER INSERT/UPDATE/DELETE triggers that must reference the affected row's key across all three operations.
**Source:** 07-03-SUMMARY.md

### Class-level `@Public()` to bypass the global JWT guard
Decorate the whole controller `@Public()` to make all its routes unauthenticated without per-route decoration.

**When to use:** A controller whose every route is public, alongside guarded controllers under a globally-registered `JwtAuthGuard`.
**Source:** 07-05-SUMMARY.md

### Stepwise migration with mirrored reversible `down()`
Comment each `queryRunner.query()` as "Step N"; `down()` reverses `up()` in exact reverse order with `IF EXISTS` guards on every DROP.

**When to use:** Multi-statement migrations (DDL + indexes + triggers) where partial rollback safety matters.
**Source:** 07-03-SUMMARY.md

### Reused composite cursor key across listings
The same `(startAt, id)` composite cursor encoding serves both the public and organizer event listings.

**When to use:** Multiple paginated endpoints over the same ordered entity — share the encode/decode helpers rather than duplicating cursor logic.
**Source:** 07-04-SUMMARY.md

---

## Surprises

### A migration that "ran successfully" locally was incompatible with production
`migration:run` exited 0 on local PG 17.8 and 07-06 recorded the phase green, but the `tsvector_agg()` dependency does not exist on Neon (same major version) — the FTS aggregation had to be rebuilt with `string_agg + to_tsvector`.

**Impact:** A phase signed off as complete carried a latent prod-breaking dependency; reinforced verifying DB helper availability against the deployment target, not a local engine.
**Source:** 07-06-SUMMARY.md, .planning/STATE.md (Phase 07 decisions)

### Compile-clean TypeORM `orderBy` quoting failed only at query time
Quoting a camelCase column in `orderBy` type-checks and unit-tests clean (mocked QB) yet throws against a real database.

**Impact:** Pushed the discovery to runtime/integration; unit tests with mocked query builders gave false confidence on raw-SQL fragments.
**Source:** .planning/STATE.md (Phase 07 decisions)
