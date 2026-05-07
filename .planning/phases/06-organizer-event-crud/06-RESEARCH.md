# Phase 6: Organizer Event CRUD — Research

**Researched:** 2026-05-07
**Domain:** NestJS + TypeORM + PostgreSQL — organizer-owned event management with status lifecycle, soft delete, and cursor pagination
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** CUID2 (`@paralleldrive/cuid2`) for all PKs. No migration cost. UUID migration deferred indefinitely.
- **D-02:** Status transitions strictly one-directional: `draft → published → cancelled`. No reverse transitions.
- **D-03:** Cancelled is a terminal state. No recovery path for organizers.
- **D-04:** Draft events cannot be cancelled — they are deleted (soft-delete). Cancel only applies to published events.
- **D-05:** Published events are editable. Cancelled events are frozen — PATCH returns 409 if status=cancelled.
- **D-06:** Publish gate enforces `startAt > now()`. Returns 422 with message if startAt is in the past.
- **D-07:** PATCH /organizer/events/:id with `{ status: 'published' | 'cancelled' }` drives transitions. Single endpoint. Service validates transition before any DB write.
- **D-08:** Phase 9 admin may add override capabilities. Keep EventsService state machine clean and extensible.
- **D-09:** Create DTO required fields: `title` (varchar 200), `startAt` (timestamptz), `categoryId` (varchar 30).
- **D-10:** Publish gate validates ALL non-null before allowing draft→published: `title`, `description`, `startAt`, `venueName`, `address`, `categoryId`. Returns 422 with array of missing fields.
- **D-11:** `endAt` always optional, even at publish.
- **D-12:** `ticketPrice` and `externalTicketUrl` always optional.
- **D-13:** `description` optional at create, required at publish (gated in D-10). Max length 5000.
- **D-14:** `imageUrl` and `city` deferred to Phase 7. Not added to EventEntity in Phase 6.
- **D-15:** Soft-delete only for draft events. Published or cancelled → 409.
- **D-16:** GET /api/v1/organizer/events — organizer's own events only, excludes soft-deleted.
- **D-17:** Cursor pagination: limit=20 default, max=100. Response: `{ data, nextCursor, hasMore }`.
- **D-18:** Cursor key: composite `(startAt, id)`. Opaque base64-encoded string as `?cursor=` query param.
- **D-19:** Default sort: `startAt ASC`.
- **D-20:** Optional `?status=draft|published|cancelled` filter.
- **D-21:** GET /api/v1/organizer/events/:id — returns 404 if non-owned (no 403 leakage).
- **D-22:** EventsModule at `src/events/`. Controller hosts Phase 6 organizer routes and Phase 7 public routes.
- **D-23:** Phase 6 adds `@ManyToOne(() => OrganizerEntity, { nullable: false })` and `@ManyToOne(() => CategoryEntity, { nullable: true })` to EventEntity.
- **D-24:** `organizerId` made NOT NULL in Phase 6 migration. Existing NULL rows handled in migration (delete or assign placeholder).
- **D-25:** Phase 6 TypeORM migration: ALTER TABLE events — add FK constraint organizerId → organizers(id), add FK constraint categoryId → categories(id), add NOT NULL on organizerId.

### Claude's Discretion

- VarChar lengths for new DTO fields (follow SEC-01 pattern: address 500, venueName 200, externalTicketUrl 2048 — already in entity).
- Exact 422 response body shape for publish gate failures.
- Whether ownership 404 on GET /organizer/events/:id is a hardened 404 — consistent with Phase 5 `findApprovedById()`.
- Index strategy for events table.
- Whether PATCH with `{ status }` and field updates in same request is allowed or transitions are field-only patches.

### Deferred Ideas (OUT OF SCOPE)

- `imageUrl` field — Phase 7
- `city` field — Phase 7
- PATCH /organizer/profile — future phase
- Admin event overrides — Phase 9
- Event translations — Phase 7
- Published → draft unpublish
- startAt/endAt timezone handling for multi-city
- UUID migration
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-04 | Organizer can create, edit, and delete their own events | CRUD service methods + DTO patterns in §Architecture Patterns |
| ORG-05 | Organizer can only manage events they own (ownership enforced at service layer) | §Ownership Enforcement pattern |
| EVT-01 | Create event with all listed fields | EventEntity shape + CreateEventDto field list in §Standard Stack |
| EVT-02 | Status lifecycle draft → published → cancelled | §State Machine pattern + assertTransitionAllowed mirror |
| EVT-05 | Soft delete via deletedAt timestamp | §TypeORM Soft Delete + @DeleteDateColumn already on entity |
</phase_requirements>

---

## Summary

Phase 6 wires the organizer-facing event management surface onto a NestJS + TypeORM + PostgreSQL backend that already has auth, organizer identity resolution, and a baseline `events` table. All patterns for this phase exist in the codebase — EventsModule mirrors the structure of OrganizersModule exactly. The primary technical work is: (1) extending EventEntity with `@ManyToOne` relations and making `organizerId` NOT NULL via a migration, (2) building an EventsService with a state machine modelled directly on `OrganizersService.assertTransitionAllowed()`, (3) a cursor-keyset pagination implementation using raw `WHERE` clauses in a TypeORM QueryBuilder, and (4) a publish gate that returns 422 with a structured missing-field list.

The soft-delete mechanism is already present on `EventEntity` via `@DeleteDateColumn`. TypeORM's `repository.softDelete(id)` handles it; `find()` auto-excludes soft-deleted rows without any filter needed on callers.

