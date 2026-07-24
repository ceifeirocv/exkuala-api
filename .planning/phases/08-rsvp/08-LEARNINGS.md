---
phase: 8
phase_name: "RSVP"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 8
  lessons: 5
  patterns: 6
  surprises: 2
missing_artifacts:
  - "08-VERIFICATION.md"
  - "08-UAT.md"
---

# Phase 8 Learnings: RSVP

## Decisions

### Logical cancel via CANCELLED state, not physical delete
Cancelling an RSVP sets `state = CANCELLED` and preserves the row rather than deleting it.

**Rationale:** Re-RSVP after cancel must reuse the same `(userId, eventId)` row through the upsert path (D-03/D-06); a preserved row keeps the upsert conflict target valid and avoids duplicate-key churn.
**Source:** 08-PLAN.md (D-03), 08-01-SUMMARY.md

### `createQueryBuilder().orUpdate()` over `repository.upsert()`
Upsert is implemented with `createQueryBuilder().insert().orUpdate(['state','updatedAt'], ['userId','eventId'])`.

**Rationale:** `repository.upsert()` cannot exclude columns from the conflict-update list, which would overwrite `rsvpedAt`. `orUpdate` with an explicit column list preserves `rsvpedAt` and `id` on a state change.
**Source:** 08-PLAN.md (RESEARCH pitfall), 08-01-SUMMARY.md

### `@Unique(['userId','eventId'])` on the entity, in parity with the migration
The unique constraint is declared both in the migration and as an entity decorator.

**Rationale:** With `synchronize:true` active, TypeORM drops DB-only constraints not reflected on the entity at app restart; entity/migration parity is required to keep the constraint alive (fix `36ee089`).
**Source:** 08-01-SUMMARY.md (key-decisions, deviation 4)

### Separate `EventsRsvpController` from `PublicEventsController`
RSVP write routes live on a dedicated controller, not on the public events controller.

**Rationale:** `PublicEventsController` carries a class-level `@Public()`; reusing it would bypass the global JWT guard on authenticated RSVP routes (T-08-01).
**Source:** 08-PLAN.md (Threat Model), 08-01-SUMMARY.md

### Live counts via `COUNT(*)`, no denormalized columns
`interestedCount` / `goingCount` are computed per request via `countByEventAndState()`, run in parallel with `Promise.all()`.

**Rationale:** Avoids denormalized counter columns and the write-path consistency burden they create (D-07); two indexed COUNTs are cheap enough for the detail endpoint.
**Source:** 08-PLAN.md (D-07), 08-01-SUMMARY.md

### Read/write endpoint split across modules
Write routes (`POST`/`DELETE /events/:id/rsvp`) are wired in EventsModule; the read route (`GET /me/rsvps`) lives in MeModule. `RsvpService` is exported from RsvpModule and imported by both.

**Rationale:** Keeps `/me` as a user-scoped namespace and event-scoped writes alongside other event routes, without duplicating the service (D-01/D-02).
**Source:** 08-PLAN.md (D-01, D-02), 08-01-SUMMARY.md

### `RsvpModule` registers `EventEntity` in its own `forFeature`
RsvpModule registers both RsvpEntity and EventEntity.

**Rationale:** `upsertRsvp()` needs an EventEntity repository for the PUBLISHED guard; multiple `forFeature()` registrations of the same entity across modules are safe and introduce no circular dependency.
**Source:** 08-PLAN.md (Wave 2), 08-01-SUMMARY.md

### Cursor on `(rsvpedAt DESC, id ASC)` with `<` comparison
History pagination orders by `rsvpedAt DESC, id ASC` and uses a `(rsvpedAt, id) < (cursor...)` row-value comparison.

**Rationale:** DESC sort inverts the comparison direction relative to Phase 7's ASC cursor (`>`); the composite tie-breaker on `id` keeps pagination stable for equal timestamps (D-10).
**Source:** 08-PLAN.md (D-10), 08-01-SUMMARY.md

---

## Lessons

### `synchronize:true` silently swallows migration `CREATE TABLE`
TypeORM dev-sync pre-created the `rsvps` table before the migration ran, so the migration's `CREATE TABLE` was skipped, leaving the table with no UNIQUE/FK/index constraints — yet the migration was still recorded as "executed."

**Context:** Surfaced at human verification when the upsert's `ON CONFLICT` had no constraint target and failed at runtime. Fixed with corrective migration `1750000000001-rsvps-constraints.ts` (`89e189f`).
**Source:** 08-01-SUMMARY.md (deviation 3, Issues Encountered)

### `@BeforeInsert()` does not fire on `createQueryBuilder().insert()`
The cuid2 PK generator in `@BeforeInsert()` is bypassed by QB-level inserts, producing rows with null/empty `id`.

