# Phase 8 Research: RSVP

**Researched:** 2026-05-21
**Domain:** NestJS / TypeORM — authenticated RSVP feature with upsert, aggregated counts, and cursor-paginated history
**Confidence:** HIGH — all findings drawn from codebase inspection of implemented prior phases

---

## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Write endpoints (`POST /events/:id/rsvp`, `DELETE /events/:id/rsvp`) live in EventsModule; read history (`GET /me/rsvps`) lives in new MeModule/MeController.
- **D-02:** `RsvpService` exported from `RsvpModule`, imported by `EventsModule` and `MeModule`.
- **D-03:** Cancel = logical state transition (`state = CANCELLED`), not a physical delete.
- **D-04:** Single `state` enum: `INTERESTED`, `GOING`, `CANCELLED`. No separate status/deletedAt.
- **D-05:** `GET /me/rsvps` filters `WHERE state != 'CANCELLED'`.
- **D-06:** Re-RSVP after cancel: upsert back to INTERESTED or GOING via POST.
- **D-07:** Counts via live COUNT subqueries in `PublicEventsService.findPublishedById()`. No denormalized columns.
- **D-08:** `PublicEventDetailDto` gains `interestedCount: number` and `goingCount: number`.
- **D-09:** `GET /me/rsvps` slim shape: `{ rsvpState, rsvpedAt, event: { id, title, startAt, city, imageUrl } }`.
- **D-10:** Cursor pagination on `(rsvpedAt DESC, rsvpId)`. Envelope: `{ data, nextCursor, hasMore }`, default limit=20, max=100.
- **D-11:** `RsvpHistoryItemDto` and `PaginatedRsvpHistoryDto` are new DTOs.

### Claude's Discretion
- `RsvpEntity` PK: cuid2 via `@BeforeInsert` + `@PrimaryColumn`.
- Unique constraint on `(userId, eventId)` at DB level; `'23505'` → 409 if hit.
- Guard on POST: verify event is PUBLISHED; 404 if not found, 422 if not PUBLISHED.
- `rsvpedAt`: set on initial insert, NOT updated on state change.
- Whether `MeModule` or `UsersModule` hosts `MeController`.
- Whether POST returns full RSVP record or just `{ state, rsvpedAt }`.
- Index on `(eventId)` for COUNT subquery performance.

### Deferred Ideas (OUT OF SCOPE)
- Waitlist / PENDING state
- Push notifications on RSVP
- RSVP analytics / audit trail
- `GET /events/:id/rsvps` admin list
- Rate limiting per user

---

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| RSVP-01 | Authenticated user can RSVP to an event with state `interested` or `going`; second RSVP to same event updates, not duplicates, the state | TypeORM upsert via `createQueryBuilder().insert().orUpdate()` with `(userId, eventId)` unique constraint |
| RSVP-02 | Authenticated user can cancel their RSVP | `DELETE /events/:id/rsvp` sets `state = CANCELLED`; `@CurrentUser()` provides userId |
| RSVP-03 | Event detail includes aggregated RSVP counts | `addSelect` correlated COUNT subquery in `findPublishedById()` QueryBuilder |
| RSVP-04 | Authenticated user can retrieve list of events they RSVPed to | Cursor-paginated `GET /me/rsvps` with `(rsvpedAt DESC, rsvpId ASC)` composite cursor |

---

## TypeORM Upsert Pattern

**Two viable options — one is correct for this case.**

### Option A: `repository.upsert()` (TypeORM 0.3+) [VERIFIED: codebase — used in events.service.ts upsertTranslation()]

```typescript
// Seen in src/events/events.service.ts upsertTranslation():
await this.translationRepository.upsert(
  { eventId, locale, title: dto.title, description: dto.description ?? null },
  { conflictPaths: ['eventId', 'locale'], skipUpdateIfNoValuesChanged: true },
);
```