Cursor pagination uses a `WHERE (event."startAt", event."id") > (:cursorStartAt, :cursorId)` row-value comparison — a standard PostgreSQL idiom. TypeORM QueryBuilder accepts raw SQL fragments via `.andWhere()`, which keeps the implementation clean without requiring a helper library.

**Primary recommendation:** Mirror OrganizersModule structure exactly — no new patterns needed. QueryBuilder with raw WHERE for cursor pagination; `repository.softDelete()` for soft delete; `assertTransitionAllowed()` clone for the status machine; `UnprocessableEntityException` with a custom response object for the publish gate.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Event ownership enforcement | API / Backend (service layer) | — | D-07, ORG-05: checked in service before any DB write, not in controller |
| Status state machine | API / Backend (service layer) | — | Mirrors OrganizersService assertTransitionAllowed() pattern |
| Publish gate validation | API / Backend (service layer) | — | Business rule requiring DB read of event fields; service owns it |
| JWT identity / organizer resolution | API / Backend (guard layer) | — | OrganizerGuard already resolves `req.organizer` — EventsController reuses it |
| DTO input validation | API / Backend (controller/pipe layer) | — | class-validator + ValidationPipe; @MaxLength guards per SEC-01 |
| Soft delete | Database / Storage | API / Backend | @DeleteDateColumn on entity; repository.softDelete() sets timestamp |
| Cursor pagination | API / Backend (service layer) | Database / Storage | QueryBuilder translates cursor to WHERE clause; PostgreSQL evaluates row-value comparison |
| FK constraint enforcement | Database / Storage | — | Migration adds FK constraints; TypeORM @ManyToOne defines relation |

---

## Standard Stack

### Core (all already installed)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` | 11.0.x | Controllers, guards, exceptions, decorators | Project standard |
| `typeorm` | 0.3.28 | ORM, QueryBuilder, migrations | Project standard |
| `@nestjs/typeorm` | 11.0.x | TypeORM NestJS integration | Project standard |
| `class-validator` | 0.15.x | DTO validation decorators | Project standard, SEC-01 |
| `class-transformer` | 0.5.x | DTO transform (plain→class) | Project standard |
| `@paralleldrive/cuid2` | 3.3.x | CUID2 PK generation | Project standard, D-01 |

[VERIFIED: package.json in project root — all listed above are installed]

### No New Dependencies

All capabilities needed for Phase 6 are covered by the existing stack. No new packages needed:
- Cursor pagination: raw SQL in QueryBuilder — no library needed
- State machine: plain object map + ConflictException — no library needed
- Soft delete: TypeORM @DeleteDateColumn already on entity
- 422 responses: NestJS built-in `UnprocessableEntityException`

### Version Verification

[VERIFIED: package.json]
- `typeorm`: `^0.3.28` — installed
- `@nestjs/common`: `^11.0.1` — installed
- `jest`: `^30.0.0` — installed (test suite runs: 25 tests pass in 4s)

---

## Architecture Patterns

### System Architecture Diagram

```
HTTP Request (JWT validated by global JwtAuthGuard)
         │
         ▼
OrganizerGuard.canActivate()
  │  calls OrganizersService.findApprovedByUserId(user.id)
  │  attaches → req.organizer (OrganizerEntity)
  │  throws 403 if not approved organizer
         │
         ▼
EventsController (src/events/events.controller.ts)
  │  @CurrentOrganizer() → OrganizerEntity
  │  @Param('id') → string
  │  @Body() → DTO (class-validator)
  │  @Query() → cursor, limit, status
         │
         ▼
EventsService (src/events/events.service.ts)
  ├── create(organizerId, dto) → EventEntity
  ├── findOwned(organizerId, paginationDto) → PaginatedEventsDto
  ├── findOwnedById(organizerId, eventId) → EventEntity
  ├── update(organizerId, eventId, dto) → EventEntity
  │     ├── assertTransitionAllowed(current, target)  [status only]
  │     └── assertPublishGate(event)  [before → published]
  └── softDeleteDraft(organizerId, eventId) → void
         │
         ▼
TypeORM Repository<EventEntity>
  ├── repository.save(entity)
  ├── repository.softDelete(id)       → sets deletedAt
  ├── repository.find({ where: ... }) → auto-excludes deletedAt IS NOT NULL
  └── repository.createQueryBuilder("event")
        .where("event.organizerId = :orgId")
        .andWhere("(event.startAt, event.id) > (:cs, :ci)", { cs, ci })
        .orderBy("event.startAt", "ASC").addOrderBy("event.id", "ASC")
        .take(limit + 1)
        .getMany()
         │
         ▼
PostgreSQL — events table
  FK: organizerId → organizers(id)
  FK: categoryId → categories(id)
  organizerId NOT NULL (after Phase 6 migration)
```

### Recommended Project Structure

```
src/events/
├── event.entity.ts          # extend with @ManyToOne relations
├── events.module.ts         # new
├── events.service.ts        # new
├── events.controller.ts     # new
├── events.service.spec.ts   # Wave 0 RED stubs → Wave 1 green
├── events.controller.spec.ts
└── dto/
    ├── create-event.dto.ts
    ├── update-event.dto.ts
    ├── event-response.dto.ts
    ├── paginated-events-response.dto.ts
    └── event-pagination-query.dto.ts

src/database/migrations/
└── 1748000000000-events-fk.ts   # new migration
```

---

### Pattern 1: State Machine — assertTransitionAllowed()

Direct mirror of `OrganizersService.assertTransitionAllowed()`.

**What:** Validate event status transitions before any DB write. Throw `ConflictException` (409) on illegal transitions.

**When to use:** Any service method that changes `event.status`.

