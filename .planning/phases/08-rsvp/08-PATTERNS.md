# Phase 8: RSVP - Pattern Map

**Mapped:** 2026-05-21
**Files analyzed:** 10 new/modified files
**Analogs found:** 10 / 10

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `src/rsvp/rsvp.entity.ts` | model | CRUD | `src/organizers/organizer.entity.ts` | exact |
| `src/rsvp/rsvp.service.ts` | service | CRUD | `src/events/events.service.ts` | exact |
| `src/rsvp/rsvp.module.ts` | config | request-response | `src/organizers/organizers.module.ts` | exact |
| `src/rsvp/dto/create-rsvp.dto.ts` | utility | request-response | `src/events/dto/event-pagination-query.dto.ts` | role-match |
| `src/rsvp/dto/rsvp-history-item.dto.ts` | utility | request-response | `src/events/dto/public-event-list-item.dto.ts` | role-match |
| `src/rsvp/dto/paginated-rsvp-history.dto.ts` | utility | request-response | `src/events/dto/paginated-events-response.dto.ts` | exact |
| `src/events/events.controller.ts` | controller | request-response | `src/organizers/organizers.controller.ts` | exact |
| `src/events/public-events.service.ts` | service | request-response | `src/events/events.service.ts` (findPublishedById) | exact |
| `src/me/me.controller.ts` | controller | request-response | `src/organizers/organizers.controller.ts` | exact |
| `src/me/me.module.ts` | config | request-response | `src/organizers/organizers.module.ts` | exact |
| Migration `1750000000000-rsvps.ts` | migration | CRUD | `src/database/migrations/1747000000000-organizers.ts` | exact |
| `src/app.module.ts` (modified) | config | — | `src/app.module.ts` itself | self |

---

## Pattern Assignments

### `src/rsvp/rsvp.entity.ts` (model, CRUD)

**Analog:** `src/organizers/organizer.entity.ts`

**Imports pattern** (organizer.entity.ts lines 1-10):
```typescript
import { createId } from '@paralleldrive/cuid2';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
```

**cuid2 PK pattern** (organizer.entity.ts lines 18-22 + 69-74):
```typescript
@Entity('organizers')
export class OrganizerEntity {
  @ApiProperty()
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

**FK column pattern** (organizer.entity.ts lines 24-27):
```typescript
// 1:1 FK to users.id — unique constraint enforces one organizer profile per user (D-08)
@ApiProperty()
@Column({ type: 'varchar', length: 30, unique: true })
userId: string;
```

**Enum column pattern** (organizer.entity.ts lines 51-59):
```typescript
// enumName prevents TypeORM auto-generated name collision (RESEARCH.md Pitfall 1)
@ApiProperty({ enum: OrganizerStatus })
@Column({
  type: 'enum',
  enum: OrganizerStatus,
  enumName: 'organizer_status',
  default: OrganizerStatus.PENDING,
})
status: OrganizerStatus;
```

**For RsvpEntity, apply:**
- `id: varchar(30)` cuid2 PK with `@BeforeInsert generateId()`
- `userId: varchar(30)` FK (no `unique: true` — uniqueness is on `(userId, eventId)` composite, not userId alone)
- `eventId: varchar(30)` FK
- `state` enum with `enumName: 'rsvp_state'`
- `rsvpedAt: Date` — use `@CreateDateColumn()` so it is set on insert and NOT updated on state change (D-08 of 08-CONTEXT.md)
- `@CreateDateColumn() createdAt` and `@UpdateDateColumn() updatedAt`
- No `@ManyToOne` relation properties needed — service works with scalar FKs only (mirrors Phase 6 EventEntity pattern)

---

### `src/rsvp/rsvp.service.ts` (service, CRUD)

**Analog:** `src/events/events.service.ts`

**Service shell pattern** (events.service.ts lines 39-48):
```typescript
@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    @InjectRepository(EventEntity)
    private readonly eventRepository: Repository<EventEntity>,
    @InjectRepository(EventTranslationEntity)
    private readonly translationRepository: Repository<EventTranslationEntity>,
  ) {}