The same pattern applies directly to RsvpEntity:
```typescript
await this.rsvpRepository.upsert(
  { userId, eventId, state: dto.state },
  { conflictPaths: ['userId', 'eventId'], skipUpdateIfNoValuesChanged: false },
);
```

`skipUpdateIfNoValuesChanged: false` is required here because re-submitting the same state must still update `updatedAt` to reflect the re-confirmation. `rsvpedAt` must be set only on INSERT — which requires the `setOnInsert` or a more explicit approach.

**Problem with `repository.upsert()` for `rsvpedAt`:** TypeORM's `upsert()` does not natively support `INSERT ... ON CONFLICT ... DO UPDATE SET state = EXCLUDED.state` while leaving `rsvpedAt` untouched on update. The `upsert()` call would overwrite `rsvpedAt` on every call.

### Option B: `createQueryBuilder().insert().orUpdate()` (recommended) [VERIFIED: codebase — confirmed QueryBuilder is used throughout]

```typescript
await this.rsvpRepository
  .createQueryBuilder()
  .insert()
  .into(RsvpEntity)
  .values({ id: createId(), userId, eventId, state: dto.state, rsvpedAt: new Date() })
  .orUpdate(
    ['state', 'updatedAt'],          // columns to overwrite on conflict
    ['userId', 'eventId'],           // conflict target (unique constraint columns)
  )
  .setParameter('updatedAt', new Date())
  .execute();
```

This maps directly to `INSERT ... ON CONFLICT (userId, eventId) DO UPDATE SET state = EXCLUDED.state, updatedAt = NOW()` — `rsvpedAt` and `id` are NOT in the update list, so they are preserved on the existing row.

**Recommendation:** Use `createQueryBuilder().insert().orUpdate()`. It is the correct tool when different columns should be set on INSERT vs. UPDATE. The `repository.upsert()` shortcut cannot express this.

**Retrieval after upsert:** `createQueryBuilder().insert().execute()` does not return the full entity. Fetch the row explicitly after:

```typescript
return this.rsvpRepository.findOneOrFail({ where: { userId, eventId } });
```

**Cancel (D-03):** Use `repository.update({ userId, eventId }, { state: RsvpState.CANCELLED })`. No upsert needed — row already exists; guard throws 404 if not found. Response: 204 No Content.

---

## COUNT Subqueries in QueryBuilder

**Pattern verified from `src/events/events.service.ts` (context D-07) and `08-CONTEXT.md` specifics.**

The `findPublishedById()` method uses `findOne` with `relations`, not a QueryBuilder. To add COUNT subqueries it must be converted to a QueryBuilder. The canonical TypeORM correlated subquery `addSelect` pattern:

```typescript
// In PublicEventsService.findPublishedById() — convert to QueryBuilder:
async findPublishedById(id: string): Promise<PublicEventDetailDto> {
  const event = await this.eventRepository
    .createQueryBuilder('event')
    .where('event.id = :id', { id })
    .andWhere('event.status = :status', { status: EventStatus.PUBLISHED })
    .leftJoinAndSelect('event.organizer', 'organizer')
    .leftJoinAndSelect('event.category', 'category')
    .leftJoinAndSelect('category.translations', 'categoryTranslation')
    .leftJoinAndSelect('event.translations', 'translation')
    .addSelect(qb =>
      qb
        .select('CAST(COUNT(*) AS INTEGER)', 'count')
        .from(RsvpEntity, 'r')
        .where('r."eventId" = event.id')
        .andWhere('r."state" = :interested', { interested: RsvpState.INTERESTED }),
      'interestedCount',
    )
    .addSelect(qb =>
      qb
        .select('CAST(COUNT(*) AS INTEGER)', 'count')
        .from(RsvpEntity, 'r')
        .where('r."eventId" = event.id')
        .andWhere('r."state" = :going', { going: RsvpState.GOING }),
      'goingCount',
    )
    .getRawAndEntities();
  // raw[0].interestedCount and raw[0].goingCount available as strings from postgres
  // CAST AS INTEGER converts to number in raw result
```

