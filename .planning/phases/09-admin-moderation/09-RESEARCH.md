# Phase 9: Admin Moderation - Research

**Researched:** 2026-06-13
**Domain:** NestJS admin RBAC, TypeORM enum extension, cursor pagination, audit logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Event Moderation State Machine**
- D-01: Add `EventStatus.SUSPENDED`. Admin-only state — organizers cannot transition into or out of it. Organizer PATCH on a SUSPENDED event returns 409 (frozen, same treatment as CANCELLED in Phase 6 D-05).
- D-02: Admin can suspend from any active state: `DRAFT → SUSPENDED` and `PUBLISHED → SUSPENDED`. Restore (`SUSPENDED → <prior>`) returns the event to the status it held before suspension. This requires remembering the pre-suspend status — planner adds a `statusBeforeSuspension` (or equivalent) column / mechanism on the event row.
- D-03: Admin restore is reversible and admin-only: `SUSPENDED → DRAFT` or `SUSPENDED → PUBLISHED` depending on prior status.
- D-04: Admin "remove" (EVT-03/ADMIN-04) = soft-delete via `repository.softDelete` (sets `deletedAt`), allowed regardless of status or ownership. Reuses existing soft-delete already on `EventEntity` (Phase 6). Removed events disappear from public and organizer lists but remain in DB and admin view (`?includeDeleted=true`).
- D-05: The organizer-facing EventsService state machine (`ALLOWED_TRANSITIONS`, `assertTransitionAllowed`) stays clean — admin transitions are a distinct admin code path, not a bypass flag injected into the organizer flow. Planner decides whether this is a separate admin method on EventsService or a dedicated admin service.

**Admin Event List (ADMIN-02)**
- D-06: `GET /api/v1/admin/events` reuses the Phase 6/7 cursor pagination contract (`PaginatedEventsResponseDto` shape: `{ data, nextCursor, hasMore }`, cursor on `(startAt, id)`). No new pagination pattern.
- D-07: Filters: `?status=` (accepts SUSPENDED and all other statuses), `?organizerId=`. No filter → all events across all organizers.
- D-08: Returns the **full `EventEntity`** (all fields incl. status, draft-only fields, organizerId, timestamps) — NOT a public DTO. Follows Phase 5 lesson: admin list endpoints need full entity; public DTOs strip moderation-relevant fields.
- D-09: Soft-deleted events are excluded by default; `?includeDeleted=true` uses TypeORM `withDeleted()` to include them (with `deletedAt` visible).

**Organizer Admin Reuse (ADMIN-01 / ADMIN-03)**
- D-10: ADMIN-01: upgrade the existing `GET /api/v1/admin/organizers` (Phase 5, unpaginated, status-filtered) to cursor pagination, consistent with the new admin event list. Keep the `?status=` filter behavior.
- D-11: ADMIN-03: approve/reject endpoints and `/history` are already fully built in Phase 5 — reused as-is. Phase 9 does not rebuild them.
- D-12: Add `adminUserId` column to `organizer_audit_log`. Approve/reject now record which admin acted. Migration adds the column; approve/reject service methods accept the acting admin id.

**Audit Trail (event moderation)**
- D-13: New `event_audit_log` table: `{ id (CUID2), eventId (FK), action (enum: suspended | restored | removed), note (varchar nullable), adminUserId (FK → users.id), createdAt }`.
- D-14: Admin moderation actions accept an optional `note`/reason in the request body, persisted in the audit row.

**Module & Controller Placement**
- D-15: Admin controllers live in their feature modules: new `src/events/admin-events.controller.ts`. No dedicated `src/admin/` module.
- D-16: `@Roles('admin')` (global RolesGuard) gates every admin endpoint.

### Claude's Discretion

- Exact column name/mechanism for remembering pre-suspend status (`statusBeforeSuspension` column vs. deriving from audit log). Planner decides; column is simplest.
- Whether admin event transitions live as new methods on `EventsService` or a separate `AdminEventsService` — keep the organizer state machine untouched either way (D-05).
- Resolving `adminUserId`: mirror `@CurrentUser()` → `UserEntity.id`.
- Exact action verbs and HTTP verbs/paths for suspend/restore/remove (e.g., `PATCH /admin/events/:id/suspend`, `/restore`, `DELETE /admin/events/:id`).
- 409 error body shape for invalid admin transitions — mirror Phase 6 `assertTransitionAllowed` message format.
- VarChar lengths on new columns (`note`, etc.) — follow SEC-01 (note 2000, mirroring organizer audit).
- Index strategy on `event_audit_log`.