```

**upsert pattern** (events.service.ts lines 218-226 — `upsertTranslation`):
```typescript
await this.translationRepository.upsert(
  { eventId, locale, title: dto.title, description: dto.description ?? null },
  { conflictPaths: ['eventId', 'locale'], skipUpdateIfNoValuesChanged: true },
);
const saved = await this.translationRepository.findOneOrFail({
  where: { eventId, locale },
});
```
For RsvpService upsert: use `conflictPaths: ['userId', 'eventId']`, update `state` field, preserve `rsvpedAt`.

**NotFoundException 404 pattern** (events.service.ts lines 327-333):
```typescript
private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
  const event = await this.eventRepository.findOne({ where: { id: eventId, organizerId } });
  if (!event) {
    throw new NotFoundException(`Event with id '${eventId}' not found`);
  }
  return event;
}
```

**cursor pagination pattern** (events.service.ts lines 66-96):
```typescript
async findOwned(organizerId: string, query: EventPaginationQueryDto): Promise<PaginatedEventsResponseDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.eventRepository
    .createQueryBuilder('event')
    .where('event."organizerId" = :organizerId', { organizerId })
    .orderBy('event.startAt', 'ASC')
    .addOrderBy('event.id', 'ASC')
    .take(effectiveLimit + 1);

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

  return { data: data.map((e) => this.toResponseDto(e)), nextCursor, hasMore };
}
```
For `listUserRsvps()`: sort `(rsvpedAt DESC, rsvpId ASC)`, filter `WHERE state != 'CANCELLED'`, join event relation for slim shape. Cursor encodes `rsvpedAt + rsvpId` as base64url.

**encodeCursor/decodeCursor pattern** (events.service.ts lines 377-386):
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

**QueryFailedError 23505 → 409 pattern** (organizers.service.ts lines 62-74):
```typescript
} catch (err) {
  if (
    err instanceof QueryFailedError &&
    (err as QueryFailedError & { code: string }).code === '23505'
  ) {
    throw new ConflictException(`An organizer application already exists for this user`);
  }
  this.logger.error({ event: 'organizer_apply_failed', userId, error: (err as Error).message });
  throw err;
}
```

**Manual DTO mapping pattern** (events.service.ts lines 229-246):
```typescript
toResponseDto(event: EventEntity): EventResponseDto {
  return {
    id: event.id,
    organizerId: event.organizerId,
    // ... explicit field mapping — no spread, no ClassSerializer
  };
}
```

---

### `src/rsvp/rsvp.module.ts` (config)

**Analog:** `src/organizers/organizers.module.ts`

**Module with export pattern** (organizers.module.ts lines 9-16):
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([OrganizerEntity, OrganizerAuditLogEntity])],
  providers: [OrganizersService],
  controllers: [OrganizersController, AdminOrganizersController],
  // Export OrganizersService so Phase 6 EventsModule can inject it for organizer ownership checks (D-09)
  exports: [OrganizersService],
})
export class OrganizersModule {}
```
For RsvpModule: `imports: [TypeOrmModule.forFeature([RsvpEntity])]`, `providers: [RsvpService]`, `exports: [RsvpService]`. No controllers — write routes live in EventsController, read history in MeController.

---

### `src/rsvp/dto/create-rsvp.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/event-pagination-query.dto.ts`

**DTO with enum validation pattern** (event-pagination-query.dto.ts lines 1-40):
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { EventStatus } from '../event.entity';

export class EventPaginationQueryDto {
  @ApiPropertyOptional({ enum: EventStatus })
  @IsOptional()
  @IsEnum(EventStatus)
  status?: EventStatus;
}
```
For CreateRsvpDto: body not query — use `@ApiProperty` (not `@ApiPropertyOptional`), `@IsEnum(RsvpState)`, `@IsNotEmpty()`. Field: `state: RsvpState` (INTERESTED | GOING only — CANCELLED is internal).

---

### `src/rsvp/dto/rsvp-history-item.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/public-event-list-item.dto.ts`

**DTO class with nested shape pattern** (public-event-list-item.dto.ts lines 1-52):
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicEventListItemDto {
  @ApiProperty({ example: 'cuid2-event-id' })
  id: string;

  @ApiPropertyOptional({ nullable: true, example: 'Praia' })
  city: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://example.com/image.jpg' })
  imageUrl: string | null;

  // Inline nested shape — no separate class for one-off nested objects
  @ApiProperty()
  organizer: { id: string; name: string };
}
```
For RsvpHistoryItemDto: inline `event: { id, title, startAt, city, imageUrl }` nested shape. Fields: `rsvpState: string`, `rsvpedAt: Date`, `event: { id, title, startAt, city, imageUrl }`.