**Key gotcha:** `addSelect` with a subquery alias puts the value in the `raw` side of `getRawAndEntities()`, not on the entity. Must use `getRawAndEntities()` instead of `getOne()`, then merge counts into the DTO mapping.

Alternative simpler approach (two separate COUNT queries):
```typescript
const interestedCount = await this.rsvpRepository.count({
  where: { eventId: id, state: RsvpState.INTERESTED },
});
const goingCount = await this.rsvpRepository.count({
  where: { eventId: id, state: RsvpState.GOING },
});
```

**Recommendation for Phase 8:** Use two explicit `rsvpRepository.count()` calls in `findPublishedById()`. Simpler, less risk of raw/entity merge bugs, and the performance difference is negligible (indexed single-table COUNT on eventId index). The correlated subquery approach is elegant but introduces `getRawAndEntities()` complexity. The service already returns early via `findPublishedOrThrow()` — both count queries can run in parallel via `Promise.all()`.

```typescript
const [event, interestedCount, goingCount] = await Promise.all([
  this.findPublishedOrThrow(id),
  this.rsvpRepository.count({ where: { eventId: id, state: RsvpState.INTERESTED } }),
  this.rsvpRepository.count({ where: { eventId: id, state: RsvpState.GOING } }),
]);
return this.toPublicDetailDto(event, interestedCount, goingCount);
```

This requires `RsvpRepository` to be injected into `EventsService` (or `PublicEventsService` — same file in current codebase). `RsvpModule` must export `TypeOrmModule.forFeature([RsvpEntity])` so `EventsModule` can inject it.

---

## NestJS Cross-Module RsvpService Export

**Pattern verified from `src/events/events.module.ts` and `src/app.module.ts`.**

The established pattern is `OrganizersModule` exporting itself for `EventsModule` to use `@CurrentOrganizer()`. For `RsvpService`, the pattern is:

```typescript
// src/rsvp/rsvp.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([RsvpEntity])],
  providers: [RsvpService],
  exports: [RsvpService, TypeOrmModule],  // Export TypeOrmModule so EventsModule can inject RsvpRepository
})
export class RsvpModule {}
```

**Why `exports: [TypeOrmModule]`:** `EventsService` needs to inject `Repository<RsvpEntity>` for the `count()` calls in `findPublishedById()`. Without exporting `TypeOrmModule`, the token `getRepositoryToken(RsvpEntity)` is unavailable in `EventsModule`. The alternative is to wrap the count logic in `RsvpService` and export only `RsvpService` — this is cleaner and preferred.

**Preferred approach — export only RsvpService:**

```typescript
// RsvpService exposes the count methods:
async countByEventAndState(eventId: string, state: RsvpState): Promise<number> {
  return this.rsvpRepository.count({ where: { eventId, state } });
}
```

Then `EventsModule` imports `RsvpModule` and injects `RsvpService`:
```typescript
// src/events/events.module.ts
imports: [
  TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]),
  OrganizersModule,
  RsvpModule,   // add
],
providers: [EventsService],
```

`EventsService` takes `RsvpService` as constructor parameter for the count calls.

**MeModule:** New module at `src/me/`. Imports `RsvpModule`. `MeController` injects `RsvpService`.

```typescript
// src/me/me.module.ts
@Module({
  imports: [RsvpModule],
  controllers: [MeController],
})
export class MeModule {}
```

**AppModule:** Add `RsvpEntity` to entities array AND add `MeModule` to imports. `RsvpModule` itself does not need to be in `AppModule.imports[]` — it is consumed transitively by `EventsModule` and `MeModule`.

**Verified pattern:** `OrganizersModule` is listed in `EventsModule.imports` (seen in events.module.ts line 8) but NOT repeated in `AppModule.imports` — consistent with NestJS module resolution. `AppModule` only needs to import top-level feature modules.

---

## Cursor Pagination Reuse from Phase 7