**Context:** `upsertRsvp()` uses QB insert; the `id` had to be set explicitly via `id: createId()` in the `values()` call (`7d2ddd2`).
**Source:** 08-01-SUMMARY.md (deviation 5)

### Constraints declared only in migrations are not durable under dev-sync
A UNIQUE constraint added purely via migration was dropped by TypeORM sync on the next app start because the entity had no matching decorator.

**Context:** Required adding `@Unique(['userId','eventId'])` to the entity (`36ee089`) to keep the migration-applied constraint from being reverted.
**Source:** 08-01-SUMMARY.md (deviation 4)

### Extending a service constructor breaks unrelated specs' DI
Adding `RsvpService` to the `EventsService` constructor broke `public-events.service.spec.ts`, whose TestingModule did not provide the new dependency.

**Context:** Any TestingModule that constructs the changed service must register a mock for the new provider; fixed by adding `{ provide: RsvpService, useValue: mockRsvpService }`.
**Source:** 08-01-SUMMARY.md (deviation 1)

### `import type` is required for types in decorated parameter positions
With `isolatedModules:true` + `emitDecoratorMetadata:true`, importing `AuthenticatedUser` as a value (not `import type`) triggers TS1272 in decorated controller signatures.

**Context:** Both new controllers needed `import type { AuthenticatedUser }` to compile.
**Source:** 08-01-SUMMARY.md (deviation 2)

---

## Patterns

### Corrective migration for dev-sync drift
When `synchronize:true` pre-creates a table without its constraints, add a follow-up idempotent `ALTER TABLE` migration rather than editing the swallowed original.

**When to use:** Any phase where a new table's constraints/indexes are missing because dev-sync created the table ahead of the migration.
**Source:** 08-01-SUMMARY.md (patterns-established)

### Entity-decorator/migration parity under `synchronize:true`
Mirror every migration-level constraint (UNIQUE, etc.) with the matching entity decorator so dev-sync does not drop it on restart.

**When to use:** Whenever a DB constraint must survive in an environment where `synchronize:true` is active.
**Source:** 08-01-SUMMARY.md (patterns-established)

### Explicit PK in QB insert when `@BeforeInsert()` is the only generator
Set `id: createId()` directly in `values()` for any `createQueryBuilder().insert()`, since lifecycle hooks do not run on QB inserts.

**When to use:** Any QB-level insert/upsert on an entity whose PK is generated by `@BeforeInsert()`.
**Source:** 08-01-SUMMARY.md (patterns-established)

### `orUpdate` column allow-list to preserve insert-only fields
Use `orUpdate(['mutableCol', ...], ['conflictCol', ...])` to update only intended columns on conflict, preserving insert-only fields like `rsvpedAt`.

**When to use:** Upserts where some columns (timestamps, generated ids) must never be overwritten on conflict.
**Source:** 08-01-SUMMARY.md (tech-stack.patterns)

### `leftJoinAndMapOne` for scalar-FK relations without `@ManyToOne`
Join a related entity onto a scalar FK with `leftJoinAndMapOne(...)` and cast the result to `(Entity & { joined: JoinedEntity })[]`, avoiding `@ManyToOne` relation properties.

**When to use:** Fetching related rows in one query for entities that intentionally keep scalar FK columns only (mirrors EventEntity).
**Source:** 08-01-SUMMARY.md (tech-stack.patterns)

### `/me` namespace module owning no entities
`MeModule` registers user-scoped routes, imports the service-owning module (RsvpModule), and declares no `forFeature` of its own.

**When to use:** Building a user-centric route namespace that composes services owned by other feature modules; natural home for future profile/notification endpoints.
**Source:** 08-01-SUMMARY.md (tech-stack.patterns, Next Phase Readiness)

---

## Surprises

### Migration recorded "executed" despite skipping its `CREATE TABLE`
TypeORM treats a migration as atomic at the record level and does not diff individual statements, so a migration whose body was effectively a no-op (table already existed) was still marked complete — masking the missing constraints until runtime.

**Impact:** Required a corrective migration and exposed a recurring dev-sync hazard; now a documented pattern for the project.
**Source:** 08-01-SUMMARY.md (Issues Encountered)

### `TIMESTAMPTZ` migration vs timezone-naive sync columns
The migration specified `TIMESTAMPTZ`, but `synchronize:true` had already created the columns as `timestamp without time zone`, so the live table is timezone-naive.

**Impact:** Functionally equivalent today (all timestamps stored as UTC), but a latent mismatch if the schema is ever reset from migrations rather than sync.
**Source:** 08-01-SUMMARY.md (Issues Encountered)