### Deferred Ideas (OUT OF SCOPE)

- `suspended` *organizer* status (admin disabling an approved organizer) — future phase.
- Full-text search on admin organizer/event lists.
- Admin dashboard aggregate metrics.
- `PATCH /organizers/me` organizer self-update.
- M:M user↔organizer team membership.
- Notifications to organizer when their event is suspended/removed.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVT-03 | Admin can unpublish or remove any event regardless of organizer | Admin suspend/restore state machine (D-01–D-05) + soft-delete via `repository.softDelete` |
| ADMIN-01 | Admin can list all organizers filtered by status (pending / approved / rejected) | Existing `findByStatus()` upgraded with cursor pagination (D-10) |
| ADMIN-02 | Admin can list all events including drafts and unpublished | New `GET /admin/events` with full entity return + all-status + `?includeDeleted` (D-06–D-09) |
| ADMIN-03 | Admin can approve or reject organizer applications | Already shipped Phase 5; Phase 9 adds `adminUserId` to audit rows (D-11–D-12) |
| ADMIN-04 | Admin can unpublish or remove events | Soft-delete any event regardless of ownership (D-04); suspend = unpublish |
</phase_requirements>

---

## Summary

Phase 9 is a **pure extension phase** — no new architectural patterns. Every capability reuses established project conventions: the `@Roles('admin')` guard, cursor pagination on `(startAt, id)`, the `ALLOWED_TRANSITIONS` + `assertTransitionAllowed` state-machine pattern (now forked for an admin code path), TypeORM `softDelete()`, and the `OrganizerAuditLogEntity` template for the new `EventAuditLogEntity`.

The largest discrete change is the `EventStatus.SUSPENDED` enum addition. PostgreSQL enums are **immutable by type-level ALTER** on Neon — the correct approach is `ALTER TYPE event_status ADD VALUE 'SUSPENDED'` run inside its own migration. The second migration creates `event_audit_log` and adds `adminUserId` to `organizer_audit_log`. All TypeORM entity changes follow the `name: 'snake_case'` column convention established in Phase 7 to prevent TypeORM sync from creating duplicate camelCase columns.

`AdminOrganizersController` gains cursor pagination by changing its return type from `OrganizerEntity[]` to a paginated wrapper. `AdminEventsController` is a new file in `src/events/` that mirrors `AdminOrganizersController` structurally. Admin event transitions (suspend/restore/remove) are cleanest as new methods on `EventsService` with explicit `adminOnly: true` paths, keeping the organizer-facing state machine (`ALLOWED_TRANSITIONS`) unmodified.

**Primary recommendation:** Add `SUSPENDED` to `event_status` enum in a migration that runs `ALTER TYPE ... ADD VALUE` without a transaction (Neon requirement). Then implement admin actions as new service methods that bypass `ALLOWED_TRANSITIONS` without touching it.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Admin role enforcement | API / Backend | — | `RolesGuard` runs server-side; no client trust |
| Organizer list (paginated, filtered by status) | API / Backend | Database / Storage | Service query + index on `(status, createdAt, id)` |
| Admin event list (all statuses, all owners) | API / Backend | Database / Storage | Service query; index on `(startAt, id)` already exists |
| Suspend/restore event | API / Backend | Database / Storage | State machine + `statusBeforeSuspension` column update |
| Soft-delete event | API / Backend | Database / Storage | `repository.softDelete()` sets `deletedAt` |
| Audit log write | API / Backend | Database / Storage | Service writes audit row on every admin action |
| `adminUserId` resolution | API / Backend | — | `@CurrentUser()` decorator, same as existing pattern |

---

## Standard Stack

No new external packages. Phase 9 is purely additive to existing libraries.

### Core (already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` | project version | Controllers, guards, decorators | Project standard |
| `typeorm` | project version | Repository, QueryBuilder, softDelete, withDeleted | Project ORM |
| `@paralleldrive/cuid2` | project version | `createId()` for new audit log PKs | Project ID strategy |
| `class-validator` | project version | DTO validation (`@IsOptional`, `@IsString`, `@MaxLength`, `@IsEnum`) | Project validation |
| `class-transformer` | project version | `@Type(() => Number)` for query params | Project standard |
| `@nestjs/swagger` | project version | `@ApiProperty`, `@ApiOperation`, `@ApiResponse` | Project API docs |

**Installation:** None required — all dependencies already present.

---

## Package Legitimacy Audit

No new packages in this phase.

