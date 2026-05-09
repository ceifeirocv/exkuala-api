# Phase 7: Public Event Discovery - Pattern Map

**Mapped:** 2026-05-09
**Files analyzed:** 11 (new/modified files)
**Analogs found:** 11 / 11

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `src/events/event-translation.entity.ts` | model | CRUD | `src/categories/category-translation.entity.ts` | exact |
| `src/events/dto/upsert-event-translation.dto.ts` | DTO | request-response | `src/events/dto/create-event.dto.ts` | role-match |
| `src/events/dto/public-event-list-item.dto.ts` | DTO | request-response | `src/events/dto/event-response.dto.ts` | exact |
| `src/events/dto/public-event-detail.dto.ts` | DTO | request-response | `src/events/dto/event-response.dto.ts` | exact |
| `src/events/dto/public-events-query.dto.ts` | DTO | request-response | `src/events/dto/event-pagination-query.dto.ts` | exact |
| `src/events/public-events.controller.ts` | controller | request-response | `src/organizers/organizers.controller.ts` | role-match |
| `src/events/events.service.ts` (EXTEND) | service | CRUD + request-response | `src/events/events.service.ts` | self |
| `src/events/events.controller.ts` (EXTEND) | controller | request-response | `src/events/events.controller.ts` | self |
| `src/events/event.entity.ts` (EXTEND) | model | CRUD | `src/events/event.entity.ts` | self |
| `src/events/events.module.ts` (EXTEND) | config | — | `src/events/events.module.ts` | self |
| TypeORM migration (NEW) | migration | batch | `src/database/migrations/1748000000000-events-fk.ts` | role-match |

---

## Pattern Assignments

### `src/events/event-translation.entity.ts` (model, CRUD)

**Analog:** `src/categories/category-translation.entity.ts`

**Key difference from analog:** `event_translations` uses a composite PK `(eventId, locale)` — no surrogate `id` column, no `@BeforeInsert` / `createId()`. D-01 (CONTEXT.md) locks this: "composite PK (eventId, locale) — natural upsert key, no surrogate ID needed."

**Imports pattern** (`src/categories/category-translation.entity.ts` lines 1–9):
```typescript
import {
  Column,
  Entity,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { EventEntity } from './event.entity';
```

**Entity declaration + composite PK pattern** (mirror of `src/categories/category-translation.entity.ts` lines 13–28, adapted):
```typescript
// Composite PK (eventId, locale) — no surrogate id per D-01 (07-CONTEXT.md).
// One translation per locale per event; upsert semantics on PUT endpoint (D-03).
@Entity('event_translations')
export class EventTranslationEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  eventId: string;

  // Open string — no enum, no DB check constraint (D-02)
  @PrimaryColumn({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 5000, nullable: true })
  description: string | null;

  // onDelete: CASCADE — translations removed when parent event is deleted
  @ManyToOne(() => EventEntity, (e) => e.translations, { onDelete: 'CASCADE' })
  event: EventEntity;
}
```

---

### `src/events/event.entity.ts` (EXTEND — add columns + relation)

**Analog:** `src/categories/category.entity.ts` (for `@OneToMany` pattern) + self (existing file)

**Existing file:** `src/events/event.entity.ts`

**New columns to add** (mirror `src/events/event.entity.ts` lines 60–61 length pattern, per SEC-01):
```typescript
// Phase 7 additions — deferred from Phase 6 (06-CONTEXT.md)
@Column({ type: 'varchar', length: 2048, nullable: true })
imageUrl: string | null;

@Column({ type: 'varchar', length: 100, nullable: true })
city: string | null;

// tsvector column — kept in sync by DB trigger (D-04), never written by app layer.
// 'simple' config: no stemming, works for multilingual content (D-05).
@Column({ type: 'tsvector', nullable: true, select: false })
searchVector: unknown;
```

**OneToMany relation pattern** (mirror `src/categories/category.entity.ts` lines 32–34):
```typescript
// eager: false — join translations explicitly when needed; avoid N+1
@OneToMany(() => EventTranslationEntity, (t) => t.event, { eager: false })
translations: EventTranslationEntity[];
```