**Fully verified from `src/events/events.service.ts`.**

Phase 6/7 cursor encoding:
```typescript
// src/events/events.service.ts lines 377–386
private static encodeCursor(startAt: Date, id: string): string {
  return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
}
private static decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorStartAt, cursorId] = raw.split('__');
  return { cursorStartAt, cursorId };
}
```

The separator `__` and `base64url` encoding are the established convention. Phase 8 reuses the same encoding scheme with different field names:

```typescript
// RsvpService cursor — rename fields only
private static encodeCursor(rsvpedAt: Date, rsvpId: string): string {
  return Buffer.from(`${rsvpedAt.toISOString()}__${rsvpId}`).toString('base64url');
}
private static decodeCursor(cursor: string): { cursorRsvpedAt: string; cursorRsvpId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorRsvpedAt, cursorRsvpId] = raw.split('__');
  return { cursorRsvpedAt, cursorRsvpId };
}
```

**Sort direction difference:** Phase 7 sorts `startAt ASC` (upcoming events first). Phase 8 sorts `rsvpedAt DESC` (most-recently-RSVPed first) per D-10. The row-value comparison flips:

```typescript
// Phase 7 (ASC): (startAt, id) > (:cursor, :id)
// Phase 8 (DESC): (rsvpedAt, rsvpId) < (:cursor, :id) — note LESS THAN for DESC
qb.andWhere(
  '(rsvp."rsvpedAt", rsvp."id") < (:cursorRsvpedAt::timestamptz, :cursorRsvpId)',
  { cursorRsvpedAt, cursorRsvpId },
);
```

**Full query pattern:**
```typescript
async findRsvpHistory(userId: string, query: RsvpHistoryQueryDto): Promise<PaginatedRsvpHistoryDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.rsvpRepository
    .createQueryBuilder('rsvp')
    .leftJoinAndSelect('rsvp.event', 'event')
    .where('rsvp."userId" = :userId', { userId })
    .andWhere("rsvp.\"state\" != :cancelled", { cancelled: RsvpState.CANCELLED })
    .orderBy('rsvp."rsvpedAt"', 'DESC')
    .addOrderBy('rsvp.id', 'ASC')
    .take(effectiveLimit + 1);

  if (query.cursor) {
    const { cursorRsvpedAt, cursorRsvpId } = RsvpService.decodeCursor(query.cursor);
    qb.andWhere(
      '(rsvp."rsvpedAt", rsvp."id") < (:cursorRsvpedAt::timestamptz, :cursorRsvpId)',
      { cursorRsvpedAt, cursorRsvpId },
    );
  }

  const rows = await qb.getMany();
  const hasMore = rows.length > effectiveLimit;
  const data = hasMore ? rows.slice(0, effectiveLimit) : rows;
  const lastItem = data[data.length - 1];
  const nextCursor = hasMore && lastItem
    ? RsvpService.encodeCursor(lastItem.rsvpedAt, lastItem.id)
    : null;

  return { data: data.map(mapToRsvpHistoryItemDto), nextCursor, hasMore };
}
```

**Important:** The secondary sort for `(rsvpedAt DESC, id ASC)` row-value comparison in PostgreSQL must be `(rsvpedAt, id) < (cursorRsvpedAt, cursorId)` where `id ASC` is the tiebreaker. This is correct because row-value comparison `(a, b) < (x, y)` means `a < x OR (a = x AND b < y)` — which gives the next page descending by `rsvpedAt` and ascending by `id` within the same timestamp.

---

## TDD Wave Pattern for This Phase

**Verified from all prior phases (04, 05, 06, 07 all follow identical pattern).**

### Wave 0: RED stubs

Create spec files that import non-existent sources (intentionally fail to compile). Specs contain the full test suite but with placeholder assertions (`expect(true).toBe(true)`) where service logic is not yet implemented.