```typescript
// Source: mirrors src/organizers/organizers.service.ts assertTransitionAllowed()
private assertTransitionAllowed(current: EventStatus, target: EventStatus): void {
  const allowed: Partial<Record<EventStatus, EventStatus[]>> = {
    [EventStatus.DRAFT]: [EventStatus.PUBLISHED],
    [EventStatus.PUBLISHED]: [EventStatus.CANCELLED],
    // CANCELLED: terminal — no outgoing transitions per D-02, D-03
  };
  if (!allowed[current]?.includes(target)) {
    throw new ConflictException(
      `Event is already ${current} — transition to ${target} is not allowed`,
    );
  }
}
```

**Key detail:** `assertTransitionAllowed` is called BEFORE the publish gate check. If a caller tries `cancelled → published`, the transition check fires first and returns 409 before the publish gate ever runs.

---

### Pattern 2: Ownership Enforcement

**What:** Load event by `(id, organizerId)` compound where-clause; throw 404 if no match. Never throw 403 (D-21 — no info leakage on non-owned resource).

**When to use:** All event mutations (PATCH, DELETE) and the single-event GET.

```typescript
// Source: mirrors findApprovedById() pattern in organizers.service.ts
private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
  // Single query with both conditions — no two-step load+check
  const event = await this.eventRepository.findOne({
    where: { id: eventId, organizerId },
  });
  if (!event) {
    // 404 regardless of whether event exists but belongs to different organizer (D-21)
    throw new NotFoundException(`Event with id '${eventId}' not found`);
  }
  return event;
}
```

**Why compound WHERE, not load-then-check:** A two-step approach (load by id, check organizerId) leaks the existence of the event to the organizer. The compound WHERE eliminates that.

---

### Pattern 3: Publish Gate — assertPublishGate()

**What:** Before draft→published transition, verify all required fields are non-null and `startAt > now()`. Return 422 with structured missing-field list (D-10, D-06).

```typescript
// Source: [ASSUMED] — NestJS UnprocessableEntityException with custom response body
private assertPublishGate(event: EventEntity): void {
  const requiredFields: (keyof EventEntity)[] = [
    'title', 'description', 'startAt', 'venueName', 'address', 'categoryId',
  ];
  const missing = requiredFields.filter((f) => event[f] === null || event[f] === undefined);
  if (missing.length > 0) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      message: 'Cannot publish: missing required fields',
      missing,
    });
  }
  if (event.startAt <= new Date()) {
    throw new UnprocessableEntityException({
      statusCode: 422,
      message: 'Cannot publish: event date has passed',
      missing: [],
    });
  }
}
```

**NestJS note:** `UnprocessableEntityException` accepts an object as its first argument; NestJS serializes it as the response body directly. The standard `{ statusCode, message }` shape is preserved when an object is passed.

[VERIFIED: @nestjs/common source — UnprocessableEntityException constructor accepts `objectOrError: string | object | any`]

---

### Pattern 4: Cursor Pagination — QueryBuilder with Row-Value Comparison

**What:** Keyset (cursor) pagination on composite `(startAt, id)` using PostgreSQL row-value comparison syntax. No offset, no count query, O(log n) via index.

**Cursor encoding:** `base64(ISO8601-startAt + '__' + id)` — no external library. Pure Buffer operations.

```typescript
// Source: [VERIFIED: TypeORM QueryBuilder docs — andWhere accepts raw SQL fragments]
// Cursor encode/decode (no library needed):
function encodeCursor(startAt: Date, id: string): string {
  return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
}
function decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorStartAt, cursorId] = raw.split('__');
  return { cursorStartAt, cursorId };
}

// QueryBuilder for paginated list:
async findOwned(
  organizerId: string,
  cursor: string | undefined,
  limit: number,
  status?: EventStatus,
): Promise<PaginatedEventsDto> {
  const effectiveLimit = Math.min(limit, 100);
  const qb = this.eventRepository
    .createQueryBuilder('event')
    .where('event.organizerId = :organizerId', { organizerId })
    .orderBy('event.startAt', 'ASC')
    .addOrderBy('event.id', 'ASC')
    .take(effectiveLimit + 1); // fetch +1 to detect hasMore

  if (status) {
    qb.andWhere('event.status = :status', { status });
  }
  if (cursor) {
    const { cursorStartAt, cursorId } = decodeCursor(cursor);
    // PostgreSQL row-value comparison: (a, b) > (x, y) means
    // a > x OR (a = x AND b > y) — stable across identical startAt values
    qb.andWhere(
      '(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)',
      { cursorStartAt, cursorId },
    );
  }

  const rows = await qb.getMany();
  const hasMore = rows.length > effectiveLimit;
  const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const lastRow = data[data.length - 1];
  const nextCursor = hasMore && lastRow
    ? encodeCursor(lastRow.startAt, lastRow.id)
    : null;

  return { data, nextCursor, hasMore };
}
```

**PostgreSQL row-value comparison note:** The SQL `(col1, col2) > (:p1, :p2)` is valid standard SQL and PostgreSQL-native. TypeORM's `andWhere()` passes the string fragment verbatim to the DB driver. The `:cursorStartAt::timestamptz` cast is necessary because the cursor value arrives as a string.

[VERIFIED: TypeORM docs — andWhere() accepts raw SQL with named parameter binding; ASSUMED: PostgreSQL row-value comparison syntax is correct as described]

---

### Pattern 5: Soft Delete

**What:** TypeORM `repository.softDelete(id)` sets `deletedAt` timestamp. All subsequent `find()` calls automatically filter `WHERE deletedAt IS NULL`. Only draft events may be soft-deleted (D-15).

