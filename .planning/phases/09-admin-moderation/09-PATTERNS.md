# Phase 9: Admin Moderation - Pattern Map

**Mapped:** 2026-06-13
**Files analyzed:** 12 (new/modified)
**Analogs found:** 12 / 12

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/events/admin-events.controller.ts` | controller | request-response | `src/organizers/admin-organizers.controller.ts` | exact |
| `src/events/admin-events.controller.spec.ts` | test | request-response | `src/organizers/admin-organizers.controller.ts` + existing spec files | role-match |
| `src/events/admin-events.service.ts` | service | CRUD + event-driven | `src/organizers/organizers.service.ts` (approve/reject pattern) | exact |
| `src/events/event-audit-log.entity.ts` | model | CRUD | `src/organizers/organizer-audit-log.entity.ts` | exact |
| `src/events/event.entity.ts` | model | CRUD | self (extend) | self |
| `src/events/events.service.ts` | service | CRUD | self (extend `assertTransitionAllowed`) | self |
| `src/events/events.module.ts` | config | — | self (extend) | self |
| `src/events/dto/admin-event-query.dto.ts` | utility | request-response | `src/events/dto/event-pagination-query.dto.ts` | exact |
| `src/events/dto/admin-event-moderation.dto.ts` | utility | request-response | `src/organizers/dto/approve-organizer.dto.ts` | role-match |
| `src/organizers/admin-organizers.controller.ts` | controller | request-response | self (extend with pagination) | self |
| `src/organizers/organizers.service.ts` | service | CRUD | self (extend findByStatus + approve/reject) | self |
| `src/organizers/organizer-audit-log.entity.ts` | model | CRUD | self (add adminUserId column) | self |
| `src/organizers/dto/organizer-pagination-query.dto.ts` | utility | request-response | `src/events/dto/event-pagination-query.dto.ts` | exact |
| `src/organizers/dto/paginated-organizers-response.dto.ts` | utility | request-response | `src/events/dto/paginated-events-response.dto.ts` | exact |
| `src/database/migrations/1751000000000-admin-event-status.ts` | migration | batch | `src/database/migrations/1747000000000-organizers.ts` | role-match |
| `src/database/migrations/1751000000001-admin-audit-log.ts` | migration | batch | `src/database/migrations/1747000000000-organizers.ts` | exact |

---

## Pattern Assignments

### `src/events/admin-events.controller.ts` (controller, request-response)

**Analog:** `src/organizers/admin-organizers.controller.ts` — direct template; copy structure verbatim and adapt.

**Imports pattern** (`src/organizers/admin-organizers.controller.ts` lines 1-8):
```typescript
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../types/auth';
// inject AdminEventsService (new), not EventsService
import { AdminEventsService } from './admin-events.service';
import { EventAuditLogEntity } from './event-audit-log.entity';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';
import { AdminEventModerationDto } from './dto/admin-event-moderation.dto';
```

**Controller decorator + class pattern** (`src/organizers/admin-organizers.controller.ts` lines 11-15):
```typescript
// Registered at /api/v1/admin/events via global prefix + URI versioning
@ApiTags('Admin - Events')
@ApiBearerAuth()
@Controller('admin/events')
export class AdminEventsController {
  constructor(private readonly adminEventsService: AdminEventsService) {}
```

**@Roles('admin') per-route pattern** (`src/organizers/admin-organizers.controller.ts` lines 17-23):
```typescript
// @Roles('admin') enforced by global RolesGuard (T-05-04-02)
@Roles('admin')
@Get()
@ApiOperation({ summary: 'List all events across all organizers (admin only)' })
@ApiResponse({ status: 200, description: 'Full EventEntity list, cursor-paginated. All statuses, all owners.' })
findAll(@Query() query: AdminEventQueryDto): Promise<PaginatedAdminEventsResponseDto> {
  return this.adminEventsService.findAllForAdmin(query);
}
```

**PATCH sub-resource + 204 pattern** (`src/organizers/admin-organizers.controller.ts` lines 34-42):
```typescript
@Roles('admin')
@Patch(':id/suspend')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Suspend an event (admin only)' })
@ApiResponse({ status: 204, description: 'Event suspended.' })
@ApiResponse({ status: 409, description: 'Invalid state transition.' })
suspend(
  @Param('id') id: string,
  @Body() dto: AdminEventModerationDto,
  @CurrentUser() user: AuthenticatedUser,
): Promise<void> {
  return this.adminEventsService.adminSuspend(id, user.sub, dto.note);
}
```

**DELETE + 204 pattern** (mirrors reject pattern, `src/organizers/admin-organizers.controller.ts` lines 44-52):
```typescript
@Roles('admin')
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Soft-delete (remove) any event regardless of status or owner (admin only)' })
@ApiResponse({ status: 204, description: 'Event removed.' })
remove(
  @Param('id') id: string,
  @Body() dto: AdminEventModerationDto,
  @CurrentUser() user: AuthenticatedUser,
): Promise<void> {
  return this.adminEventsService.adminRemove(id, user.sub, dto.note);
}
```

---

### `src/events/admin-events.service.ts` (service, CRUD + audit)

**Analog:** `src/organizers/organizers.service.ts` (approve/reject + audit log write pattern).

**Imports + class pattern** (`src/organizers/organizers.service.ts` lines 1-25):
```typescript
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { EventEntity, EventStatus } from './event.entity';
import { EventAuditLogEntity, EventAuditAction } from './event-audit-log.entity';
import { PaginatedAdminEventsResponseDto } from './dto/paginated-admin-events-response.dto';
import { AdminEventQueryDto } from './dto/admin-event-query.dto';

@Injectable()
export class AdminEventsService {
  private readonly logger = new Logger(AdminEventsService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventAuditLogEntity)
    private readonly auditLogRepository: Repository<EventAuditLogEntity>,
  ) {}
```

**Cursor pagination (findOwned) pattern** (`src/events/events.service.ts` lines 70-99) — adapt for admin:
```typescript
// findAllForAdmin() — all organizers, all statuses, optional soft-deleted.
// Reuses (startAt, id) keyset from findOwned(); adds withDeleted() and cross-organizer scope.
async findAllForAdmin(query: AdminEventQueryDto): Promise<PaginatedAdminEventsResponseDto> {
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
    const { cursorStartAt, cursorId } = AdminEventsService.decodeCursor(query.cursor);
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
    ? AdminEventsService.encodeCursor(lastItem.startAt, lastItem.id)
    : null;
  // Admin list returns full EventEntity — NOT toResponseDto() (D-08)
  return { data, nextCursor, hasMore };
}
```

**Audit log write pattern** (`src/organizers/organizers.service.ts` lines 80-92) — copy exactly:
```typescript
// writeEventAuditLog() — always use create()+save(), never insert().
// repository.insert() bypasses @BeforeInsert; PK would be null (Pitfall 3).
private async writeEventAuditLog(
  eventId: string,
  action: EventAuditAction,
  adminUserId: string,
  note?: string,
): Promise<void> {
  const log = this.auditLogRepository.create({
    id: createId(),
    eventId,
    action,
    adminUserId,
    note: note ?? null,
  });
  await this.auditLogRepository.save(log);
}
```

**Admin state machine pattern** (mirrors `src/organizers/organizers.service.ts` lines 182-195):
```typescript
// Admin suspend: DRAFT|PUBLISHED → SUSPENDED (D-02). Separate from organizer ALLOWED_TRANSITIONS (D-05).
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

// Admin restore: SUSPENDED → prior status (D-03). Safe default: DRAFT if priorStatus is null.
async adminRestore(eventId: string, adminUserId: string, note?: string): Promise<void> {
  const event = await this.findEventOrThrow(eventId);
  if (event.status !== EventStatus.SUSPENDED) {
    throw new ConflictException(
      `Event '${eventId}' is ${event.status} — only SUSPENDED events can be restored`,
    );
  }
  event.status = event.statusBeforeSuspension ?? EventStatus.DRAFT;
  event.statusBeforeSuspension = null;
  await this.eventRepository.save(event);
  await this.writeEventAuditLog(eventId, EventAuditAction.RESTORED, adminUserId, note);
}

// Admin remove: soft-delete regardless of status or ownership (D-04).
async adminRemove(eventId: string, adminUserId: string, note?: string): Promise<void> {
  await this.findEventOrThrow(eventId);
  await this.eventRepository.softDelete(eventId);
  await this.writeEventAuditLog(eventId, EventAuditAction.REMOVED, adminUserId, note);
}

private async findEventOrThrow(eventId: string): Promise<EventEntity> {
  const event = await this.eventRepository.findOne({ where: { id: eventId } });
  if (!event) throw new NotFoundException(`Event with id '${eventId}' not found`);
  return event;
}
```

**encodeCursor/decodeCursor static methods** (`src/events/events.service.ts` lines 394-403) — copy verbatim, adjust field names if needed:
```typescript
private static encodeCursor(startAt: Date, id: string): string {
  return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
}

private static decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorStartAt, cursorId] = raw.split('__');
  return { cursorStartAt, cursorId };
}
```

---

### `src/events/event-audit-log.entity.ts` (model, CRUD)

**Analog:** `src/organizers/organizer-audit-log.entity.ts` — direct template; copy and adapt.

**Full entity pattern** (`src/organizers/organizer-audit-log.entity.ts` lines 1-47):
```typescript
import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

