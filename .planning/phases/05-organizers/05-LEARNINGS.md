---
phase: 5
phase_name: "Organizers"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 10
  lessons: 5
  patterns: 7
  surprises: 2
missing_artifacts:
  - "05-UAT.md"
---

# Phase 5 Learnings: Organizers

## Decisions

### Explicit `enumName` on every PostgreSQL enum column
Both `organizer_status` and `organizer_audit_action` columns set an explicit `enumName`.

**Rationale:** TypeORM auto-generates unstable composite enum-type names that collide when multiple enum columns exist (RESEARCH.md Pitfall 1); naming them pins the type.
**Source:** 05-02-SUMMARY.md

### `OrganizerPublicResponseDto` has no `email` property at all
The public DTO omits `email` entirely — not even as a nullable field.

**Rationale:** Enforces the admin-only email rule (D-03) at the type level, not just at mapping time, so an accidental spread can't leak it.
**Source:** 05-02-SUMMARY.md

### In-place reapplication: rejected → pending overwrites the same row
`apply()` for a REJECTED organizer overwrites the existing entity's fields and resets status rather than inserting a new row.

**Rationale:** One organizer record per user; reapplication is a state transition, not a new application (D-06).
**Source:** 05-03-SUMMARY.md

### Service-layer state machine with `assertTransitionAllowed()`
Transitions are governed by a `Partial<Record<Status, Status[]>>` allowed-transitions map; APPROVED has no outbound entry (terminal), violations throw 409.

**Rationale:** Centralizes lifecycle rules; a missing map entry naturally makes a state terminal without special-casing.
**Source:** 05-03-SUMMARY.md, 05-VERIFICATION.md

### `findApprovedByUserId()` returns null; `findApprovedById()` throws 404
The guard-facing lookup returns null for "no approved org"; the public-route lookup throws NotFoundException.

**Rationale:** A guard needs a soft "not an organizer" signal (to 403), while the public endpoint needs a hard 404 — two callers, two contracts.
**Source:** 05-03-SUMMARY.md

### `findApprovedById()` returns the entity, not the DTO
The service returns `OrganizerEntity`; the controller maps to `OrganizerPublicResponseDto` via `toPublicResponse()` (a deliberately `public` method).

**Rationale:** The spec asserts `result.status`, which the public DTO lacks; mapping is the controller's responsibility. (See the email-leak surprise below for the consequence of skipping the map.)
**Source:** 05-03-SUMMARY.md, 05-VERIFICATION.md

### `OrganizerGuard` attaches the entity; `@CurrentOrganizer()` reads it
The guard resolves the approved `OrganizerEntity` and attaches it to `req.organizer`; the param decorator just reads `req.organizer`, with no DI inside `createParamDecorator`.

**Rationale:** `createParamDecorator` can't inject services (RESEARCH.md Pitfall 2, Option A); resolving in the guard and reading in the decorator mirrors the existing `@CurrentUser()` pattern.
**Source:** 05-03-SUMMARY.md

### `@Get('me')` declared before `@Get(':id')`
Route registration order places the static `me` route ahead of the `:id` param route.

**Rationale:** NestJS matches in declaration order; `:id` first would shadow `me` (RESEARCH.md Pitfall 3).
**Source:** 05-04-SUMMARY.md, 05-VERIFICATION.md

### Immutable audit log entity
`OrganizerAuditLogEntity` has `@CreateDateColumn` only — no `@UpdateDateColumn`.

**Rationale:** Audit records are append-only; an update column would imply mutability that must never happen.
**Source:** 05-02-SUMMARY.md

### Sequential status + audit saves, transaction deferred
`approve()`/`reject()` save the status change and the audit row sequentially, not in a transaction, with a documented TODO.

**Rationale:** Acceptable for Phase 5 MVP volume; transaction wrapping is an acknowledged deferral (RESEARCH.md open question 3), flagged Info-level by the verifier, not a blocker.
**Source:** 05-03-SUMMARY.md, 05-VERIFICATION.md

---

## Lessons

### Following the spec mock literally caused an email leak
The Wave 0 `mockOrganizersService` omitted `toPublicResponse`, so the controller returned the raw entity to pass tests — which leaked `email` on the public profile. Caught only by live-HTTP verification, fixed in commit `9d1e78d`.

**Context:** A green unit suite is not proof of a correct response payload when the mock under-specifies the contract. DTO-level exclusion needs a live response assertion.
**Source:** 05-04-SUMMARY.md, 05-VERIFICATION.md