```typescript
// Source: https://github.com/n8n-io/typeorm/blob/master/docs/repository-api.md
async softDeleteDraft(organizerId: string, eventId: string): Promise<void> {
  const event = await this.findOwnedOrThrow(eventId, organizerId);
  if (event.status !== EventStatus.DRAFT) {
    throw new ConflictException(
      `Cannot delete event with status ${event.status} — only draft events are deletable`,
    );
  }
  await this.eventRepository.softDelete(eventId);
}
```

**Key:** `@DeleteDateColumn` is already on EventEntity (line 74 of event.entity.ts). No entity change needed for soft delete mechanics. Only the service guard (draft-only) is new logic.

**softDelete() vs softRemove():** Use `repository.softDelete(id)` — accepts a primary key directly, one DB round-trip. `softRemove(entity)` requires a loaded entity first (two round-trips). Since we already load the entity for ownership + status check, either works; `softDelete(id)` after validation is conventional.

[VERIFIED: TypeORM repository-api.md — `softDelete(criteria)` sets DeleteDateColumn]

---

### Pattern 6: TypeORM Migration — ALTER TABLE with FK Constraints

**What:** Add FK constraints to existing `events` table; make `organizerId` NOT NULL; handle existing NULL rows.

```typescript
// Source: mirrors 1747000000000-organizers.ts migration pattern
export class EventsFk1748000000000 implements MigrationInterface {
  name = 'EventsFk1748000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Delete any orphaned events with NULL organizerId
    // (safer than assigning a placeholder — no valid organizer to assign to)
    await queryRunner.query(`DELETE FROM "events" WHERE "organizerId" IS NULL`);

    // Step 2: Make organizerId NOT NULL (safe after step 1)
    await queryRunner.query(`
      ALTER TABLE "events"
        ALTER COLUMN "organizerId" SET NOT NULL
    `);

    // Step 3: Add FK constraint organizerId → organizers(id)
    await queryRunner.query(`
      ALTER TABLE "events"
        ADD CONSTRAINT "FK_events_organizerId"
          FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE
    `);

    // Step 4: Add FK constraint categoryId → categories(id) (nullable)
    await queryRunner.query(`
      ALTER TABLE "events"
        ADD CONSTRAINT "FK_events_categoryId"
          FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL
    `);

    // Step 5: Add indexes for query patterns (organizer list + status filter)
    await queryRunner.query(`
      CREATE INDEX "IDX_events_organizerId" ON "events" ("organizerId")
    `);
    await queryRunner.query(`
      CREATE INDEX "IDX_events_startAt_id" ON "events" ("startAt" ASC, "id" ASC)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_events_startAt_id"`);
    await queryRunner.query(`DROP INDEX "IDX_events_organizerId"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_categoryId"`);
    await queryRunner.query(`ALTER TABLE "events" DROP CONSTRAINT "FK_events_organizerId"`);
    await queryRunner.query(`ALTER TABLE "events" ALTER COLUMN "organizerId" DROP NOT NULL`);
  }
}
```

**NULL row strategy:** Delete rows where `organizerId IS NULL`. This is correct for a dev database where no real events exist yet. The planner should confirm this approach; the alternative (assign a placeholder organizer ID) would require seeding a throwaway organizer row.

[VERIFIED: 1747000000000-organizers.ts — identical raw SQL pattern using queryRunner.query()]
[CITED: TypeORM migration docs — `queryRunner.query()` executes arbitrary SQL]

---

### Pattern 7: EventEntity — Adding @ManyToOne Relations

```typescript
// Source: mirrors OrganizerEntity FK pattern; CITED: TypeORM many-to-one docs
import { ManyToOne, JoinColumn } from 'typeorm';
import { OrganizerEntity } from '../organizers/organizer.entity';
import { CategoryEntity } from '../categories/category.entity';

// Add to EventEntity class:
@ManyToOne(() => OrganizerEntity, { nullable: false })
@JoinColumn({ name: 'organizerId' })
organizer: OrganizerEntity;

// organizerId column stays as explicit @Column (already present) —
// having both @Column and @ManyToOne with JoinColumn is the correct TypeORM
// pattern for accessing the FK value without loading the relation object.

@ManyToOne(() => CategoryEntity, { nullable: true })
@JoinColumn({ name: 'categoryId' })
category: CategoryEntity;
```

**Why keep explicit @Column for organizerId:** EventsService uses `event.organizerId` for ownership checks throughout. Without the explicit `@Column`, the FK value is only accessible after loading the relation (`.organizer.id`), which requires an extra JOIN. Keep the explicit column for direct FK access.

[VERIFIED: TypeORM docs — @Column + @ManyToOne with @JoinColumn is valid; VERIFIED: existing codebase uses direct FK string columns]

---

### Pattern 8: TDD Wave 0 — RED Stubs

The project uses TDD mode (`tdd_mode: true` in config.json). Wave 0 creates test files that import not-yet-existing modules, intentionally failing compilation. Wave 1 makes them pass.

**Service spec setup** (mirrors `organizers.service.spec.ts`):

```typescript
// src/events/events.service.spec.ts — Wave 0 RED stub
import { ConflictException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EventsService } from './events.service'; // does not exist yet in Wave 0
import { EventEntity, EventStatus } from './event.entity';

const mockEventRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  find: jest.fn(),
  softDelete: jest.fn(),
  createQueryBuilder: jest.fn(),
};