// Immutable audit record — no UpdateDateColumn. Rows are never updated, only inserted.
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
  @Column({ type: 'varchar', length: 30, name: 'eventId' })
  eventId: string;

  // enumName prevents TypeORM auto-generated name collision with 'organizer_audit_action'
  @ApiProperty({ enum: EventAuditAction })
  @Column({
    type: 'enum',
    enum: EventAuditAction,
    enumName: 'event_audit_action',
  })
  action: EventAuditAction;

  @ApiPropertyOptional({ nullable: true })
  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  // adminUserId: FK → users.id. Always set on new rows (Phase 9+).
  @ApiProperty()
  @Column({ type: 'varchar', length: 30, name: 'adminUserId' })
  adminUserId: string;

  @ApiProperty()
  @CreateDateColumn()
  createdAt: Date;

  // id pre-generated at construction time — repository.insert() skips @BeforeInsert
  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

**Key differences from OrganizerAuditLogEntity:**
- `eventId` FK instead of `organizerId`
- `enum: EventAuditAction { SUSPENDED, RESTORED, REMOVED }` (three values not two)
- `enumName: 'event_audit_action'` (distinct from `'organizer_audit_action'`)
- `adminUserId` column present from day one (Phase 5 deferred this for organizer; Phase 9 adds it to both)

