---
phase: 6
phase_name: "Organizer Event CRUD"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 10
  lessons: 3
  patterns: 8
  surprises: 2
missing_artifacts:
  - "06-VERIFICATION.md"
  - "06-UAT.md"
---

# Phase 6 Learnings: Organizer Event CRUD

## Decisions

### `organizerId` stays `nullable:true` on the entity; NOT NULL enforced by migration
The `@Column` decorator keeps `nullable:true`; the NOT NULL constraint is applied via migration (06-03), not via entity synchronize.

**Rationale:** Lets the schema transition to NOT NULL deliberately (purge orphans first) instead of having synchronize fail or silently diverge; migration is the single source of constraint truth.
**Source:** 06-02-SUMMARY.md, 06-03-SUMMARY.md

### FK delete semantics: organizer CASCADE, category SET NULL
`organizerId` FK is `ON DELETE CASCADE`; `categoryId` FK is `ON DELETE SET NULL`.

**Rationale:** Events are fully owned by an organizer (no orphan event is meaningful), but a category is an optional tag whose removal must not destroy events.
**Source:** 06-03-SUMMARY.md

### Safe NOT NULL migration: delete orphans before `SET NOT NULL`
The migration `DELETE`s rows with NULL `organizerId`, then `ALTER COLUMN ... SET NOT NULL`.

**Rationale:** No valid placeholder organizer exists to backfill with, so deletion is safer than fabricating ownership (D-24).
**Source:** 06-03-SUMMARY.md

### Compound `WHERE {id, organizerId}` returns 404, never 403
Ownership lookups (`findOwnedOrThrow`) filter on both id and organizerId and return 404 for events owned by another organizer.

**Rationale:** A 403 would confirm the event exists; 404 leaks nothing about other organizers' events (D-21, T-06-04-06). Confirmed by human verification case 8 (cross-organizer PATCH → 404).
**Source:** 06-04-SUMMARY.md, 06-06-SUMMARY.md

### Explicit state machine as module-level constants
`ALLOWED_TRANSITIONS` (DRAFT→PUBLISHED→CANCELLED, CANCELLED terminal) and `PUBLISH_REQUIRED_FIELDS` are module constants, checked via `assertTransitionAllowed`/`assertPublishGate`.

**Rationale:** Centralizes the lifecycle rules in one auditable place instead of scattering status checks through `update()`.
**Source:** 06-04-SUMMARY.md

### Publish gate runs after field updates
`update()` order is: findOwnedOrThrow → frozen-cancelled guard (409) → assertTransitionAllowed → applyFieldUpdates → assertPublishGate → save.

**Rationale:** Required publish fields supplied in the same PATCH must be evaluated against the post-update state, or a valid publish would wrongly 422.
**Source:** 06-04-SUMMARY.md

### `organizerId` always from `@CurrentOrganizer()`, never from the body
Both `create()` and the controller source organizer identity from the guard-resolved entity.

**Rationale:** Prevents an organizer from creating/editing events under another organizer's id by spoofing a body field (T-06-04-01, T-06-05-02).
**Source:** 06-04-SUMMARY.md, 06-05-SUMMARY.md

### Class-level `@UseGuards(OrganizerGuard)` for uniform protection
The guard is applied once at the controller class level, covering all five organizer routes.

**Rationale:** Uniform protection with no per-route decoration to forget (T-06-05-01); EventsModule imports OrganizersModule for the guard's DI chain (D-22).
**Source:** 06-05-SUMMARY.md

### Manual DTO declaration over `PartialType`
`UpdateEventDto` declares each field explicitly rather than inheriting via `PartialType`.

**Rationale:** Explicit field auditability — matches the established project pattern and keeps validation/`@ApiProperty` coverage visible per field.
**Source:** 06-02-SUMMARY.md

### Soft delete restricted to DRAFT
`softDeleteDraft()` checks `status === DRAFT` before `repository.softDelete()`; non-DRAFT throws `ConflictException` (409).

**Rationale:** Published/cancelled events carry public history and should not be silently removable (D-15, T-06-04-05); soft delete preserves the row (`deletedAt`), excluded from responses.
**Source:** 06-04-SUMMARY.md, 06-02-SUMMARY.md

---

## Lessons