describe('EventsService', () => {
  let service: EventsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventsService,
        { provide: getRepositoryToken(EventEntity), useValue: mockEventRepository },
      ],
    }).compile();
    service = module.get<EventsService>(EventsService);
  });
  // ... test cases
});
```

**Controller spec setup** (mirrors `organizers.controller.spec.ts`):

```typescript
// src/events/events.controller.spec.ts — Wave 0 RED stub
import { EventsController } from './events.controller'; // does not exist yet
import { EventsService } from './events.service';

const mockEventsService = {
  create: jest.fn(),
  findOwned: jest.fn(),
  findOwnedById: jest.fn(),
  update: jest.fn(),
  softDeleteDraft: jest.fn(),
};

describe('EventsController', () => {
  let controller: EventsController;
  beforeEach(() => {
    jest.clearAllMocks();
    // Direct instantiation — no TestingModule (mirrors organizers.controller.spec.ts)
    controller = new EventsController(mockEventsService as unknown as EventsService);
  });
  // ... test cases
});
```

**`createQueryBuilder` mock for pagination tests:**

```typescript
// QueryBuilder mock for findOwned()
const mockQb = {
  where: jest.fn().mockReturnThis(),
  andWhere: jest.fn().mockReturnThis(),
  orderBy: jest.fn().mockReturnThis(),
  addOrderBy: jest.fn().mockReturnThis(),
  take: jest.fn().mockReturnThis(),
  getMany: jest.fn(),
};
mockEventRepository.createQueryBuilder.mockReturnValue(mockQb);
mockQb.getMany.mockResolvedValue([/* stub events */]);
```

[VERIFIED: pattern matches organizers.service.spec.ts exactly]

---

### Pattern 9: EventsModule Wiring

```typescript
// src/events/events.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { OrganizersModule } from '../organizers/organizers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EventEntity]),
    OrganizersModule,  // provides OrganizerGuard (needs OrganizersService)
  ],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
```

**Why import OrganizersModule:** `OrganizerGuard` injects `OrganizersService`. Since EventsController uses `@UseGuards(OrganizerGuard)`, the module needs `OrganizersService` in scope. `OrganizersModule` already exports `OrganizersService` (confirmed in organizers.module.ts line 14).

Then in `src/app.module.ts`, add `EventsModule` to `imports[]`.

[VERIFIED: src/organizers/organizers.module.ts — `exports: [OrganizersService]`]

---

### Pattern 10: Controller — Route Declaration Order

Route registration order matters in NestJS — static segments must be declared before parameterized ones. For the organizer events controller:

```typescript
// GET /organizer/events must come before GET /organizer/events/:id
// to prevent 'undefined' being matched as an :id param
@Get()
findOwned(...) { ... }  // FIRST

@Get(':id')
findOwnedById(...) { ... }  // SECOND
```

[VERIFIED: src/organizers/organizers.controller.ts line 33 comment — same pattern documented]

---

### Anti-Patterns to Avoid

- **Checking ownership after loading, not in WHERE clause:** Loading event by id alone then checking `event.organizerId !== organizer.id` leaks event existence. Always use compound `{ where: { id, organizerId } }`.
- **Using `repository.insert()` for event creation:** `@BeforeInsert()` fires on `repository.save()` but NOT on `repository.insert()`. Always use `create()` + `save()` for entities with `@BeforeInsert`.
- **`take()`/`skip()` for cursor pagination:** `skip()` is offset-based (full table scan from offset). Use keyset WHERE clause for cursor pagination.
- **Calling `assertPublishGate` before `assertTransitionAllowed`:** Check that the transition is structurally valid (409) before checking gate fields (422). Order: load event → ownership → transition validity → publish gate → save.
- **`withDeleted: true` on organizer list query:** The `findOwned()` paginated list should NOT include soft-deleted events (D-16). Default TypeORM behavior (exclude deletedAt rows) is correct — do not add `withDeleted`.
- **Putting status transition logic in the controller:** All business rules (state machine, ownership, publish gate) live in the service layer. Controller only extracts inputs, delegates to service, maps response.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FK validation on organizerId | Custom existence check | TypeORM FK constraint + migration | DB enforces referential integrity at insert time |
| Soft delete filtering | Manual `WHERE deletedAt IS NULL` | TypeORM `@DeleteDateColumn` + `repository.find()` | Auto-applied; `withDeleted: true` opt-in for admin |
| CUID2 generation | Custom ID generator | `createId()` from `@paralleldrive/cuid2` | Collision-resistant, URL-safe, monotonic |
| Base64 encode/decode | Third-party lib | `Buffer.from().toString('base64url')` / `Buffer.from(s, 'base64url').toString()` | Node.js built-in, zero deps |
| Input validation | Manual `if` checks in service | `class-validator` decorators on DTOs + global `ValidationPipe` | Consistent 400 errors with field paths |

**Key insight:** The project has established patterns for every problem in Phase 6. New code should look like existing code, not introduce new mechanisms.

---

## Common Pitfalls

### Pitfall 1: PostgreSQL Composite Row-Value Comparison Requires Explicit Type Cast

**What goes wrong:** `(event."startAt", event."id") > (:cursorStartAt, :cursorId)` fails with type mismatch because `:cursorStartAt` is bound as `text`.

**Why it happens:** TypeORM parameter binding treats all parameters as strings unless told otherwise. PostgreSQL cannot compare `timestamptz` to `text` without a cast.

**How to avoid:** Cast the cursor timestamp in the SQL fragment: `:cursorStartAt::timestamptz`. The id parameter is `varchar` so no cast needed.

**Warning signs:** `ERROR: operator does not exist: timestamp with time zone > text`

---

### Pitfall 2: @BeforeInsert Does Not Fire on repository.insert()

**What goes wrong:** CUID2 ID is undefined; insert fails on NOT NULL primary key.

**Why it happens:** TypeORM's `@BeforeInsert` hook fires on `save()` but is skipped by `insert()`.

**How to avoid:** Always use `repository.create({ ... })` + `repository.save(entity)` for event creation. Never `repository.insert()`.

[VERIFIED: codebase — all entities use `create()` + `save()` pattern; commented warning in categories.service.ts line 32]

---

### Pitfall 3: OrganizerGuard Requires OrganizersModule in EventsModule Imports

**What goes wrong:** `Nest cannot export a provider that is not provided in the current module` or `Error: Nest can't resolve dependencies of the OrganizerGuard`.