### `import type` required for `AuthenticatedUser` in decorated signatures
TS1272 fires when a type in a decorated parameter is a value import, under `isolatedModules` + `emitDecoratorMetadata`.

**Context:** Same fix recurred in Phase 8's controllers — a standing tsconfig constraint for this project. Use `import type` for any type used only in a decorated signature.
**Source:** 05-04-SUMMARY.md

### `@BeforeInsert()` is skipped by `repository.insert()`
The audit log id had to be pre-generated with `createId()` at object construction because `@BeforeInsert` does not fire on `repository.insert()`.

**Context:** An early instance of the lifecycle-hook-bypass trap that recurred with `createQueryBuilder().insert()` in Phase 8 — ORM insert shortcuts skip entity hooks.
**Source:** 05-03-SUMMARY.md

### Jest 30 renamed `--testPathPattern` → `--testPathPatterns`
The plan's `--testPathPattern=organizers` exits non-zero but only as "no tests found", masking the real RED import errors.

**Context:** Recurs in Phases 6 and 7; confirm via `npx jest --testPathPatterns=...` that the suite actually ran the intended files.
**Source:** 05-01-SUMMARY.md

### Verification ergonomics shaped an open design question
`findByStatus()` with no status param returns all organizers (no WHERE), resolving a RESEARCH.md open question toward the admin-friendly default.

**Context:** Some "open questions" only resolve once you see the caller's ergonomics; the admin list wants "all by default", so absence-means-all won.
**Source:** 05-03-SUMMARY.md

---

## Patterns

### Wave 0 TDD RED stub via import-level compile failure
Three spec files import not-yet-existing source modules to guarantee module-load RED before any implementation.

**When to use:** Opening wave of a TDD phase (used identically across Phases 5–8).
**Source:** 05-01-SUMMARY.md

### Allowed-transitions map + `assert` helper for state machines
Encode legal transitions as a partial map and gate every mutation through an `assertTransitionAllowed()` call; a missing entry = terminal state.

**When to use:** Any entity with a lifecycle (organizer status, event status in Phase 6).
**Source:** 05-03-SUMMARY.md

### Guard-resolves-entity + param-decorator-reads-request
A guard attaches a resolved entity to the request; a `createParamDecorator` reads it. Mirror of `@CurrentUser()`.

**When to use:** Injecting a DB-resolved identity into handlers when the decorator itself can't use DI.
**Source:** 05-03-SUMMARY.md

### `CREATE TYPE` before `CREATE TABLE`; `down()` drops in FK order
Migration creates enum types first, then tables; `down()` drops FK-dependent tables, then parents, then enum types.

**When to use:** Any migration introducing native PostgreSQL enums referenced by table columns.
**Source:** 05-02-SUMMARY.md

### JSONB column for open-schema maps
`socialLinks` stored as a JSONB `Record<string, string> | null`.

**When to use:** Open-ended key/value data that doesn't warrant its own table or fixed columns.
**Source:** 05-02-SUMMARY.md

### Append-only audit entity
An audit entity with only `@CreateDateColumn` and id pre-generated at construction.

**When to use:** Recording immutable admin actions (approve/reject) with a timestamp.
**Source:** 05-02-SUMMARY.md, 05-03-SUMMARY.md

### Static route before param route
Declare specific static routes (`me`) before catch-all param routes (`:id`) in the controller body.

**When to use:** Any NestJS controller mixing a static segment and a `:param` at the same path depth.
**Source:** 05-04-SUMMARY.md

---

## Surprises

### A passing TDD suite shipped an email leak
Because the controller spec's mock omitted `toPublicResponse`, the "correct" way to make tests green was to return the raw entity — which exposed `email` on the public endpoint. The unit suite (80 green) gave no warning; only the live-HTTP verification step caught it.

**Impact:** Reinforced that mocks define the contract they assert, and under-specified mocks can make the wrong implementation look right. Closed post-checkpoint (`9d1e78d`) plus admin-list and Swagger gap fixes.
**Source:** 05-04-SUMMARY.md, 05-VERIFICATION.md

### Migration ran cleanly on the first attempt, no revert needed
`Organizers1747000000000` applied first try with no `migration:revert` recovery — notably smooth compared with the migration drift that hit Phases 7 and 8.

**Impact:** Highlighted (in hindsight) that Phase 5's pure raw-SQL migration with no `synchronize:true` interaction or managed-host-specific SQL is the low-risk path; later phases' trouble came from sync drift and Neon-specific functions, not migrations per se.
**Source:** 05-05-SUMMARY.md
