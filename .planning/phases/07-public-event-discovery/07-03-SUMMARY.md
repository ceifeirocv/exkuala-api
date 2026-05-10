---
phase: 07-public-event-discovery
plan: "03"
subsystem: database
tags: [postgres, typeorm, migration, tsvector, fts, gin-index]

# Dependency graph
requires:
  - phase: 07-01
    provides: Phase 7 research and domain decisions (D-04 through D-10)
  - phase: 06-organizer-event-crud
    provides: events table schema, idx_events_status index already present

provides:
  - TypeORM migration 1749000000000-events-translations-fts.ts with 8 up/8 down steps
  - events table: imageUrl varchar(2048), city varchar(100), search_vector tsvector columns
  - event_translations table with composite PK (eventId, locale) and CASCADE FK
  - GIN index on search_vector for @@ plainto_tsquery FTS queries
  - Functional index LOWER(city) for case-insensitive LIKE prefix city filter
  - tsvector trigger function on events (BEFORE INSERT OR UPDATE)
  - tsvector trigger function on event_translations (AFTER INSERT OR UPDATE OR DELETE)
  - Both triggers wired and ready for Wave 3 migration:run

affects:
  - 07-04 (Wave 2 service methods depend on search_vector, event_translations schema)
  - 07-05 (Wave 2 entity/DTOs depend on imageUrl, city columns and event_translations table)
  - 07-06 (Wave 3 migration:run executes this migration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Composite PK (eventId, locale) on event_translations — no surrogate ID per D-01
    - DB-side tsvector maintenance via BEFORE trigger on events and AFTER trigger on event_translations
    - COALESCE(NEW.eventId, OLD.eventId) in translations trigger to handle DELETE (NEW is NULL on delete)
    - tsvector_agg() to aggregate translation vectors — requires PostgreSQL 14+
    - Functional index LOWER(city) for case-insensitive prefix filter

key-files:
  created:
    - src/database/migrations/1749000000000-events-translations-fts.ts
  modified: []

key-decisions:
  - "Functional LOWER(city) index used (not plain city index) — enables idx scan on WHERE LOWER(city) LIKE LOWER(:city) || '%' (D-09)"
  - "tsvector_agg() chosen for aggregating translation vectors — PostgreSQL 14+ minimum documented in VALIDATION.md check"
  - "COALESCE(NEW.eventId, OLD.eventId) pattern handles DELETE rows where NEW is NULL"
  - "idx_events_status NOT created — already exists from Phase 6 migration 1748000000000-events-fk.ts"

patterns-established:
  - "Step N comment style on every queryRunner.query() call — mirrors 1748000000000-events-fk.ts pattern"
  - "down() reverses up() in exact reverse order with IF EXISTS guards on all DROP statements"

requirements-completed: [I18N-01, DISC-04, DISC-03, DISC-01, EVT-04]

# Metrics
duration: 8min
completed: 2026-05-10
---

# Phase 7 Plan 03: Events Translations FTS Migration Summary

**TypeORM migration adding event_translations table, GIN-indexed tsvector column, and two DB-side trigger functions for automatic full-text search maintenance across default and translated content**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:08:00Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Created 134-line migration with 8 sequential up() steps and 8 corresponding down() steps
- events table extended with imageUrl (varchar 2048), city (varchar 100), and search_vector (tsvector) columns
- event_translations table created with composite PK (eventId, locale) and ON DELETE CASCADE FK to events
- GIN index on search_vector and functional LOWER(city) index for case-insensitive prefix filter
- Two tsvector trigger functions: events trigger updates NEW.search_vector before insert/update; translations trigger re-computes parent event's search_vector after any translation change including DELETE
- TypeScript compiles cleanly (errors in spec files are pre-existing TDD RED stubs from Wave 2 plans, not from this migration)

## Task Commits

1. **Task 1: Create TypeORM migration 1749000000000-events-translations-fts.ts** - `b1c499c` (feat)

## Files Created/Modified

- `src/database/migrations/1749000000000-events-translations-fts.ts` - Complete TypeORM migration with 8 up() steps (ALTER events, CREATE event_translations, GIN index, city functional index, 2 trigger functions, 2 triggers) and 8 down() steps with IF EXISTS guards

## Decisions Made

- Used functional `LOWER(city)` index rather than plain `city` index — consistent with D-09 case-insensitive LIKE prefix query pattern
- `tsvector_agg()` chosen over manual vector concatenation in a loop — cleaner and PostgreSQL 14+ is already documented as the minimum version requirement
- idx_events_status deliberately omitted — already exists from Phase 6 migration per plan requirement

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

TypeScript compile (`npx tsc --noEmit`) produced errors in `events.service.spec.ts`, `public-events.controller.spec.ts`, and `public-events.service.spec.ts` — these are TDD RED stubs created by Wave 2 plan 07-04, referencing source files that will be implemented in Wave 2. These are pre-existing and expected; the migration file itself introduced no TypeScript errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Migration schema contract is complete and ready for Wave 2 (07-04 service methods, 07-05 entity/DTOs)
- Wave 3 plan 07-06 can run `migration:run` once Wave 2 implementation is committed
- PostgreSQL 14+ must be confirmed before running migration:run (tsvector_agg() dependency) — add manual check to VALIDATION.md

---
*Phase: 07-public-event-discovery*
*Completed: 2026-05-10*