---

### `src/rsvp/dto/paginated-rsvp-history.dto.ts` (utility, request-response)

**Analog:** `src/events/dto/paginated-events-response.dto.ts`

**Paginated envelope DTO pattern** (paginated-events-response.dto.ts lines 1-24):
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EventResponseDto } from './event-response.dto';

export class PaginatedEventsResponseDto {
  @ApiProperty({ type: [EventResponseDto] })
  data: EventResponseDto[];

  @ApiPropertyOptional({
    nullable: true,
    description: 'Opaque base64url cursor for next page. Null if no more results.',
    example: 'eyJpZCI6ImV2X2FiYyJ9',
  })
  nextCursor: string | null;

  @ApiProperty({ example: true })
  hasMore: boolean;
}
```

---

### `src/events/events.controller.ts` (modified — add RSVP write routes)

**Analog:** `src/organizers/organizers.controller.ts` (mixed-auth routes pattern)

**Mixed public/authenticated routes pattern** (organizers.controller.ts lines 1-52):
```typescript
// Class-level: no @UseGuards — individual methods use @ApiBearerAuth() to signal auth requirement
@ApiTags('Organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({ summary: '...' })
  apply(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateOrganizerDto,
  ): Promise<OrganizerSelfResponseDto> {
    return this.organizersService.apply(user.id, dto);
  }

  @Public()
  @Get(':id')
  async findById(@Param('id') id: string): Promise<OrganizerPublicResponseDto> { ... }
}
```

**Current EventsController class-level guard** (events.controller.ts lines 15-18):
```typescript
@ApiTags('Organizer Events')
@ApiBearerAuth()
@UseGuards(OrganizerGuard)
@Controller('organizer/events')
export class EventsController {
```
Phase 8 adds `POST /events/:id/rsvp` and `DELETE /events/:id/rsvp` to a **new or existing controller at `@Controller('events')`**. Per D-01 of 08-CONTEXT.md, the write RSVP routes live in the events module. Since `PublicEventsController` already owns `@Controller('events')` but is `@Public()`, the RSVP routes need auth. Pattern: add a new `EventsRsvpController` at `@Controller('events')` with `@ApiBearerAuth()` and no class-level `@Public()`, or add methods directly to `PublicEventsController` with per-method auth (not recommended — class-level `@Public()` bypasses JWT globally).

**Recommended pattern:** create `src/events/events-rsvp.controller.ts` mirroring `organizers.controller.ts` shape: no class-level guard, `@ApiBearerAuth()` per method, `@CurrentUser()` for user extraction.

**DELETE 204 No Content pattern** (events.controller.ts lines 68-78):
```typescript
@Delete(':id')
@HttpCode(HttpStatus.NO_CONTENT)
@ApiOperation({ summary: 'Soft-delete a draft event (sets deletedAt)' })
@ApiResponse({ status: 204, description: 'Event soft-deleted.' })
softDeleteDraft(
  @CurrentOrganizer() organizer: OrganizerEntity,
  @Param('id') id: string,
): Promise<void> {
  return this.eventsService.softDeleteDraft(organizer.id, id);
}
```

---

### `src/events/public-events.service.ts` (new service — extend findPublishedById with COUNT subqueries)

**Analog:** `src/events/events.service.ts` — `findPublishedById()` and `findPublishedOrThrow()` methods (lines 204-259)

The spec file `src/events/public-events.service.spec.ts` currently imports from `EventsService` (the public methods live there in Phase 7). Phase 8 does NOT split this into a separate file — the context says "extend `findPublishedById()` with COUNT subqueries". The file referred to in the phase prompt is the same `events.service.ts` method.

**Current findPublishedById** (events.service.ts lines 204-207):
```typescript
async findPublishedById(id: string): Promise<PublicEventDetailDto> {
  const event = await this.findPublishedOrThrow(id);
  return this.toPublicDetailDto(event);
}
```

**COUNT subquery pattern to add** (from 08-CONTEXT.md specifics):
```typescript
.addSelect(qb =>
  qb.select('COUNT(*)', 'count')
    .from(RsvpEntity, 'r')
    .where('r.eventId = event.id AND r.state = :interested', { interested: RsvpState.INTERESTED }),
  'interestedCount'
)
```
This requires converting `findPublishedOrThrow` to use `createQueryBuilder` with `.getRawAndEntities()` or addSelect subquery, then mapping `interestedCount` and `goingCount` into `PublicEventDetailDto`.

---

### `src/me/me.controller.ts` (controller, request-response)

**Analog:** `src/organizers/organizers.controller.ts`

**Authenticated controller pattern** (organizers.controller.ts lines 11-40):
```typescript
// Registered at /api/v1/organizers via global prefix + URI versioning
@ApiTags('Organizers')
@Controller('organizers')
export class OrganizersController {
  constructor(private readonly organizersService: OrganizersService) {}

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get the authenticated user's own organizer application" })
  @ApiResponse({ status: 200, type: OrganizerSelfResponseDto })
  findMe(@CurrentUser() user: AuthenticatedUser): Promise<OrganizerSelfResponseDto> {
    return this.organizersService.findSelfWithLatestNote(user.id);
  }
}
```
For MeController:
- `@Controller('me')` — registers at `/api/v1/me`
- No class-level `@Public()` — JWT guard applies globally
- `@ApiBearerAuth()` on each method
- `@CurrentUser() user: AuthenticatedUser` extracts userId from JWT
- Inject `RsvpService` via constructor
- `@Query()` for cursor pagination params (mirror `EventPaginationQueryDto` shape)

**AuthenticatedUser type import** (organizers.controller.ts line 5):
```typescript
import type { AuthenticatedUser } from '../types/auth';
```

---

### `src/me/me.module.ts` (config)

**Analog:** `src/events/events.module.ts`

**Module importing external module pattern** (events.module.ts lines 1-16):
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventEntity } from './event.entity';
import { EventTranslationEntity } from './event-translation.entity';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { PublicEventsController } from './public-events.controller';
import { OrganizersModule } from '../organizers/organizers.module';

@Module({
  // EventTranslationEntity added so EventsService can inject translationRepository (07-04)
  imports: [TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]), OrganizersModule],
  providers: [EventsService],
  controllers: [EventsController, PublicEventsController],
})
export class EventsModule {}
```
For MeModule: `imports: [RsvpModule]` (no `TypeOrmModule.forFeature` — MeModule owns no entities; RsvpService is consumed via import). `providers: []`, `controllers: [MeController]`.

---

### Migration `src/database/migrations/1750000000000-rsvps.ts`

**Analog:** `src/database/migrations/1747000000000-organizers.ts` (table + enum + FK + constraint pattern)

**Migration class shell pattern** (organizers migration lines 1-10):
```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class Organizers1747000000000 implements MigrationInterface {
  name = 'Organizers1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Step 1: Create enum types before tables that reference them
    await queryRunner.query(`CREATE TYPE "organizer_status" AS ENUM ('pending', 'approved', 'rejected')`);
```

**Table with FK, enum, unique constraint pattern** (organizers migration lines 21-38):
```typescript
await queryRunner.query(`
  CREATE TABLE "organizers" (
    "id"          varchar(30)            NOT NULL,
    "userId"      varchar(30)            NOT NULL,
    ...
    "status"      "organizer_status"     NOT NULL DEFAULT 'pending',
    "createdAt"   TIMESTAMPTZ            NOT NULL DEFAULT now(),
    "updatedAt"   TIMESTAMPTZ            NOT NULL DEFAULT now(),
    CONSTRAINT "PK_organizers" PRIMARY KEY ("id"),
    CONSTRAINT "UQ_organizers_userId" UNIQUE ("userId"),
    CONSTRAINT "FK_organizers_userId"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
  )
`);
```

**down() reverse pattern** (events-translations-fts migration lines 118-133):
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Reverse in opposite order of up() steps
  await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_city"`);
  await queryRunner.query(`DROP TABLE IF EXISTS "event_translations"`);
  await queryRunner.query(`ALTER TABLE "events" DROP COLUMN IF EXISTS "search_vector" ...`);
}
```

For rsvps migration:
1. `CREATE TYPE "rsvp_state" AS ENUM ('INTERESTED', 'GOING', 'CANCELLED')`
2. `CREATE TABLE "rsvps"` with:
   - `id varchar(30) PK`
   - `userId varchar(30) NOT NULL FK→users.id ON DELETE CASCADE`
   - `eventId varchar(30) NOT NULL FK→events.id ON DELETE CASCADE`
   - `state rsvp_state NOT NULL`
   - `rsvpedAt TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `createdAt TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `updatedAt TIMESTAMPTZ NOT NULL DEFAULT now()`
   - `CONSTRAINT "UQ_rsvps_userId_eventId" UNIQUE ("userId", "eventId")`
3. `CREATE INDEX "idx_rsvps_eventId" ON "rsvps" ("eventId")` — for COUNT subquery performance (D-64)

---

### `src/app.module.ts` (modified)

**Pattern:** Mirror existing entity registration (app.module.ts lines 30-31):
```typescript
entities: [UserEntity, EventEntity, CategoryEntity, CategoryTranslationEntity,
           OrganizerEntity, OrganizerAuditLogEntity, EventTranslationEntity],