**Files created in Wave 0:**
1. `src/rsvp/rsvp.service.spec.ts` — imports `RsvpService`, `RsvpEntity` (does not exist yet)
2. `src/rsvp/rsvp.module.spec.ts` — optional (not always done)
3. `src/me/me.controller.spec.ts` — imports `MeController`, `RsvpService` (does not exist yet)
4. Extend `src/events/events.controller.spec.ts` — add tests for POST /events/:id/rsvp and DELETE /events/:id/rsvp
5. Extend `src/events/public-events.service.spec.ts` — add tests for `findPublishedById()` returning `interestedCount`/`goingCount`

**Service spec pattern** (TestingModule + getRepositoryToken):
```typescript
// src/rsvp/rsvp.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RsvpEntity } from './rsvp.entity';  // RED: doesn't exist yet
import { RsvpService } from './rsvp.service'; // RED: doesn't exist yet

const mockRsvpRepository = {
  findOne: jest.fn(),
  save: jest.fn(),
  create: jest.fn(),
  createQueryBuilder: jest.fn(),
  count: jest.fn(),
  update: jest.fn(),
};

describe('RsvpService', () => {
  let service: RsvpService;
  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RsvpService,
        { provide: getRepositoryToken(RsvpEntity), useValue: mockRsvpRepository },
      ],
    }).compile();
    service = module.get<RsvpService>(RsvpService);
  });
  // tests...
});
```

**Controller spec pattern** (direct instantiation, no TestingModule):
```typescript
// src/me/me.controller.spec.ts
import { MeController } from './me.controller'; // RED
import { RsvpService } from '../rsvp/rsvp.service'; // RED

const mockRsvpService = {
  upsertRsvp: jest.fn(),
  cancelRsvp: jest.fn(),
  findRsvpHistory: jest.fn(),
};

describe('MeController', () => {
  let controller: MeController;
  beforeEach(() => {
    jest.clearAllMocks();
    controller = new MeController(mockRsvpService as unknown as RsvpService);
  });
  // tests...
});
```

### Wave 1: Entity + DTOs + Migration (no service logic)

Creates `RsvpEntity`, all DTOs (`RsvpStateDto`, `RsvpResponseDto`, `RsvpHistoryItemDto`, `PaginatedRsvpHistoryDto`, `RsvpHistoryQueryDto`), and the database migration. Tests remain RED (service/controller not yet created).

### Wave 2: GREEN implementation

Creates `RsvpService`, `RsvpModule`, `MeController`, `MeModule`. Extends `EventsController` with POST/DELETE RSVP handlers. Extends `EventsService.findPublishedById()` with count calls. All Wave 0 specs turn GREEN.

### Wave 3: BLOCKING verification

Migration run + full test suite + human verification.

### Test coverage map

| Requirement | Spec file | Tests |
|-------------|-----------|-------|
| RSVP-01 | `rsvp.service.spec.ts`, `events.controller.spec.ts` | upsert creates; second call updates state; 404 for non-existent event; 422 for non-PUBLISHED event |
| RSVP-02 | `rsvp.service.spec.ts`, `events.controller.spec.ts` | cancel sets state=CANCELLED; 204 response; re-RSVP after cancel works |
| RSVP-03 | `public-events.service.spec.ts` | findPublishedById returns interestedCount and goingCount as numbers |
| RSVP-04 | `me.controller.spec.ts`, `rsvp.service.spec.ts` | returns non-cancelled RSVPs; cursor pagination returns correct envelope; cancelled RSVPs filtered |

---

## TypeORM Enum Column Strategy

**Verified from `src/organizers/organizer.entity.ts` and `src/events/event.entity.ts`.**

Both existing enum columns use **PostgreSQL native enum type** with `enumName` set explicitly:

```typescript
// organizer.entity.ts:
@Column({
  type: 'enum',
  enum: OrganizerStatus,
  enumName: 'organizer_status',   // prevents TypeORM auto-generated name collision
  default: OrganizerStatus.PENDING,
})
status: OrganizerStatus;

// event.entity.ts:
@Column({
  type: 'enum',
  enum: EventStatus,
  enumName: 'event_status',
  default: EventStatus.DRAFT,
})
status: EventStatus;
```