**New imports to add to existing import block** (`src/events/event.entity.ts` lines 1–12):
```typescript
// Add to existing typeorm imports:
OneToMany,
// Add new entity import:
import { EventTranslationEntity } from './event-translation.entity';
```

---

### `src/events/dto/upsert-event-translation.dto.ts` (DTO, request-response)

**Analog:** `src/events/dto/create-event.dto.ts`

**Pattern** (`src/events/dto/create-event.dto.ts` lines 1–11, 21–25, 38–43):
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, IsOptional } from 'class-validator';

/**
 * Request body for PUT /organizer/events/:id/translations/:locale.
 * Upserts a translation for one locale. Both fields accepted; title required.
 *
 * Example: { "title": "Noite de Jazz", "description": "Uma noite de clássicos." }
 */
export class UpsertEventTranslationDto {
  @ApiProperty({ example: 'Noite de Jazz', maxLength: 200 })
  @IsString()
  @MaxLength(200)
  title: string;

  @ApiPropertyOptional({ example: 'Uma noite de clássicos.', maxLength: 5000, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;
}
```

---

### `src/events/dto/public-event-list-item.dto.ts` (DTO, request-response)

**Analog:** `src/events/dto/event-response.dto.ts`

**Full ApiProperty pattern** (`src/events/dto/event-response.dto.ts` lines 1–52):
```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PublicEventListItemDto {
  @ApiProperty({ example: 'cuid2-event-id' })
  id: string;

  @ApiProperty({ example: 'Jazz Night at Casa da Música' })
  title: string;

  @ApiPropertyOptional({ nullable: true, example: 'A night of jazz classics.' })
  description: string | null;

  @ApiProperty({ example: '2026-09-15T20:00:00.000Z' })
  startAt: Date;

  @ApiPropertyOptional({ nullable: true, example: '2026-09-15T23:00:00.000Z' })
  endAt: Date | null;

  @ApiPropertyOptional({ nullable: true, example: 'Casa da Música' })
  venueName: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Av. da Boavista 604, Porto' })
  address: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Praia' })
  city: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://example.com/image.jpg' })
  imageUrl: string | null;

  @ApiProperty({ example: 'PUBLISHED' })
  status: string; // Always 'PUBLISHED' for public endpoints

  @ApiPropertyOptional({ nullable: true })
  category: { id: string; slug: string; name: string } | null;

  @ApiProperty()
  organizer: { id: string; name: string };

  // translations map: { pt: { title, description }, en: { title, description } }
  // Client resolves preferred locale (D-01)
  @ApiProperty({ example: { pt: { title: 'Noite de Jazz', description: null } } })
  translations: Record<string, { title: string; description: string | null }>;

  @ApiProperty({ example: '2026-01-01T00:00:00.000Z' })
  createdAt: Date;
}
```

---

### `src/events/dto/public-event-detail.dto.ts` (DTO, request-response)

**Analog:** `src/events/dto/event-response.dto.ts` (same ApiProperty pattern)

**Additional fields beyond list item** (D-11, D-12):
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PublicEventListItemDto } from './public-event-list-item.dto';

// Detail extends list — adds ticket info and full organizer/category shapes (D-11, D-12)
export class PublicEventDetailDto extends PublicEventListItemDto {
  @ApiPropertyOptional({ nullable: true, example: 15.0 })
  ticketPrice: number | null;

  @ApiPropertyOptional({ nullable: true, example: 'https://ticketline.sapo.pt/...' })
  externalTicketUrl: string | null;

  // Override organizer: full public profile (id, name, bio, contact) per D-11
  // Mirror: src/organizers/dto/organizer-public-response.dto.ts field set
  declare organizer: { id: string; name: string; bio: string | null; contact: string | null };

  // Override category: includes translations map per D-11
  declare category: {
    id: string;
    slug: string;
    name: string;
    translations: Record<string, string>;
  } | null;
}
```

---

### `src/events/dto/public-events-query.dto.ts` (DTO, request-response)

**Analog:** `src/events/dto/event-pagination-query.dto.ts`

**Full pattern** (`src/events/dto/event-pagination-query.dto.ts` lines 1–40):
```typescript
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Query parameters for public event listing.
 * All filters optional; combine freely.
 *
 * Example: GET /events?category=music&city=Praia&q=jazz&limit=20&cursor=eyJ...
 */
export class PublicEventsQueryDto {
  @ApiPropertyOptional({ example: 'music', description: 'Filter by category slug' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ example: '2026-09-01T00:00:00Z', description: 'Events starting on or after this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  start?: string;

  @ApiPropertyOptional({ example: '2026-09-30T23:59:59Z', description: 'Events starting on or before this date (ISO 8601)' })
  @IsOptional()
  @IsDateString()
  end?: string;

  @ApiPropertyOptional({ example: 'Praia', description: 'Case-insensitive prefix match on city (D-09)' })
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'jazz night', description: 'Full-text search term — plainto_tsquery simple config (D-07)' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'Opaque cursor from previous response nextCursor field' })
  @IsOptional()
  @IsString()
  cursor?: string;

  @ApiPropertyOptional({ default: 20, maximum: 100, description: 'Results per page. Max 100.' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number;
}
```

---

### `src/events/public-events.controller.ts` (controller, request-response)

**Analog:** `src/organizers/organizers.controller.ts` (for `@Public()` pattern) + `src/events/events.controller.ts` (for service delegation pattern)

**Imports pattern** (`src/organizers/organizers.controller.ts` lines 1–9 + `src/events/events.controller.ts` lines 1–11):
```typescript
import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { EventsService } from './events.service';
import { PublicEventListItemDto } from './dto/public-event-list-item.dto';
import { PublicEventDetailDto } from './dto/public-event-detail.dto';
import { PublicEventsQueryDto } from './dto/public-events-query.dto';
import { PaginatedPublicEventsResponseDto } from './dto/paginated-public-events-response.dto';
```

**Public route pattern** (`src/organizers/organizers.controller.ts` lines 42–51):
```typescript
// Registered at /api/v1/events — no auth required on any route in this controller
@ApiTags('Events')
@Public()
@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  @ApiOperation({ summary: 'List published events with cursor pagination' })
  @ApiResponse({ status: 200, type: PaginatedPublicEventsResponseDto })
  findPublished(@Query() query: PublicEventsQueryDto): Promise<PaginatedPublicEventsResponseDto> {
    return this.eventsService.findPublished(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get published event detail by ID' })
  @ApiResponse({ status: 200, type: PublicEventDetailDto })
  @ApiResponse({ status: 404, description: 'Event not found or not published.' })
  findPublishedById(@Param('id') id: string): Promise<PublicEventDetailDto> {
    return this.eventsService.findPublishedById(id);
  }
}
```

---

### `src/events/events.controller.ts` (EXTEND — add translation upsert)

**Analog:** self + `src/events/events.controller.ts` lines 54–78 for `@Patch` / `@Delete` pattern

**Translation upsert endpoint to add** (mirrors `@Patch(':id')` pattern, lines 54–65, adapted for `@Put(':id/translations/:locale')`):
```typescript
import { Put } from '@nestjs/common'; // add to existing import

@Put(':id/translations/:locale')
@ApiOperation({ summary: 'Upsert a translation for one locale' })
@ApiResponse({ status: 200, description: 'Updated translation object.' })
@ApiResponse({ status: 404, description: 'Event not found or not owned by this organizer.' })
upsertTranslation(
  @CurrentOrganizer() organizer: OrganizerEntity,
  @Param('id') id: string,
  @Param('locale') locale: string,
  @Body() dto: UpsertEventTranslationDto,
): Promise<{ locale: string; title: string; description: string | null }> {
  return this.eventsService.upsertTranslation(organizer.id, id, locale, dto);
}
```

---

### `src/events/events.service.ts` (EXTEND — add public query + translation upsert methods)

**Analog:** self (`src/events/events.service.ts`)

**Constructor extension** (add second `@InjectRepository`, mirror lines 37–40):
```typescript
constructor(
  @InjectRepository(EventEntity)
  private readonly eventRepository: Repository<EventEntity>,
  @InjectRepository(EventTranslationEntity)
  private readonly translationRepository: Repository<EventTranslationEntity>,
) {}
```

**Cursor pagination pattern to copy for `findPublished()`** (lines 58–88):
```typescript
// findPublished() — reuses (startAt, id) cursor key from findOwned() (D-13, D-17, D-18, D-19)
// Adds: status=PUBLISHED filter, joins organizer+category+translations, applies public filters
async findPublished(query: PublicEventsQueryDto): Promise<PaginatedPublicEventsResponseDto> {
  const effectiveLimit = Math.min(query.limit ?? 20, 100);
  const qb = this.eventRepository
    .createQueryBuilder('event')
    .where('event."status" = :status', { status: EventStatus.PUBLISHED })
    .leftJoinAndSelect('event.organizer', 'organizer')
    .leftJoinAndSelect('event.category', 'category')
    .leftJoinAndSelect('category.translations', 'categoryTranslation')
    .leftJoinAndSelect('event.translations', 'translation')
    .orderBy('event."startAt"', 'ASC')
    .addOrderBy('event."id"', 'ASC')
    .take(effectiveLimit + 1);

  // Filters — each block mirrors the query.status pattern (lines 67–77)
  if (query.category) {
    qb.andWhere('category."slug" = :slug', { slug: query.category });
  }
  if (query.start) {
    qb.andWhere('event."startAt" >= :start', { start: query.start });
  }
  if (query.end) {
    qb.andWhere('event."startAt" <= :end', { end: query.end });
  }
  if (query.city) {
    // D-09: case-insensitive LIKE prefix
    qb.andWhere('LOWER(event."city") LIKE LOWER(:city) || \'%\'', { city: query.city });
  }
  if (query.q) {
    // D-07: plainto_tsquery simple config — handles multi-word without tsquery syntax
    qb.andWhere('event."searchVector" @@ plainto_tsquery(\'simple\', :q)', { q: query.q });
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

  return { data: data.map((e) => this.toPublicListItemDto(e)), nextCursor, hasMore };
}
```

**DTO mapping pattern** (mirror `toResponseDto()` lines 138–155):
```typescript
// toPublicListItemDto() — manual mapping; excludes soft-delete, ticket, internal fields
toPublicListItemDto(event: EventEntity): PublicEventListItemDto {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startAt: event.startAt,
    endAt: event.endAt,
    venueName: event.venueName,
    address: event.address,
    city: event.city,
    imageUrl: event.imageUrl,
    status: event.status,
    category: event.category
      ? { id: event.category.id, slug: event.category.slug, name: event.category.name }
      : null,
    organizer: { id: event.organizer.id, name: event.organizer.name },
    translations: this.buildTranslationsMap(event.translations ?? []),
    createdAt: event.createdAt,
  };
}
```

**Translation upsert pattern** (new; uses TypeORM upsert semantics):
```typescript
// upsertTranslation() — 404 for non-owned events (D-03, 07-CONTEXT.md no-info-leakage pattern)
async upsertTranslation(
  organizerId: string,
  eventId: string,
  locale: string,
  dto: UpsertEventTranslationDto,
): Promise<{ locale: string; title: string; description: string | null }> {
  await this.findOwnedOrThrow(eventId, organizerId);
  await this.translationRepository.upsert(
    { eventId, locale, title: dto.title, description: dto.description ?? null },
    { conflictPaths: ['eventId', 'locale'], skipUpdateIfNoValuesChanged: true },
  );
  const saved = await this.translationRepository.findOneOrFail({
    where: { eventId, locale },
  });
  return { locale: saved.locale, title: saved.title, description: saved.description };
}
```

**Error handling pattern** (lines 159–165):
```typescript
// findPublishedById() — 404 for non-published or non-existent events
// Returns 404 (not 403) — no information leakage (mirrors findOwnedOrThrow pattern)
private async findPublishedOrThrow(eventId: string): Promise<EventEntity> {
  const event = await this.eventRepository.findOne({
    where: { id: eventId, status: EventStatus.PUBLISHED },
    relations: ['organizer', 'category', 'category.translations', 'translations'],
  });
  if (!event) {
    throw new NotFoundException(`Event with id '${eventId}' not found`);
  }
  return event;
}
```

---

### `src/events/events.module.ts` (EXTEND)

**Analog:** self (`src/events/events.module.ts` lines 1–14)

**Pattern — add entity to `TypeOrmModule.forFeature`:**
```typescript
// Add EventTranslationEntity alongside EventEntity
imports: [TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]), OrganizersModule],
```

Also add `PublicEventsController` to the `controllers` array.

---

### TypeORM Migration (NEW — Phase 7)

**Analog:** `src/database/migrations/1748000000000-events-fk.ts`

**File naming pattern:** `src/database/migrations/1749000000000-events-translations-fts.ts`

**Class and `name` field pattern** (lines 5–6):
```typescript
export class EventsTranslationsFts1749000000000 implements MigrationInterface {
  name = 'EventsTranslationsFts1749000000000';
```

**up() structure pattern** (lines 8–58 — sequential steps with inline comments):
```typescript
public async up(queryRunner: QueryRunner): Promise<void> {
  // Step 1: Add imageUrl and city columns to events table (D-08, D-10)
  await queryRunner.query(`
    ALTER TABLE "events"
    ADD COLUMN "imageUrl" varchar(2048),
    ADD COLUMN "city"     varchar(100),
    ADD COLUMN "search_vector" tsvector
  `);

  // Step 2: Create event_translations table with composite PK (D-01, D-02)
  await queryRunner.query(`
    CREATE TABLE "event_translations" (
      "eventId"     varchar(30)   NOT NULL,
      "locale"      varchar(10)   NOT NULL,
      "title"       varchar(200)  NOT NULL,
      "description" varchar(5000),
      CONSTRAINT "PK_event_translations" PRIMARY KEY ("eventId", "locale"),
      CONSTRAINT "FK_event_translations_event"
        FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
    )
  `);

  // Step 3: GIN index on searchVector for full-text search (D-07)
  await queryRunner.query(`
    CREATE INDEX "idx_events_search_vector"
    ON "events" USING GIN ("search_vector")
  `);

  // Step 4: Index on city for LIKE prefix filter (Claude's Discretion, 07-CONTEXT.md)
  await queryRunner.query(`
    CREATE INDEX "idx_events_city"
    ON "events" ("city")
  `);

  // Step 5: tsvector update function — 'simple' config, joins event_translations (D-04, D-05, D-06)
  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
    BEGIN
      NEW.search_vector :=
        to_tsvector('simple', COALESCE(NEW.title, '')) ||
        to_tsvector('simple', COALESCE(NEW.description, '')) ||
        (SELECT COALESCE(
          tsvector_agg(to_tsvector('simple',
            COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')
          )),
          to_tsvector('simple', '')
        )
        FROM event_translations t WHERE t."eventId" = NEW.id);
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  // Step 6: Trigger on events INSERT/UPDATE to keep search_vector fresh
  await queryRunner.query(`
    CREATE TRIGGER events_search_vector_trigger
    BEFORE INSERT OR UPDATE ON "events"
    FOR EACH ROW EXECUTE FUNCTION events_search_vector_update()
  `);

  // Step 7: Trigger on event_translations changes — UPDATE parent event's search_vector
  // Separate function needed: translations trigger uses OLD/NEW.eventId to target parent row
  await queryRunner.query(`
    CREATE OR REPLACE FUNCTION event_translations_search_vector_update() RETURNS trigger AS $$
    DECLARE target_id varchar;
    BEGIN
      target_id := COALESCE(NEW."eventId", OLD."eventId");
      UPDATE "events" SET "search_vector" = (
        SELECT
          to_tsvector('simple', COALESCE(e.title, '')) ||
          to_tsvector('simple', COALESCE(e.description, '')) ||
          COALESCE(
            tsvector_agg(to_tsvector('simple',
              COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')
            )),
            to_tsvector('simple', '')
          )
        FROM "events" e
        LEFT JOIN event_translations t ON t."eventId" = e.id
        WHERE e.id = target_id
        GROUP BY e.id, e.title, e.description
      )
      WHERE id = target_id;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql
  `);

  await queryRunner.query(`
    CREATE TRIGGER event_translations_search_vector_trigger
    AFTER INSERT OR UPDATE OR DELETE ON "event_translations"
    FOR EACH ROW EXECUTE FUNCTION event_translations_search_vector_update()
  `);
}
```

**down() reverse pattern** (lines 61–79):
```typescript
public async down(queryRunner: QueryRunner): Promise<void> {
  // Reverse in opposite order of up()
  await queryRunner.query(`DROP TRIGGER IF EXISTS event_translations_search_vector_trigger ON "event_translations"`);
  await queryRunner.query(`DROP FUNCTION IF EXISTS event_translations_search_vector_update`);
  await queryRunner.query(`DROP TRIGGER IF EXISTS events_search_vector_trigger ON "events"`);
  await queryRunner.query(`DROP FUNCTION IF EXISTS events_search_vector_update`);
  await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_city"`);
  await queryRunner.query(`DROP INDEX IF EXISTS "idx_events_search_vector"`);
  await queryRunner.query(`DROP TABLE IF EXISTS "event_translations"`);
  await queryRunner.query(`
    ALTER TABLE "events"
    DROP COLUMN IF EXISTS "search_vector",
    DROP COLUMN IF EXISTS "city",
    DROP COLUMN IF EXISTS "imageUrl"
  `);
}
```

---

## Shared Patterns

### `@Public()` Decorator
**Source:** `src/auth/decorators/public.decorator.ts` (lines 1–5)
**Apply to:** `PublicEventsController` class-level — all routes in that controller are unauthenticated
```typescript
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