```
Add `RsvpEntity` to the `entities` array. Add `MeModule` and `RsvpModule` to the `imports` array (lines 41-45):
```typescript
OrganizersModule, // registers /api/v1/organizers and /api/v1/admin/organizers endpoints
EventsModule,     // registers /api/v1/organizer/events endpoints
// Phase 8 adds:
RsvpModule,       // owns RsvpEntity + RsvpService
MeModule,         // registers /api/v1/me/rsvps endpoint
```

---

## Shared Patterns

### Authentication — @CurrentUser()
**Source:** `src/auth/decorators/current-user.decorator.ts` lines 1-11
**Apply to:** `events-rsvp.controller.ts` (POST/DELETE), `me.controller.ts` (GET)
```typescript
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { AuthenticatedUser } from '../../types/auth';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
```
No `@UseGuards` needed on RSVP routes — `JwtAuthGuard` is globally registered. No `@Public()` on RSVP routes — auth applies by default.

### NotFoundException 404 Pattern (no-info-leakage)
**Source:** `src/events/events.service.ts` lines 327-333
**Apply to:** `rsvp.service.ts` (event existence check before upsert), cancel RSVP lookup
```typescript
if (!event) {
  throw new NotFoundException(`Event with id '${eventId}' not found`);
}
```

### Logger structured pattern
**Source:** `src/events/events.service.ts` line 41, `src/organizers/organizers.service.ts` line 18
**Apply to:** `rsvp.service.ts`
```typescript
private readonly logger = new Logger(RsvpService.name);
// Error logging:
this.logger.error({ event: 'rsvp_upsert_failed', userId, error: (err as Error).message });
```

### @ApiProperty mandatory on all DTO fields
**Source:** `src/events/dto/event-response.dto.ts` (all fields decorated)
**Apply to:** All new DTO classes (`CreateRsvpDto`, `RsvpHistoryItemDto`, `PaginatedRsvpHistoryDto`)
- `@ApiProperty()` for required fields
- `@ApiPropertyOptional({ nullable: true })` for optional/nullable fields

### Cursor pagination envelope shape (D-13 canonical)
**Source:** `src/events/dto/paginated-events-response.dto.ts` lines 10-24
**Apply to:** `PaginatedRsvpHistoryDto`
Shape is always `{ data: T[], nextCursor: string | null, hasMore: boolean }`.

### QueryBuilder cursor WHERE pattern
**Source:** `src/events/events.service.ts` lines 79-85
**Apply to:** `rsvp.service.ts` listUserRsvps cursor filter
```typescript
qb.andWhere(
  '(event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)',
  { cursorStartAt, cursorId },
);
```
For RSVP history (DESC sort): use `<` not `>`, and flip to `(rsvp."rsvpedAt", rsvp."id") < (:cursorRsvpedAt::timestamptz, :cursorId)`.

### Module export for cross-module service injection
**Source:** `src/organizers/organizers.module.ts` line 14
**Apply to:** `rsvp.module.ts`
```typescript
exports: [OrganizersService],
```
RsvpModule must export RsvpService so EventsModule (write routes + COUNT) and MeModule (history) can inject it.

---

## No Analog Found

All files have close analogs. No files require falling back to RESEARCH.md patterns.

---

## Metadata

**Analog search scope:** `src/events/`, `src/organizers/`, `src/auth/decorators/`, `src/users/`, `src/database/migrations/`
**Files scanned:** 22
**Pattern extraction date:** 2026-05-21