**Why it happens:** `OrganizerGuard` injects `OrganizersService`. If `EventsModule` does not import `OrganizersModule`, the DI container cannot satisfy the guard's dependency.

**How to avoid:** Import `OrganizersModule` in `EventsModule` (it exports `OrganizersService`).

**Warning signs:** Runtime DI error at app startup mentioning `OrganizersService` or `OrganizerGuard`.

[VERIFIED: src/organizers/organizers.module.ts — `exports: [OrganizersService]`]

---

### Pitfall 4: Cancelled Events Must Reject Both Field Updates and Status Transitions

**What goes wrong:** A PATCH to a cancelled event with only field changes (no `status` in body) proceeds, because the `assertTransitionAllowed` is only called when `dto.status` is present.

**Why it happens:** Developer adds a separate `if (dto.status)` branch for transitions, and a separate branch for field updates, without checking frozen state before field updates.

**How to avoid:** Check cancelled status first in `update()`, before any other logic:

```typescript
async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<EventEntity> {
  const event = await this.findOwnedOrThrow(eventId, organizerId);
  if (event.status === EventStatus.CANCELLED) {
    throw new ConflictException('Cannot modify a cancelled event');
  }
  if (dto.status) {
    this.assertTransitionAllowed(event.status, dto.status);
    if (dto.status === EventStatus.PUBLISHED) {
      // Apply any field changes from dto first, then validate gate
      Object.assign(event, fieldsFrom(dto));
      this.assertPublishGate(event);
    }
  }
  // ... apply fields, save
}
```

---

### Pitfall 5: Decimal ticketPrice Returned as String from PostgreSQL

**What goes wrong:** `event.ticketPrice` is `"12.50"` (string) instead of `12.50` (number) in the response.

**Why it happens:** PostgreSQL DECIMAL/NUMERIC returns strings via the `pg` driver. TypeORM passes through without coercing by default.

**How to avoid:** The transformer is already on the entity (event.entity.ts lines 44-53). Do not remove it. In the response DTO, declare `ticketPrice: number | null` — the transformer handles DB→JS coercion at hydration time.

[VERIFIED: src/events/event.entity.ts lines 44-53 — transformer present]

---

### Pitfall 6: ALTER COLUMN SET NOT NULL Fails if NULL Rows Exist

**What goes wrong:** Migration fails with `ERROR: column "organizerId" of relation "events" contains null values` when attempting `ALTER COLUMN "organizerId" SET NOT NULL`.

**Why it happens:** The column has existing NULL rows and PostgreSQL cannot enforce the NOT NULL constraint until they are removed or updated.

**How to avoid:** Delete or update NULL rows BEFORE the `ALTER COLUMN SET NOT NULL` statement in the migration `up()` function. The research recommends `DELETE FROM events WHERE organizerId IS NULL` as the safer option for a dev database.

---

## Code Examples

### Full EventsService Skeleton

```typescript
// src/events/events.service.ts
import {
  ConflictException, Injectable, Logger, NotFoundException, UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { createId } from '@paralleldrive/cuid2';
import { EventEntity, EventStatus } from './event.entity';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventPaginationQueryDto } from './dto/event-pagination-query.dto';
import { PaginatedEventsDto } from './dto/paginated-events-response.dto';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
  ) {}

  async create(organizerId: string, dto: CreateEventDto): Promise<EventEntity> {
    const entity = this.eventRepository.create({
      // CUID2 via @BeforeInsert — do NOT pre-assign id here
      organizerId,
      ...dto,
      status: EventStatus.DRAFT,
    });
    return this.eventRepository.save(entity);
  }

  async findOwned(organizerId: string, query: EventPaginationQueryDto): Promise<PaginatedEventsDto> {
    // ... QueryBuilder cursor pagination (Pattern 4 above)
  }

  async findOwnedById(organizerId: string, eventId: string): Promise<EventEntity> {
    return this.findOwnedOrThrow(eventId, organizerId);
  }

  async update(organizerId: string, eventId: string, dto: UpdateEventDto): Promise<EventEntity> {
    const event = await this.findOwnedOrThrow(eventId, organizerId);
    if (event.status === EventStatus.CANCELLED) {
      throw new ConflictException('Cannot modify a cancelled event');
    }
    if (dto.status !== undefined) {
      this.assertTransitionAllowed(event.status, dto.status);
    }
    // Apply field changes before publish gate so gate sees the merged state
    const { status, ...fields } = dto;
    Object.assign(event, fields);
    if (dto.status === EventStatus.PUBLISHED) {
      this.assertPublishGate(event);
    }
    if (dto.status !== undefined) {
      event.status = dto.status;
    }
    return this.eventRepository.save(event);
  }

  async softDeleteDraft(organizerId: string, eventId: string): Promise<void> {
    const event = await this.findOwnedOrThrow(eventId, organizerId);
    if (event.status !== EventStatus.DRAFT) {
      throw new ConflictException(
        `Cannot delete event with status ${event.status} — only draft events are deletable`,
      );
    }
    await this.eventRepository.softDelete(eventId);
  }

  private assertTransitionAllowed(current: EventStatus, target: EventStatus): void {
    const allowed: Partial<Record<EventStatus, EventStatus[]>> = {
      [EventStatus.DRAFT]: [EventStatus.PUBLISHED],
      [EventStatus.PUBLISHED]: [EventStatus.CANCELLED],
    };
    if (!allowed[current]?.includes(target)) {
      throw new ConflictException(
        `Event is already ${current} — transition to ${target} is not allowed`,
      );
    }
  }

  private assertPublishGate(event: EventEntity): void {
    const requiredFields: (keyof EventEntity)[] = [
      'title', 'description', 'startAt', 'venueName', 'address', 'categoryId',
    ];
    const missing = requiredFields.filter((f) => event[f] == null);
    if (missing.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Cannot publish: missing required fields',
        missing,
      });
    }
    if (event.startAt <= new Date()) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: 'Cannot publish: event date has passed',
        missing: [],
      });
    }
  }

  private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
    const event = await this.eventRepository.findOne({
      where: { id: eventId, organizerId },
    });
    if (!event) {
      throw new NotFoundException(`Event with id '${eventId}' not found`);
    }
    return event;
  }
}
```