---

### `src/events/event.entity.ts` (model, extend)

**Self-modification. Key additions:**

**Add SUSPENDED to enum** (`src/events/event.entity.ts` lines 18-22) — extend in place:
```typescript
export enum EventStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CANCELLED = 'CANCELLED',
  SUSPENDED = 'SUSPENDED',  // admin-only state (Phase 9 D-01)
}
```

**Add statusBeforeSuspension column** — follow `name:` convention established in Phase 7 (see `src/events/event.entity.ts` line 76 `search_vector` example):
```typescript
// Remembers pre-suspend status for admin restore (D-02, D-03).
// nullable — only set when status is SUSPENDED; null on all other events.
// name: 'statusBeforeSuspension' matches migration DDL column name to prevent TypeORM sync drift (Phase 7 lesson).
@Column({
  type: 'enum',
  enum: EventStatus,
  enumName: 'event_status',
  nullable: true,
  name: 'statusBeforeSuspension',
})
statusBeforeSuspension: EventStatus | null;
```

**Frozen-SUSPENDED guard in events.service.ts** (`src/events/events.service.ts` lines 111-117) — extend `update()`:
```typescript
// Add SUSPENDED to frozen-state guard, mirroring CANCELLED (D-01)
if (event.status === EventStatus.CANCELLED || event.status === EventStatus.SUSPENDED) {
  throw new ConflictException(
    `Event '${eventId}' is ${event.status} — ${event.status.toLowerCase()} events cannot be modified`,
  );
}
```