| Package | Verdict | Disposition |
|---------|---------|-------------|
| (none) | — | — |

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (admin JWT)
        │
        ▼
  JwtAuthGuard (global)
        │
        ▼
  RolesGuard (@Roles('admin'))
  ────── 403 if not admin ──────►
        │
   ┌────┴──────────────────────┐
   │                           │
   ▼                           ▼
AdminOrganizersController  AdminEventsController
(src/organizers/)          (src/events/)
   │                           │
   ▼                           ▼
OrganizersService          EventsService
findByStatus(cursor)       findAll(admin query)
approve/reject(adminId)    suspend/restore/remove(adminId)
   │                           │
   ▼                           ▼
OrganizerAuditLogEntity    EventAuditLogEntity
(gains adminUserId col)    (new table)
   │                           │
   └────────┬──────────────────┘
            ▼
     PostgreSQL (Neon)
```

### Recommended Project Structure

```
src/
├── events/
│   ├── admin-events.controller.ts       # new — mirrors admin-organizers pattern
│   ├── admin-events.controller.spec.ts  # new — TDD wave 0 RED stubs
│   ├── event-audit-log.entity.ts        # new — mirrors organizer-audit-log.entity.ts
│   ├── event.entity.ts                  # extend EventStatus + statusBeforeSuspension column
│   └── events.service.ts                # add adminSuspend/adminRestore/adminRemove methods
├── organizers/
│   ├── admin-organizers.controller.ts   # extend: cursor pagination on GET /
│   ├── organizers.service.ts            # extend: findByStatus → paginated; approve/reject gain adminUserId param
│   └── organizer-audit-log.entity.ts    # extend: add adminUserId column
└── database/migrations/
    ├── 1751000000000-admin-event-status.ts   # ADD VALUE 'SUSPENDED' to event_status enum + statusBeforeSuspension column
    └── 1751000000001-admin-audit-log.ts      # create event_audit_log; add adminUserId to organizer_audit_log
```

### Pattern 1: PostgreSQL Enum Extension (ALTER TYPE ADD VALUE)

**What:** Adding `SUSPENDED` to an existing `event_status` PostgreSQL enum.
**When to use:** Any time you extend an existing enum — cannot drop/recreate on Neon without breaking FK constraints.

**Critical constraint:** `ALTER TYPE ... ADD VALUE` cannot run inside a transaction block on PostgreSQL. On Neon the migration runner must execute it outside a transaction. TypeORM `QueryRunner` migrations run inside a transaction by default — you must override `transaction = false` on the migration class.

```typescript
// Source: [VERIFIED: TypeORM docs — MigrationInterface transaction property]
// src/database/migrations/1751000000000-admin-event-status.ts
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AdminEventStatus1751000000000 implements MigrationInterface {
  name = 'AdminEventStatus1751000000000';

  // ALTER TYPE ... ADD VALUE cannot run inside a transaction (PostgreSQL restriction).
  // Setting transaction = false tells TypeORM to run this migration outside BEGIN/COMMIT.
  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Extend event_status enum
    await queryRunner.query(`
      ALTER TYPE "event_status" ADD VALUE IF NOT EXISTS 'SUSPENDED'
    `);

    // Step 2: Add statusBeforeSuspension column (nullable — only set on suspend)
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "statusBeforeSuspension" "event_status" NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Removing an enum value requires a full type recreate — not safe in prod.
    // Drop column; leave the enum value in place.
    await queryRunner.query(`
      ALTER TABLE "events"
      DROP COLUMN IF EXISTS "statusBeforeSuspension"
    `);
    // Note: PostgreSQL does not support DROP VALUE from enum without recreate.
    // Acceptable: SUSPENDED value remains in type, no rows use it after rollback.
  }
}
```

### Pattern 2: Admin Event List with withDeleted()

**What:** QueryBuilder query that spans all organizers, all statuses, optional soft-deleted inclusion.
**When to use:** Admin list endpoint only — never for organizer or public-facing queries.

```typescript
// Source: [ASSUMED — based on TypeORM withDeleted pattern used in existing codebase + Phase 6 cursor pagination impl]
async findAllForAdmin(query: AdminEventQueryDto): Promise<PaginatedEventsResponseDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.eventRepository
    .createQueryBuilder('event')
    .orderBy('event.startAt', 'ASC')
    .addOrderBy('event.id', 'ASC')
    .take(effectiveLimit + 1);

  if (query.includeDeleted) {
    qb.withDeleted();
  }
  if (query.status) {
    qb.where('event."status" = :status', { status: query.status });
  }
  if (query.organizerId) {
    qb.andWhere('event."organizerId" = :organizerId', { organizerId: query.organizerId });
  }
  if (query.cursor) {
    const { cursorStartAt, cursorId } = EventsService.decodeCursor(query.cursor);
    qb.andWhere(
      '(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)',
      { cursorStartAt, cursorId },
    );
  }

  const rows = await qb.getMany();
  const hasMore = rows.length > effectiveLimit;
  const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem
    ? EventsService.encodeCursor(lastItem.startAt, lastItem.id)
    : null;
  // Admin list returns full EventEntity — not toResponseDto() (D-08)
  return { data, nextCursor, hasMore };
}
```

### Pattern 3: Admin Suspend/Restore State Machine

**What:** Admin transitions that bypass `ALLOWED_TRANSITIONS` without modifying it.
**When to use:** Any admin action that would be rejected by the organizer-facing state machine.

```typescript
// Source: [ASSUMED — mirrors assertTransitionAllowed pattern in events.service.ts]
// Admin suspend: DRAFT|PUBLISHED → SUSPENDED (D-02)
private readonly ADMIN_SUSPENDABLE: EventStatus[] = [EventStatus.DRAFT, EventStatus.PUBLISHED];