### Jest 30 renamed `--testPathPattern` → `--testPathPatterns`
`pnpm test --testPathPattern=...` matched nothing under Jest 30; verification switched to `npx jest --testRegex`.

**Context:** The same trap recurred in Phase 7 — a project-wide Jest 30 migration footgun. Confirm the suite actually ran, not just that the command exited 0.
**Source:** 06-01-SUMMARY.md

### `update()` exceeded the 20-line limit → extracted `applyFieldUpdates()`
Writing the field-copy logic inline pushed `update()` past the CLAUDE.md 20-line cap; it was extracted into a private helper.

**Context:** The style budget is a real design pressure here — orchestration methods that touch many fields need a field-copy helper to stay within SRP/line limits.
**Source:** 06-04-SUMMARY.md (Rule 2 deviation)

### `limit + 1` fetch detects `hasMore` without a `COUNT(*)`
`findOwned()` fetches `effectiveLimit + 1` rows and infers `hasMore` from the overflow row.

**Context:** Avoids a second count query per page — the standard cursor-pagination efficiency trick, reused across the events listings.
**Source:** 06-04-SUMMARY.md

---

## Patterns

### Wave 0 TDD RED stub via import-level compile failure
Spec files import not-yet-existing source modules so the suite fails to compile, establishing a verifiable RED baseline before implementation.

**When to use:** Opening wave of any TDD phase (used identically in Phase 7).
**Source:** 06-01-SUMMARY.md

### Named mock query builder with chainable stubs
A named mock where all chain methods return `mockReturnThis()` and only `getMany` returns `mockResolvedValue([])`.

**When to use:** Service specs exercising TypeORM QueryBuilder without a live DB.
**Source:** 06-01-SUMMARY.md

### Re-create query-builder mocks in `beforeEach`
Rebuild the mock per test rather than at module scope to prevent call-count/state leakage.

**When to use:** Any spec asserting on QueryBuilder method calls across multiple tests.
**Source:** 06-01-SUMMARY.md

### Row-value cursor comparison
`(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)` with a composite `(startAt, id)` index, fetching `limit + 1`.

**When to use:** Stable keyset pagination over a non-unique sort column, tie-broken by id.
**Source:** 06-04-SUMMARY.md, 06-03-SUMMARY.md

### `@ManyToOne` + `@JoinColumn` over existing scalar FK columns
Add relations on top of existing FK columns, keep the column nullable in the decorator, enforce NOT NULL via migration; service code keeps using scalar FKs (relations not eagerly loaded).

**When to use:** Layering ORM relations onto a table whose FK columns already exist, without forcing eager loads.
**Source:** 06-02-SUMMARY.md

### Migration timestamp one above the previous highest
Number a new migration `previousHighest + 1` to guarantee ordering.

**When to use:** Every new TypeORM migration, to keep deterministic run order.
**Source:** 06-03-SUMMARY.md

### Strictly reversible `down()`
`down()` reverses every `up()` change in exact reverse order (DROP INDEX → DROP CONSTRAINT → DROP NOT NULL).

**When to use:** Any multi-statement DDL migration that must roll back cleanly.
**Source:** 06-03-SUMMARY.md

### Thin controller delegating to service
The controller is pure delegation: `@CurrentOrganizer()` for identity, `@HttpCode` for non-200 statuses, all logic in EventsService.

**When to use:** Keeping HTTP concerns out of business logic; pairs with class-level guard.
**Source:** 06-05-SUMMARY.md

---

## Surprises

### `EventEntity` was already registered in AppModule
Plan 06-05 expected to add `EventEntity` to the AppModule `entities` array, but an earlier plan had already done so — no change needed.

**Impact:** A planned wiring step was a no-op; harmless, but a reminder that the entities array drifts ahead of the plan that "owns" each entity.
**Source:** 06-05-SUMMARY.md

### Near-zero deviation across six plans
Five of six plans executed exactly as written; the phase had a single auto-added helper (`applyFieldUpdates`) as its only deviation, and all 8 human verification cases passed first time.

**Impact:** Unusually clean execution — the heavy Wave 0 TDD contract (28 test cases written before any implementation) front-loaded the design decisions, leaving little to discover during GREEN.
**Source:** 06-01 through 06-06 SUMMARY.md