---

### `src/events/dto/admin-event-query.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/event-pagination-query.dto.ts` — extend with `organizerId` and `includeDeleted`.

**Full pattern** (`src/events/dto/event-pagination-query.dto.ts` lines 1-40):
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { EventStatus } from '../event.entity';

export class AdminEventQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous response nextCursor field' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: EventStatus, description: 'Filter by status. Accepts SUSPENDED. Omit for all.' })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;

  @ApiPropertyOptional({ description: 'Filter by organizerId.' })
  @IsOptional()
  @IsString()
  organizerId?: string;

  @ApiPropertyOptional({ description: 'Include soft-deleted events. Default false.' })
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true' || value === true)
  includeDeleted?: boolean;
}
```

---

### `src/events/dto/admin-event-moderation.dto.ts` (utility, request-response)

**Analog:** `src/organizers/dto/approve-organizer.dto.ts` — single optional note field.

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

// Used for suspend, restore, and remove endpoints. Note persisted in event_audit_log. (D-14)
export class AdminEventModerationDto {
  @ApiPropertyOptional({ description: 'Optional admin note/reason. Max 2000 chars (SEC-01).' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
```

---

### `src/organizers/dto/organizer-pagination-query.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/event-pagination-query.dto.ts` — same shape, typed to OrganizerStatus.

```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { OrganizerStatus } from '../organizer.entity';

export class OrganizerPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous nextCursor field' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;

  @ApiPropertyOptional({ enum: OrganizerStatus, description: 'Filter by status. Omit for all.' })
  @IsOptional()
  @IsEnum(OrganizerStatus)
  status?: OrganizerStatus;
}
```

---

### `src/organizers/dto/paginated-organizers-response.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/paginated-events-response.dto.ts` — same shape, typed to OrganizerEntity.

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrganizerEntity } from '../organizer.entity';

// Admin list returns full OrganizerEntity (not public DTO) — Phase 5 lesson (D-08 equivalent).
export class PaginatedOrganizersResponseDto {
  @ApiProperty({ type: [OrganizerEntity] })
  data: OrganizerEntity[];

  @ApiPropertyOptional({ nullable: true })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
```

---

### `src/organizers/organizers.service.ts` (extend: findByStatus + approve/reject)

**Self-modification. Key changes:**

**findByStatusPaginated() replacing findByStatus()** — cursor on `(createdAt, id)` for organizers (not `startAt`):
```typescript
// findByStatusPaginated() — replaces findByStatus() for admin list (D-10).
// Cursor keyset: (createdAt, id) — organizers have no startAt field (RESEARCH.md Pitfall 6).
async findByStatusPaginated(query: OrganizerPaginationQueryDto): Promise<PaginatedOrganizersResponseDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.organizerRepository
    .createQueryBuilder('organizer')
    .orderBy('organizer.createdAt', 'ASC')
    .addOrderBy('organizer.id', 'ASC')
    .take(effectiveLimit + 1);