async adminSuspend(eventId: string, adminUserId: string, note?: string): Promise<void> {
  const event = await this.findEventOrThrow(eventId);
  if (!this.ADMIN_SUSPENDABLE.includes(event.status)) {
    throw new ConflictException(
      `Event '${eventId}' is ${event.status} — only DRAFT and PUBLISHED events can be suspended`,
    );
  }
  event.statusBeforeSuspension = event.status;
  event.status = EventStatus.SUSPENDED;
  await this.eventRepository.save(event);
  await this.writeEventAuditLog(eventId, EventAuditAction.SUSPENDED, adminUserId, note);
}

// Admin restore: SUSPENDED → prior status (D-03)
async adminRestore(eventId: string, adminUserId: string, note?: string): Promise<void> {
  const event = await this.findEventOrThrow(eventId);
  if (event.status !== EventStatus.SUSPENDED) {
    throw new ConflictException(
      `Event '${eventId}' is ${event.status} — only SUSPENDED events can be restored`,
    );
  }
  event.status = event.statusBeforeSuspension ?? EventStatus.DRAFT; // safe default per CONTEXT D-specific
  event.statusBeforeSuspension = null;
  await this.eventRepository.save(event);
  await this.writeEventAuditLog(eventId, EventAuditAction.RESTORED, adminUserId, note);
}

// Admin remove: soft-delete regardless of status (D-04)
async adminRemove(eventId: string, adminUserId: string, note?: string): Promise<void> {
  const event = await this.findEventOrThrow(eventId);
  if (!event) throw new NotFoundException(`Event '${eventId}' not found`);
  await this.eventRepository.softDelete(eventId);
  await this.writeEventAuditLog(eventId, EventAuditAction.REMOVED, adminUserId, note);
}
```

### Pattern 4: Organizer Cursor Pagination

**What:** Upgrading `findByStatus()` from returning `OrganizerEntity[]` to a cursor-paginated wrapper.
**When to use:** Phase 9 ADMIN-01 only.

Cursor on `(createdAt, id)` is the natural choice for organizers — they have no `startAt` field. This mirrors the `(startAt, id)` keyset used for events but adapted to organizer ordering.

```typescript
// Source: [ASSUMED — derived from events.service.ts findOwned() pattern]
async findByStatusPaginated(
  status: OrganizerStatus | undefined,
  query: OrganizerPaginationQueryDto,
): Promise<PaginatedOrganizersResponseDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.organizerRepository
    .createQueryBuilder('organizer')
    .orderBy('organizer.createdAt', 'ASC')
    .addOrderBy('organizer.id', 'ASC')
    .take(effectiveLimit + 1);

  if (status) {
    qb.where('organizer."status" = :status', { status });
  }
  if (query.cursor) {
    const { cursorCreatedAt, cursorId } = OrganizersService.decodeCursor(query.cursor);
    qb.andWhere(
      '(organizer."createdAt", organizer."id") > (:cursorCreatedAt::timestamptz, :cursorId)',
      { cursorCreatedAt, cursorId },
    );
  }

  const rows = await qb.getMany();
  const hasMore = rows.length > effectiveLimit;
  const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem
    ? OrganizersService.encodeCursor(lastItem.createdAt, lastItem.id)
    : null;
  return { data, nextCursor, hasMore };
}
```

### Pattern 5: EventAuditLogEntity (mirrors OrganizerAuditLogEntity)

```typescript
// Source: [VERIFIED: codebase — src/organizers/organizer-audit-log.entity.ts]
import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export enum EventAuditAction {
  SUSPENDED = 'suspended',
  RESTORED = 'restored',
  REMOVED = 'removed',
}