### `@CurrentOrganizer()` Guard Pattern
**Source:** `src/events/events.controller.ts` (lines 3–4, 16, 25–31)
**Apply to:** Translation upsert endpoint on `EventsController`
```typescript
@UseGuards(OrganizerGuard)
// method param:
@CurrentOrganizer() organizer: OrganizerEntity,
```

### 404 No-Info-Leakage Pattern
**Source:** `src/events/events.service.ts` lines 157–165
**Apply to:** `findPublishedById()`, `upsertTranslation()` — return 404 not 403 when access denied
```typescript
// findOwnedOrThrow() — compound WHERE (id, organizerId) per D-21, T-06-04-02.
// Returns 404 (not 403) — caller cannot distinguish owned vs. non-existent.
private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
  const event = await this.eventRepository.findOne({ where: { id: eventId, organizerId } });
  if (!event) {
    throw new NotFoundException(`Event with id '${eventId}' not found`);
  }
  return event;
}
```

### Cursor Encoding/Decoding
**Source:** `src/events/events.service.ts` lines 209–218
**Apply to:** `findPublished()` — reuses same static methods, no changes needed
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

### Translations Map Builder
**Source:** `src/categories/dto/category-response.dto.ts` line 8 (interface shape) + `CategoryEntity.translations` (load pattern)
**Apply to:** `toPublicListItemDto()` and `toPublicDetailDto()` in `EventsService`
```typescript
// Build: { pt: { title, description }, en: { title, description } }
// Mirror of category translations map (D-01: client-side locale resolution)
private buildTranslationsMap(
  translations: EventTranslationEntity[],
): Record<string, { title: string; description: string | null }> {
  return Object.fromEntries(
    translations.map((t) => [t.locale, { title: t.title, description: t.description }]),
  );
}
```