  if (query.status) {
    qb.where('organizer."status" = :status', { status: query.status });
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

private static encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}__${id}`).toString('base64url');
}

private static decodeCursor(cursor: string): { cursorCreatedAt: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorCreatedAt, cursorId] = raw.split('__');
  return { cursorCreatedAt, cursorId };
}
```

**approve/reject gain adminUserId param** (`src/organizers/organizers.service.ts` lines 80-92):
```typescript
// approve() signature extends with adminUserId (D-12).
async approve(id: string, adminUserId: string, note?: string): Promise<void> {
  const organizer = await this.findOrganizerOrThrow(id);
  this.assertTransitionAllowed(organizer.status, OrganizerStatus.APPROVED);
  organizer.status = OrganizerStatus.APPROVED;
  await this.organizerRepository.save(organizer);
  const log = this.auditLogRepository.create({
    id: createId(),
    organizerId: id,
    action: OrganizerAuditAction.APPROVED,
    adminUserId,  // new field
    note: note ?? null,
  });
  await this.auditLogRepository.save(log);
}
```

---

### `src/organizers/organizer-audit-log.entity.ts` (extend: add adminUserId)

**Self-modification. Add one column after the existing `note` column:**
```typescript
// adminUserId — which admin approved/rejected. Nullable: existing rows predate Phase 9.
// name: 'adminUserId' matches migration DDL to prevent TypeORM sync drift (Phase 7 lesson).
@ApiPropertyOptional({ nullable: true })
@Column({ type: 'varchar', length: 30, nullable: true, name: 'adminUserId' })
adminUserId: string | null;
```

---

### `src/organizers/admin-organizers.controller.ts` (extend: pagination)

**Self-modification. Replace `findAll` method signature:**
```typescript
// Before (Phase 5):
findAll(@Query() query: { status?: OrganizerStatus }): Promise<OrganizerEntity[]>

// After (Phase 9 D-10):
@Roles('admin')
@Get()
@ApiOperation({ summary: 'List organizers with cursor pagination, optionally filtered by status (admin only)' })
@ApiResponse({ status: 200, type: PaginatedOrganizersResponseDto })
findAll(@Query() query: OrganizerPaginationQueryDto): Promise<PaginatedOrganizersResponseDto> {
  return this.organizersService.findByStatusPaginated(query);
}
```

Also extend approve/reject to pass `@CurrentUser()`:
```typescript
approve(@Param('id') id: string, @Body() dto: ApproveOrganizerDto, @CurrentUser() user: AuthenticatedUser): Promise<void> {
  return this.organizersService.approve(id, user.sub, dto.note);
}
```

---

### Migration `1751000000000-admin-event-status.ts` (migration, batch)

**Analog:** `src/database/migrations/1747000000000-organizers.ts` — DDL style. Critical addition: `transaction = false`.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extends event_status enum with SUSPENDED value and adds statusBeforeSuspension column.
 * ALTER TYPE ADD VALUE cannot run inside a transaction (PostgreSQL restriction).
 * transaction = false tells TypeORM to skip BEGIN/COMMIT for this migration (RESEARCH.md Pitfall 1).
 */
export class AdminEventStatus1751000000000 implements MigrationInterface {
  name = 'AdminEventStatus1751000000000';