**The `enumName` comment in `organizer.entity.ts` line 51 explicitly states:** `// enumName prevents TypeORM auto-generated name collision (RESEARCH.md Pitfall 1)` — this was a known pitfall identified during Phase 5 research.

**Recommendation:** Follow the same pattern for `RsvpState`:

```typescript
export enum RsvpState {
  INTERESTED = 'INTERESTED',
  GOING = 'GOING',
  CANCELLED = 'CANCELLED',
}

// In RsvpEntity:
@Column({
  type: 'enum',
  enum: RsvpState,
  enumName: 'rsvp_state',   // REQUIRED — prevents TypeORM name collision
})
state: RsvpState;
```

**Native enum vs varchar comparison:**

| | Native enum (`type: 'enum'`) | Varchar enum |
|---|---|---|
| DB constraint | DB rejects invalid values | App-only enforcement |
| Adding values | Requires migration (`ALTER TYPE ... ADD VALUE`) | No migration |
| Pattern consistency | Matches all 3 prior enums | Breaks project convention |
| TypeORM sync risk | `enumName` required to avoid collisions | No collision risk |

**Decision:** Use native PostgreSQL enum with `enumName: 'rsvp_state'`. Consistent with project convention. Adding new enum values (v2 PENDING state) requires a migration but that is acceptable — it is a schema change by definition.

Migration must create the enum type BEFORE the table (same pattern as `1747000000000-organizers.ts`):
```sql
CREATE TYPE "rsvp_state" AS ENUM ('INTERESTED', 'GOING', 'CANCELLED');
```

---

## Migration Pattern

**Verified from `1747000000000-organizers.ts` and `1748000000000-events-fk.ts`.**

**Naming convention:** `{timestamp}-{kebab-description}.ts`, class name `{PascalCase}{timestamp}`, property `name = '{PascalCase}{timestamp}'`.

Next migration timestamp: `1750000000000` (follows 1749 series).