### ApiProperty Mandatory on All DTO Fields
**Source:** `src/events/dto/event-response.dto.ts` lines 11–51
**Apply to:** All new DTOs (`PublicEventListItemDto`, `PublicEventDetailDto`, `UpsertEventTranslationDto`, `PublicEventsQueryDto`)
Use `@ApiProperty()` for required fields, `@ApiPropertyOptional({ nullable: true })` for optional/null fields.

### Migration Step-by-Step Comment Style
**Source:** `src/database/migrations/1748000000000-events-fk.ts` lines 9–58
**Apply to:** New Phase 7 migration — each `queryRunner.query()` call preceded by a `// Step N:` comment explaining what it does and why.

---

## No Analog Found

All files have close analogs in the codebase. No files require falling back to RESEARCH.md patterns exclusively.

| File | Note |
|------|------|
| `src/events/dto/paginated-public-events-response.dto.ts` | Not listed above — planner should create as a thin wrapper mirroring `src/events/dto/paginated-events-response.dto.ts` (lines 1–24), replacing `EventResponseDto[]` with `PublicEventListItemDto[]`. |

---

## Metadata

**Analog search scope:** `src/events/`, `src/categories/`, `src/organizers/`, `src/auth/`, `src/database/migrations/`
**Files scanned:** 16
**Pattern extraction date:** 2026-05-09