@Entity('event_audit_log')
export class EventAuditLogEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30 })
  eventId: string;

  @ApiProperty({ enum: EventAuditAction })
  @Column({
    type: 'enum',
    enum: EventAuditAction,
    enumName: 'event_audit_action', // enumName prevents TypeORM name collision
  })
  action: EventAuditAction;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  @ApiProperty()
  @Column({ type: 'varchar', length: 30, name: 'adminUserId' })
  adminUserId: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) this.id = createId();
  }
}
```

### Anti-Patterns to Avoid

- **Injecting admin transitions via a flag into `assertTransitionAllowed`:** CONTEXT D-05 explicitly forbids this. Admin code path must be separate from the organizer state machine.
- **Wrapping `ALTER TYPE ADD VALUE` in a transaction:** PostgreSQL forbids it. Set `public readonly transaction = false` on the migration class.
- **Using `repository.insert()` for audit log rows:** `@BeforeInsert` does not fire on `insert()`, only on `save()`. Use `repository.create()` + `repository.save()` as in `OrganizersService.approve()`.
- **Returning `EventResponseDto` from admin list:** Admin list must return full `EventEntity` (D-08). `EventResponseDto` excludes `deletedAt` and other moderation fields.
- **camelCase column name without `name:` override:** `statusBeforeSuspension` needs `name: 'statusBeforeSuspension'` (or explicit snake_case name) to prevent TypeORM sync drift. See Phase 7 lesson: add `name: 'snake_case'` to `@Column` when migration uses that name.
- **Cursor on `id` alone for organizer pagination:** Organizers need a stable order. `(createdAt, id)` provides stable ordering — `id` alone is not ordered.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Soft-delete (admin remove) | Custom `isDeleted` boolean | TypeORM `@DeleteDateColumn` + `repository.softDelete()` | Already on `EventEntity`; auto-filters from all queries |
| Include-deleted in admin list | Manual `WHERE deletedAt IS NULL` removal | `qb.withDeleted()` | TypeORM built-in; handles the null check automatically |
| Admin role gate | Custom guard per-route | `@Roles('admin')` + global `RolesGuard` (already global) | Zero new guard code; pattern fully established |
| Opaque cursor encoding | Custom base64 scheme | `EventsService.encodeCursor/decodeCursor` static methods | Already implemented; reuse directly |
| CUID2 PK generation | UUID or random string | `createId()` from `@paralleldrive/cuid2` + `@BeforeInsert` | Project standard; avoids `repository.insert()` bug |

---

## Common Pitfalls

### Pitfall 1: `ALTER TYPE ADD VALUE` inside a transaction

**What goes wrong:** Migration fails at runtime with `ERROR: ALTER TYPE ... ADD VALUE cannot run inside a transaction block`.
**Why it happens:** TypeORM migrations run inside `BEGIN ... COMMIT` by default. PostgreSQL prohibits adding enum values inside a transaction.
**How to avoid:** Add `public readonly transaction = false;` to the migration class.
**Warning signs:** Migration exits with Postgres error 25001 or "cannot run inside a transaction block".

### Pitfall 2: TypeORM sync creating duplicate camelCase columns

**What goes wrong:** After adding `statusBeforeSuspension` column to `EventEntity` (TypeScript camelCase), TypeORM `synchronize: true` creates a second `statusBeforeSuspension` column alongside the migration-created `statusBeforeSuspension` column if you forgot to add `name: 'statusBeforeSuspension'` (or the snake version) on `@Column`.
**Why it happens:** TypeORM infers DB column name from the property name. If migration used a different casing (or if synchronize creates the column first), you get two columns.
**How to avoid:** Always add `name:` to `@Column` for new columns. See Phase 7 lesson in STATE.md.
**Warning signs:** `psql \d events` shows two similar column names.

### Pitfall 3: `@BeforeInsert` not firing on audit log rows

**What goes wrong:** Audit log row is inserted with null `id`, violating PK constraint.
**Why it happens:** `repository.insert()` bypasses lifecycle hooks including `@BeforeInsert`. The existing `OrganizersService` uses `create()` + `save()` for this reason.
**How to avoid:** Always use `this.auditLogRepository.create({ id: createId(), ... })` + `await this.auditLogRepository.save(log)`.
**Warning signs:** PK violation error on audit log insert.

### Pitfall 4: Admin list returns `EventResponseDto` instead of full entity

**What goes wrong:** Admin cannot see `deletedAt`, `statusBeforeSuspension`, or `status: SUSPENDED` — they're stripped by the DTO.
**Why it happens:** Reusing `toResponseDto()` from the organizer-facing code path strips those fields.
**How to avoid:** Admin list returns raw `EventEntity[]` (wrapped in pagination shape). No DTO mapping. Follow D-08 and the Phase 5 lesson in STATE.md.
**Warning signs:** `GET /admin/events` response missing `deletedAt` or `statusBeforeSuspension`.

### Pitfall 5: `organizer_audit_log.adminUserId` column drift (Neon)

**What goes wrong:** Migration adds `adminUserId` column to `organizer_audit_log` but Neon's existing schema has a constraint drift from a previous synchronize run, causing migration to fail.
**Why it happens:** See project memory `typeorm-synchronize-constraint-drift`. If any prior synchronize ran, the column may already exist or the table may have drift.
**How to avoid:** Run migration against Neon in a test environment before committing. Use `IF NOT EXISTS` in migration DDL where PostgreSQL allows it. Verify with `\d organizer_audit_log` on Neon.
**Warning signs:** Migration fails with "column already exists" or "constraint violation" on Neon but passes locally.

### Pitfall 6: Organizer list cursor using wrong field

**What goes wrong:** Cursor pagination on organizer list uses `startAt` (which doesn't exist on `OrganizerEntity`) instead of `createdAt`.
**Why it happens:** Copy-paste from event pagination without checking entity fields.
**How to avoid:** Use `(createdAt, id)` keyset for organizers. Verify field names against `OrganizerEntity`.

---

## Code Examples

### EventAuditLogEntity — direct template from OrganizerAuditLogEntity

```typescript
// Source: [VERIFIED: codebase — src/organizers/organizer-audit-log.entity.ts direct mirror]
// Key differences from OrganizerAuditLogEntity:
// 1. eventId FK instead of organizerId
// 2. enum: EventAuditAction { SUSPENDED, RESTORED, REMOVED }
// 3. adminUserId column (FK → users.id) — was missing from organizer_audit_log in Phase 5
// 4. enumName: 'event_audit_action' to avoid TypeORM name collision with 'organizer_audit_action'
```

### Organizer pagination DTO (new)

```typescript
// Source: [ASSUMED — mirrors EventPaginationQueryDto]
// src/organizers/dto/organizer-pagination-query.dto.ts
export class OrganizerPaginationQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
  @IsOptional() @IsEnum(OrganizerStatus) status?: OrganizerStatus;
}
```

### Admin event query DTO (new)

```typescript
// Source: [ASSUMED — mirrors EventPaginationQueryDto + organizerId/includeDeleted]
// src/events/dto/admin-event-query.dto.ts
export class AdminEventQueryDto {
  @IsOptional() @IsString() cursor?: string;
  @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number;
  @IsOptional() @IsEnum(EventStatus) status?: EventStatus;      // includes SUSPENDED
  @IsOptional() @IsString() organizerId?: string;
  @IsOptional() @IsBoolean() @Transform(({ value }) => value === 'true') includeDeleted?: boolean;
}
```

### Admin moderation DTOs (new)

```typescript
// Source: [ASSUMED — mirrors ApproveOrganizerDto]
// src/events/dto/admin-event-moderation.dto.ts
export class AdminEventModerationDto {
  @IsOptional() @IsString() @MaxLength(2000) note?: string;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Unpaginated admin organizer list | Cursor-paginated (D-10) | Phase 9 | Handles large organizer sets without limit |
| No event SUSPENDED state | `EventStatus.SUSPENDED` admin-only | Phase 9 | Enables reversible moderation without cancellation |
| No admin userId in audit log | `adminUserId` FK in both audit tables | Phase 9 | Accountability trail for moderation actions |

**Deprecated/outdated:**
- `findByStatus()` returning `OrganizerEntity[]` directly: replaced by paginated version. Phase 9 plan must update the controller signature and all callers.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Organizer cursor uses `(createdAt, id)` keyset | Architecture Patterns (Pattern 4) | Wrong ordering; pagination would be unstable |
| A2 | Admin event list QueryBuilder uses `qb.withDeleted()` when `includeDeleted=true` | Architecture Patterns (Pattern 2) | Soft-deleted events not returned; admin cannot see removed events |
| A3 | `statusBeforeSuspension` is nullable enum column (same type as `status`) | Architecture Patterns (Pattern 3) | Type mismatch on restore if stored as varchar |
| A4 | `public readonly transaction = false` is the correct TypeORM migration property for non-transactional migration | Common Pitfalls (Pitfall 1) | Migration fails or runs unsafely; verify against TypeORM docs |

**All four assumptions are low-risk given the existing codebase patterns. A4 is the only external API claim — verify with Context7 if unsure.**

---

## Open Questions

1. **Paginated organizers response DTO shape**
   - What we know: Events use `PaginatedEventsResponseDto { data: EventResponseDto[], nextCursor, hasMore }`.
   - What's unclear: Should organizer pagination use a new `PaginatedOrganizersResponseDto { data: OrganizerEntity[], ... }` or reuse a generic shape?
   - Recommendation: Create `PaginatedOrganizersResponseDto` mirroring `PaginatedEventsResponseDto` but typed to `OrganizerEntity[]`. Keeps Swagger accurate.

2. **`adminUserId` nullable vs. NOT NULL on `organizer_audit_log`**
   - What we know: Phase 5 created `organizer_audit_log` without `adminUserId`. Adding NOT NULL requires a default or backfill.
   - What's unclear: Should existing rows get a sentinel admin ID or `adminUserId` be nullable?
   - Recommendation: Make `adminUserId` nullable in the migration (no backfill needed). New rows written by Phase 9 will always have it set.

3. **Admin event history endpoint**
   - What we know: CONTEXT.md mentions `GET /admin/events/:id/history` as optional ("newest first like organizer history").
   - What's unclear: Is this in scope for Phase 9?
   - Recommendation: Include it in 09-02 plan — it follows trivially from `EventAuditLogEntity.findByEventId()` and the organizer history pattern, cost is ~3 lines of service + 1 controller method.

---

## Environment Availability

Step 2.6: SKIPPED (no new external dependencies — phase is additive to existing NestJS/TypeORM/PostgreSQL stack).

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 |
| Config file | `package.json` → `"jest"` key |
| Quick run command | `npm test -- --testPathPatterns=admin` |
| Full suite command | `npm test` |

Note: Jest 30 renamed `--testPathPattern` to `--testPathPatterns` (see project memory `jest30-testpathpattern-rename`).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ADMIN-01 | Admin list organizers with cursor pagination | unit | `npm test -- --testPathPatterns=admin-organizers.controller` | ❌ Wave 0 |
| ADMIN-01 | `findByStatusPaginated()` returns correct cursor shape | unit | `npm test -- --testPathPatterns=organizers.service` | ✅ (extend) |
| ADMIN-02 | Admin event list returns all statuses, all owners | unit | `npm test -- --testPathPatterns=admin-events.controller` | ❌ Wave 0 |
| ADMIN-02 | `findAllForAdmin()` with `includeDeleted=true` includes soft-deleted | unit | `npm test -- --testPathPatterns=events.service` | ✅ (extend) |
| ADMIN-03 | approve/reject now accept and record adminUserId | unit | `npm test -- --testPathPatterns=organizers.service` | ✅ (extend) |
| EVT-03 / ADMIN-04 | `adminSuspend()` transitions DRAFT/PUBLISHED → SUSPENDED, stores prior status | unit | `npm test -- --testPathPatterns=events.service` | ✅ (extend) |
| EVT-03 / ADMIN-04 | `adminRestore()` transitions SUSPENDED → prior status | unit | `npm test -- --testPathPatterns=events.service` | ✅ (extend) |
| EVT-03 / ADMIN-04 | `adminRemove()` soft-deletes any event regardless of status | unit | `npm test -- --testPathPatterns=events.service` | ✅ (extend) |
| EVT-03 / ADMIN-04 | Admin suspend endpoint calls service, returns 204 | unit | `npm test -- --testPathPatterns=admin-events.controller` | ❌ Wave 0 |
| D-01 | Organizer PATCH on SUSPENDED event returns 409 | unit | `npm test -- --testPathPatterns=events.service` | ✅ (extend) |

### Sampling Rate

- **Per task commit:** `npm test -- --testPathPatterns=<spec-file>`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/events/admin-events.controller.spec.ts` — covers ADMIN-02, ADMIN-04 (EVT-03)
- [ ] `src/events/event-audit-log.entity.ts` — needed by admin-events controller spec import
- [ ] `src/events/dto/admin-event-query.dto.ts` — needed by controller spec
- [ ] `src/events/dto/admin-event-moderation.dto.ts` — needed by controller spec
- [ ] `src/organizers/dto/organizer-pagination-query.dto.ts` — needed by admin-organizers spec update
- [ ] `src/organizers/dto/paginated-organizers-response.dto.ts` — needed by controller + spec

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT guard already global — admin routes are authenticated |
| V3 Session Management | no | Stateless JWT, no session store |
| V4 Access Control | yes | `@Roles('admin')` + `RolesGuard` — every admin endpoint |
| V5 Input Validation | yes | `class-validator` on all DTOs; `@MaxLength(2000)` on `note` per SEC-01 |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Non-admin user calling admin endpoints | Elevation of Privilege | `@Roles('admin')` + global `RolesGuard`; already in place |
| Organizer suspending their own event via admin path | Elevation of Privilege | Admin path requires `admin` role; organizer role does not include it |
| Admin moderation note exceeding DB column length | Tampering / DoS | `@MaxLength(2000)` on DTO + `varchar(2000)` on DB column (SEC-01) |
| Soft-deleted event accessible via public API | Information Disclosure | TypeORM `@DeleteDateColumn` auto-filters; `withDeleted()` only on admin path |
| SUSPENDED event leaking through organizer list | Information Disclosure | Organizer `findOwned()` does not filter by status — SUSPENDED events appear in organizer's list but organizer PATCH is blocked (409). Verify this is acceptable per D-01. |

---

## Project Constraints (from CLAUDE.md)

| Directive | Applies To | Enforcement |
|-----------|------------|-------------|
| Functions: 4–20 lines; split if longer | All new service methods | Admin methods that are > 20 lines must extract helpers |
| Files: under 500 lines | `events.service.ts` (currently ~404 lines) | Adding admin methods will approach 500; consider `AdminEventsService` |
| Names: specific, <5 grep hits | `adminSuspend`, `adminRestore`, `adminRemove`, `findAllForAdmin` | All names are specific to admin domain |
| Types: explicit, no `any` | DTOs, service signatures | `adminUserId: string`, `note?: string` — fully typed |
| `@Column` with explicit `name:` | `statusBeforeSuspension` | Phase 7 lesson: add `name:` to avoid camelCase sync drift |
| No agent co-authoring in git commits | — | Human commits only |
| SEC-01: VarChar lengths | All new varchar columns | `note varchar(2000)`, `adminUserId varchar(30)` |
| No ClassSerializerInterceptor | Admin list response | Return full entity directly, no DTO mapping |

**Critical constraint — `events.service.ts` file size:** The file is currently ~404 lines. Adding `findAllForAdmin`, `adminSuspend`, `adminRestore`, `adminRemove`, `writeEventAuditLog`, and supporting helpers will push it past 500 lines. The planner should create a separate `AdminEventsService` in `src/events/admin-events.service.ts` to keep both files under 500 lines. This also satisfies D-05 (clean separation of admin vs. organizer state machine).

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `src/organizers/admin-organizers.controller.ts` — direct template for `AdminEventsController`
- `src/organizers/organizer-audit-log.entity.ts` — direct template for `EventAuditLogEntity`
- `src/events/events.service.ts` — cursor pagination impl (`findOwned`), state machine, `softDelete`
- `src/events/event.entity.ts` — `EventStatus` enum, `@DeleteDateColumn`, CUID2 pattern
- `src/organizers/organizers.service.ts` — `assertTransitionAllowed`, audit log write pattern
- `src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` for `adminUserId` resolution
- `src/database/migrations/1747000000000-organizers.ts` — DDL template for new migration
- `src/database/migrations/1750000000000-rsvps.ts` — migration style reference (enum creation)

### Secondary (MEDIUM confidence — project memory + context)
- `.planning/phases/09-admin-moderation/09-CONTEXT.md` — all locked decisions
- `.planning/STATE.md` — accumulated lessons (Phase 7 column name, Phase 5 admin entity lessons)

### Tertiary (LOW confidence — training knowledge)
- PostgreSQL `ALTER TYPE ... ADD VALUE` cannot run in transaction — standard PG behavior; confirm against Neon docs if unsure
- TypeORM `public readonly transaction = false` migration property — verify against TypeORM MigrationInterface docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all in codebase
- Architecture: HIGH — all patterns verified directly in existing source files
- Migration strategy: MEDIUM — `transaction = false` pattern is standard TypeORM but should be confirmed via Context7
- Pitfalls: HIGH — drawn from project memory and STATE.md lessons

**Research date:** 2026-06-13
**Valid until:** 2026-07-13 (stable stack; 30 days)