  // PostgreSQL: ALTER TYPE ... ADD VALUE cannot run inside a transaction block.
  public readonly transaction = false;

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TYPE "event_status" ADD VALUE IF NOT EXISTS 'SUSPENDED'
    `);
    await queryRunner.query(`
      ALTER TABLE "events"
      ADD COLUMN IF NOT EXISTS "statusBeforeSuspension" "event_status" NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // PostgreSQL does not support DROP VALUE from enum without full type recreate.
    // Drop column only; leave the enum value (safe — no rows will have it after rollback).
    await queryRunner.query(`
      ALTER TABLE "events" DROP COLUMN IF EXISTS "statusBeforeSuspension"
    `);
  }
}
```

---

### Migration `1751000000001-admin-audit-log.ts` (migration, batch)

**Analog:** `src/database/migrations/1747000000000-organizers.ts` lines 13-50 — DDL style for new table + ALTER column.

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates event_audit_log table and adds adminUserId to organizer_audit_log.
 * event_audit_log mirrors organizer_audit_log schema with eventId FK and extended action enum.
 * organizer_audit_log.adminUserId is nullable — existing rows predate Phase 9.
 */
export class AdminAuditLog1751000000001 implements MigrationInterface {
  name = 'AdminAuditLog1751000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "event_audit_action" AS ENUM ('suspended', 'restored', 'removed')
    `);
    await queryRunner.query(`
      CREATE TABLE "event_audit_log" (
        "id"           varchar(30)            NOT NULL,
        "eventId"      varchar(30)            NOT NULL,
        "action"       "event_audit_action"   NOT NULL,
        "note"         varchar(2000)          NULL,
        "adminUserId"  varchar(30)            NULL,
        "createdAt"    TIMESTAMPTZ            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_event_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_event_audit_log_event"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_event_audit_log_admin"
          FOREIGN KEY ("adminUserId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_audit_log_eventId" ON "event_audit_log" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_event_audit_log_createdAt" ON "event_audit_log" ("createdAt")
    `);
    // Add adminUserId to organizer_audit_log — nullable for existing rows (D-12, open question 2)
    await queryRunner.query(`
      ALTER TABLE "organizer_audit_log"
      ADD COLUMN IF NOT EXISTS "adminUserId" varchar(30) NULL
        REFERENCES "users"("id") ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "organizer_audit_log" DROP COLUMN IF EXISTS "adminUserId"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_audit_log_createdAt"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_event_audit_log_eventId"`);
    await queryRunner.query(`DROP TABLE "event_audit_log"`);
    await queryRunner.query(`DROP TYPE "event_audit_action"`);
  }
}
```

---

### `src/events/events.module.ts` (extend)

**Self-modification. Two additions:**

```typescript
// 1. Add EventAuditLogEntity to forFeature array
imports: [
  TypeOrmModule.forFeature([EventEntity, EventTranslationEntity, EventAuditLogEntity]),
  OrganizersModule,
  RsvpModule,
],
// 2. Add AdminEventsController to controllers array
controllers: [EventsController, PublicEventsController, EventsRsvpController, AdminEventsController],
// 3. Add AdminEventsService to providers array
providers: [EventsService, AdminEventsService],
```

---

## Shared Patterns

### Admin Role Gate
**Source:** `src/organizers/admin-organizers.controller.ts` lines 17-18
**Apply to:** Every method in `AdminEventsController`; every new method in `AdminOrganizersController`
```typescript
// @Roles('admin') enforced by global RolesGuard (T-05-04-02)
@Roles('admin')
```

### @CurrentUser() for adminUserId Resolution
**Source:** `src/auth/decorators/current-user.decorator.ts`
**Apply to:** All admin action methods that write audit log rows (suspend, restore, remove, approve, reject)
```typescript
// @CurrentUser() extracts typed user from req.user (set by JwtAuthGuard).
// user.sub is the UserEntity.id used as adminUserId in audit rows.
@CurrentUser() user: AuthenticatedUser
// then: adminUserId = user.sub
```

### Audit Log Write (create + save, not insert)
**Source:** `src/organizers/organizers.service.ts` lines 85-92
**Apply to:** `AdminEventsService.writeEventAuditLog()` and updated `OrganizersService.approve()`/`reject()`
```typescript
// Never use repository.insert() — @BeforeInsert does not fire; PK will be null.
const log = this.auditLogRepository.create({
  id: createId(),   // pre-generate to avoid @BeforeInsert race
  // ...fields
});
await this.auditLogRepository.save(log);
```

### ConflictException Message Format
**Source:** `src/events/events.service.ts` lines 353-358 (`assertTransitionAllowed`)
**Apply to:** All admin state-machine guards in `AdminEventsService`
```typescript
throw new ConflictException(
  `Event '${eventId}' is ${event.status} — only DRAFT and PUBLISHED events can be suspended`,
);
```

### Column `name:` Convention (Phase 7 lesson)
**Source:** `src/events/event.entity.ts` line 76 (`search_vector` example)
**Apply to:** `statusBeforeSuspension` on `EventEntity`; `adminUserId` on `OrganizerAuditLogEntity` and `EventAuditLogEntity`
```typescript
// Always add name: to @Column for new camelCase properties to prevent TypeORM sync drift.
@Column({ name: 'statusBeforeSuspension', ... })
```

---

## No Analog Found

All files in Phase 9 have strong analogs. No new architectural patterns are introduced.

---

## Metadata

**Analog search scope:** `src/events/`, `src/organizers/`, `src/auth/`, `src/database/migrations/`
**Files scanned:** 11 source files read directly
**Pattern extraction date:** 2026-06-13