### EventPaginationQueryDto

```typescript
// src/events/dto/event-pagination-query.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { EventStatus } from '../event.entity';

export class EventPaginationQueryDto {
  @ApiPropertyOptional({ description: 'Opaque cursor from previous page' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| offset/skip pagination | keyset cursor pagination | NestJS/TypeORM ecosystem standard | Stable pages, O(log n) via index, no page drift |
| Physical delete | Soft delete via `@DeleteDateColumn` | TypeORM 0.2+ | Auditability, accidental recovery, admin visibility |
| Separate `/publish` endpoint | PATCH with `{ status: 'published' }` | REST maturity model preference | Fewer endpoints, status as a field, mirrors CRUD |

**Deprecated/outdated:**
- `repository.delete()` for events: replaced by `repository.softDelete()` per EVT-05.
- `skip()`/offset for event listing: replaced by keyset cursor per D-18.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `UnprocessableEntityException` serializes an object argument as the response body directly | Pattern 3 (Publish Gate) | Response body shape may differ; easy to test with a quick manual check |
| A2 | PostgreSQL row-value comparison `(col1, col2) > (:p1::timestamptz, :p2)` is valid in TypeORM `andWhere()` raw fragment | Pattern 4 (Cursor Pagination) | Pagination WHERE clause may need rewriting as OR-expanded form |
| A3 | DELETE FROM events WHERE organizerId IS NULL is safe on this database (no real data to preserve) | Pattern 6 (Migration) | If real event data exists, deletion loses it; use UPDATE to assign a placeholder instead |
| A4 | `@ManyToOne` + `@JoinColumn` on EventEntity does not conflict with the existing `@Column` for `organizerId` | Pattern 7 (ManyToOne relations) | TypeORM may throw duplicate column mapping error; mitigation: drop the explicit `@Column` and access FK via `event.organizer.id` |

**A4 mitigation detail:** In TypeORM, having both `@Column({ name: 'organizerId' })` and `@ManyToOne` with `@JoinColumn({ name: 'organizerId' })` is a supported pattern when using "relation + explicit FK column" style. The `@JoinColumn` annotation is optional on `@ManyToOne` (TypeORM infers `organizerId` from the relation name). Existing entity already has the `@Column`; adding `@ManyToOne` without `@JoinColumn` avoids any ambiguity. If conflicts appear, remove `@JoinColumn` from the `@ManyToOne` decoration.

---

## Open Questions

1. **NULL organizerId row cleanup strategy**
   - What we know: The baseline migration created `events` with `organizerId` nullable. Any existing rows with NULL organizerId will block `ALTER COLUMN SET NOT NULL`.
   - What's unclear: Does the dev/staging database have real event rows with NULL organizerId that should be preserved?
   - Recommendation: Planner should confirm. Research defaults to DELETE (dev database, no real data). If real data exists, assign a seed organizer ID instead.

2. **PATCH: combined field update + status transition in one request**
   - What we know: D-07 says single endpoint drives transitions. Context.md Claude's Discretion: planner decides whether combined update is allowed.
   - What's unclear: If a PATCH sends `{ title: "New Title", status: "published" }`, should the title change AND the publish transition happen atomically? Or should status-only PATCH and field-only PATCH be enforced as separate operations?
   - Recommendation: Allow combined update. Service applies field changes to the in-memory entity first, then runs assertPublishGate against the merged state, then saves once. This is the most ergonomic and correct behavior.

3. **ON DELETE behavior for FK_events_organizerId**
   - What we know: Migration adds FK constraint `organizerId → organizers(id)`.
   - What's unclear: What happens to an organizer's events if the organizer is deleted? `ON DELETE CASCADE` deletes all events; `ON DELETE RESTRICT` prevents organizer deletion while events exist; `ON DELETE SET NULL` would conflict with NOT NULL.
   - Recommendation: `ON DELETE CASCADE` is safest for data integrity (orphaned events are never surfaced). Matches the `organizer_audit_log` FK pattern in the Phase 5 migration.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Runtime | Yes | v24.15.0 | — |
| pnpm | Package manager | Yes | 10.33.2 | — |
| Jest | Test runner | Yes | ^30.0.0 (package.json) | — |
| PostgreSQL | Migration execution | No (not running) | — | Tests use mocked repositories; migration tested on next `pnpm run migration:run` |
| TypeORM CLI | Migration generation | Yes (via pnpm script) | 0.3.28 | — |

**Missing dependencies with no fallback:**
- PostgreSQL not responding at localhost:5432. Migration cannot be run locally until DB is started. Unit tests are unaffected (all DB calls mocked).

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest ^30.0.0 + ts-jest ^29.2.5 |
| Config file | `package.json` (`jest` key) |
| Quick run command | `pnpm test -- --testPathPattern="events"` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORG-04 | create event returns entity with DRAFT status | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| ORG-04 | update event saves field changes | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| ORG-04 | softDeleteDraft removes draft event | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| ORG-05 | findOwnedOrThrow returns 404 for non-owned event | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-01 | CreateEventDto validates required fields (title, startAt, categoryId) | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-02 | assertTransitionAllowed throws 409 on draft → cancelled | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-02 | assertTransitionAllowed throws 409 on cancelled → published | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-02 | assertPublishGate throws 422 with missing field list | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-02 | assertPublishGate throws 422 when startAt in the past | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-05 | softDeleteDraft calls repository.softDelete | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| EVT-05 | softDeleteDraft throws 409 on non-draft event | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| D-17/D-18 | findOwned returns paginated result with nextCursor and hasMore | unit | `pnpm test -- --testPathPattern="events.service"` | ❌ Wave 0 |
| ORG-04 | controller.create delegates to service and returns result | unit | `pnpm test -- --testPathPattern="events.controller"` | ❌ Wave 0 |
| ORG-04 | controller.update propagates ConflictException | unit | `pnpm test -- --testPathPattern="events.controller"` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm test -- --testPathPattern="events"`
- **Per wave merge:** `pnpm test`
- **Phase gate:** `pnpm test` full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/events/events.service.spec.ts` — covers ORG-04, ORG-05, EVT-01, EVT-02, EVT-05, D-17/18
- [ ] `src/events/events.controller.spec.ts` — covers ORG-04 controller delegation
- [ ] `src/events/events.service.ts` — stub import (Wave 0 RED)
- [ ] `src/events/events.controller.ts` — stub import (Wave 0 RED)
- [ ] `src/events/events.module.ts` — module declaration
- [ ] `src/events/dto/create-event.dto.ts` — required field validators
- [ ] `src/events/dto/update-event.dto.ts` — partial + status enum
- [ ] `src/events/dto/event-response.dto.ts` — manual mapping target
- [ ] `src/events/dto/paginated-events-response.dto.ts` — pagination response shape
- [ ] `src/events/dto/event-pagination-query.dto.ts` — query param validators
- [ ] `src/database/migrations/1748000000000-events-fk.ts` — FK migration

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | Auth0 JWT; JwtAuthGuard global; OrganizerGuard on all organizer routes |
| V3 Session Management | No | Stateless JWT — no server-side session |
| V4 Access Control | Yes | OrganizerGuard (approved organizer check); ownership check in service (ORG-05) |
| V5 Input Validation | Yes | class-validator + @MaxLength per SEC-01; ValidationPipe global |
| V6 Cryptography | No | No encryption needed for event data |

### Known Threat Patterns for NestJS + TypeORM

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Organizer A manipulates Organizer B's events | Tampering | `findOwnedOrThrow(eventId, organizerId)` — compound WHERE; 404 on non-ownership |
| SQL injection via cursor parameter | Tampering | TypeORM named parameters (`:cursorStartAt`, `:cursorId`) — parameterized, never string-concatenated |
| Oversized string input reaching DB | Tampering/DoS | @MaxLength decorators on all DTO string fields (SEC-01); VarChar limits already on entity |
| Status transition manipulation (skip states) | Tampering | `assertTransitionAllowed()` in service layer; transition map is the single source of truth |
| Soft-deleted event resurrection | Tampering | `softDelete()` sets deletedAt; find() auto-filters; no restore endpoint in Phase 6 |
| JWT userId spoofing | Spoofing | `@CurrentOrganizer()` from `req.organizer` set by OrganizerGuard — never from request body |

---

## Sources

### Primary (HIGH confidence)
- `/n8n-io/typeorm` (Context7) — QueryBuilder, soft delete, @DeleteDateColumn, repository.softDelete(), withDeleted, @ManyToOne, migration patterns
- `src/organizers/organizers.service.ts` — assertTransitionAllowed pattern (exact code to mirror)
- `src/organizers/organizers.service.spec.ts` — TestingModule + getRepositoryToken mock pattern
- `src/organizers/organizers.controller.spec.ts` — direct instantiation controller spec pattern
- `src/events/event.entity.ts` — existing entity shape, @DeleteDateColumn already present
- `src/database/migrations/1747000000000-organizers.ts` — raw SQL migration pattern
- `package.json` — installed dependency versions
- `/nestjs/docs.nestjs.com` (Context7) — @Query(), @UseGuards(), route ordering

### Secondary (MEDIUM confidence)
- `src/organizers/organizers.module.ts` — exports: [OrganizersService] confirmed

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified against package.json; all libraries already installed
- Architecture: HIGH — direct mirror of existing OrganizersModule patterns verified in codebase
- Cursor pagination: MEDIUM-HIGH — TypeORM QueryBuilder andWhere() verified; PostgreSQL row-value comparison syntax ASSUMED correct (A2)
- Migration: HIGH — raw SQL pattern verified against 1747000000000-organizers.ts; NULL cleanup strategy ASSUMED dev-only (A3)
- TDD patterns: HIGH — verified against organizers.service.spec.ts and organizers.controller.spec.ts

**Research date:** 2026-05-07
**Valid until:** 2026-06-07 (stable libraries — NestJS 11 + TypeORM 0.3.x)