**Annotated migration structure for `rsvps` table:**

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the rsvps table for Phase 8 RSVP feature.
 * - rsvp_state enum: INTERESTED / GOING / CANCELLED (logical cancel, D-03)
 * - Unique constraint (userId, eventId) — upsert target (D-06)
 * - FK to users.id ON DELETE CASCADE — RSVP is user-owned data
 * - FK to events.id ON DELETE CASCADE — RSVP is invalid without the event
 * - rsvpedAt: set at insert, not updated on state change (D-61, Claude's discretion)
 * - Index on (eventId) for COUNT subquery performance (Claude's discretion)
 * - Index on (userId, state) for GET /me/rsvps filter performance (RSVP-04)
 */
export class Rsvps1750000000000 implements MigrationInterface {
  name = 'Rsvps1750000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "rsvp_state" AS ENUM ('INTERESTED', 'GOING', 'CANCELLED')
    `);
    await queryRunner.query(`
      CREATE TABLE "rsvps" (
        "id"        varchar(30)    NOT NULL,
        "userId"    varchar(30)    NOT NULL,
        "eventId"   varchar(30)    NOT NULL,
        "state"     "rsvp_state"   NOT NULL,
        "rsvpedAt"  TIMESTAMPTZ    NOT NULL DEFAULT now(),
        "createdAt" TIMESTAMPTZ    NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMPTZ    NOT NULL DEFAULT now(),
        CONSTRAINT "PK_rsvps" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_rsvps_user_event" UNIQUE ("userId", "eventId"),
        CONSTRAINT "FK_rsvps_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_rsvps_eventId"
          FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_event_id" ON "rsvps" ("eventId")
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_rsvps_user_state" ON "rsvps" ("userId", "state")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_user_state"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "idx_rsvps_event_id"`);
    await queryRunner.query(`DROP TABLE "rsvps"`);
    await queryRunner.query(`DROP TYPE "rsvp_state"`);
  }
}
```

**Cascade strategy:**
- `userId → users.id ON DELETE CASCADE` — if a user is deleted, their RSVPs are removed (user-owned data)
- `eventId → events.id ON DELETE CASCADE` — if an event is hard-deleted, RSVPs are removed (events use soft-delete, so this only fires on physical removes)

**Index rationale:**
- `idx_rsvps_event_id` — used by `COUNT(*) WHERE eventId = ? AND state = ?` (RSVP-03)
- `idx_rsvps_user_state` — used by `WHERE userId = ? AND state != CANCELLED` (RSVP-04)

---

## Key Risks / Gotchas

- **`rsvpedAt` overwrite on re-RSVP:** If using `repository.upsert()` instead of `createQueryBuilder().insert().orUpdate()`, `rsvpedAt` will be overwritten on every state update. The `orUpdate()` approach explicitly lists only `['state', 'updatedAt']` in the update column set, preserving `rsvpedAt` and `id` from the original INSERT. This is the deciding factor for upsert method choice.

- **`enumName` is mandatory:** Omitting `enumName` on `RsvpState` causes TypeORM to generate a name like `rsvps_state_enum` which can collide across runs or environments. The comment in `organizer.entity.ts` explicitly documents this as a prior pitfall. Must set `enumName: 'rsvp_state'`.

- **`PUBLIC` events guard on RSVP write:** `POST /events/:id/rsvp` must verify the event exists AND is `PUBLISHED` before upserting. A CANCELLED or DRAFT event should return 422 (unprocessable). Fetching the event first adds one round-trip but is required — the upsert itself has no event status awareness.

- **Cursor direction for DESC pagination:** Phase 7 uses `> (:cursor)` for ASC sort. Phase 8's `rsvpedAt DESC` cursor requires `< (:cursor)` for the row-value comparison. Copying Phase 7 cursor logic verbatim without flipping the comparison operator will return an empty next page.

- **`findPublishedById()` is currently a `findOne` + relations call, not a QueryBuilder:** Adding `RsvpService` as a dependency to `EventsService` (for `count()` calls) is simpler than converting to `getRawAndEntities()`. The method signature and return type (`PublicEventDetailDto`) remain unchanged; only the implementation body changes.

- **`PublicEventsService` vs `EventsService`:** The current codebase has `findPublishedById()` inside `EventsService` (not a separate `PublicEventsService` — the spec file `public-events.service.spec.ts` imports `EventsService`). Verify the actual source location before injecting `RsvpService`. The `EventsModule` providers array only lists `EventsService`.

---

## Sources

### Primary (HIGH confidence — verified via codebase inspection)
- `src/events/events.service.ts` — cursor encoding/decoding pattern, `findPublishedById()` implementation, `findPublished()` QueryBuilder shape, `upsertTranslation()` upsert pattern
- `src/organizers/organizer.entity.ts` — native enum + `enumName` pattern with explicit pitfall comment
- `src/events/event.entity.ts` — `enumName: 'event_status'` precedent
- `src/database/migrations/1747000000000-organizers.ts` — migration structure: enum type before table, named constraints, cascade FKs
- `src/database/migrations/1748000000000-events-fk.ts` — index creation pattern
- `src/events/events.module.ts` — cross-module import pattern (`OrganizersModule` imported by `EventsModule`)
- `src/app.module.ts` — entity registration, module import pattern
- `src/auth/decorators/current-user.decorator.ts` — `@CurrentUser()` shape for RSVP endpoints
- `.planning/phases/08-rsvp/08-CONTEXT.md` — all locked decisions, specifics including upsert SQL shape
- `.planning/phases/06-organizer-event-crud/06-CONTEXT.md` — cursor canonical shape (D-17, D-18)
- `.planning/phases/07-public-event-discovery/07-CONTEXT.md` — D-13 pagination reuse
