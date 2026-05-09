# Phase 7: Public Event Discovery - Research

**Researched:** 2026-05-09
**Domain:** NestJS public endpoints, PostgreSQL full-text search (tsvector/GIN), TypeORM composite PK entities, i18n translations map delivery
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**i18n — Translations Delivery**
- D-01: Client-side locale resolution. Events return a `translations` map: `{ pt: { title, description }, en: { title, description } }`. Consistent with Phase 4 D-12. I18N-03 Accept-Language server-side resolution is superseded.
- D-02: Locale values are open strings — no enum, no DB check constraint.
- D-03: `PUT /api/v1/organizer/events/:id/translations/:locale` — upsert semantics. Requires `@CurrentOrganizer()` + ownership check. Returns the updated translation object.

**Full-Text Search**
- D-04: tsvector column kept in sync via PostgreSQL DB trigger (not app-side).
- D-05: tsvector text search config: `simple`. No stemming, no stop words.
- D-06: tsvector content: default `events.title || ' ' || events.description` AND all `event_translations.(title || ' ' || description)` joined by trigger.
- D-07: GIN index on tsvector column. Query: `WHERE search_vector @@ plainto_tsquery('simple', :q)`.

**city + imageUrl Fields**
- D-08: `city` is a free-text `varchar(100)`, nullable, on EventEntity.
- D-09: City filter: `WHERE LOWER(city) LIKE LOWER(:city) || '%'`.
- D-10: `imageUrl` is `varchar(2048)`, nullable, on EventEntity. External URL only.

**Public Event Response Shape**
- D-11: Two DTOs — `PublicEventListItemDto` (list) and `PublicEventDetailDto` (detail, extends list). List includes: `id`, `title`, `description`, `startAt`, `endAt`, `venueName`, `address`, `city`, `imageUrl`, `status`, `category: { id, slug, name }`, `organizer: { id, name }`, `translations: { [locale]: { title, description } }`, `createdAt`. Detail adds: full organizer profile (`id, name, bio, contact`), category with translations map, `ticketPrice`, `externalTicketUrl`.
- D-12: Ticket info only on detail.
- D-13: Cursor pagination shape reuses Phase 6 canonical: `{ data, nextCursor, hasMore }`. Cursor key: `(startAt, id)`, base64url-encoded. Default limit=20, max=100. Sort: `startAt ASC`.

### Claude's Discretion

- `event_translations` table PK: composite `(eventId, locale)` — natural upsert key, no surrogate ID needed.
- Whether `PUT /organizer/events/:id/translations/:locale` also supports `DELETE`.
- `imageUrl` validation: `@IsUrl()` on DTO field.
- Exact tsvector trigger SQL.
- Index on `events.city` for filter performance.
- Index on `events.status` if not already present.
- Organizer endpoint ownership: return 404 (not 403) — consistent with Phase 5/6 no-info-leakage pattern.

### Deferred Ideas (OUT OF SCOPE)

- Server-side Accept-Language resolution (I18N-03) — superseded by client-side translations map.
- Geo-radius / proximity search (PostGIS) — v2.
- Managed city list + admin CRUD — v2.
- imageUrl upload/CDN pipeline — out of scope v1 entirely.
- `DELETE /organizer/events/:id/translations/:locale` — not in ROADMAP scope; planner decides.
- tsvector on translated content only (no default) — rejected.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EVT-04 | Published events are publicly accessible without authentication | `@Public()` decorator already built (Phase 2); decorate public controller; `WHERE status = 'PUBLISHED'` filter in service |
| EVT-06 | Event list endpoint returns paginated results (cursor-based) | Exact cursor pattern already implemented in `EventsService.findOwned()`; public listing reuses same `(startAt, id)` composite cursor key and `encodeCursor`/`decodeCursor` helpers |
| DISC-01 | Public event listing filterable by category | Category join + `WHERE c.slug = :category` filter in QueryBuilder |
| DISC-02 | Public event listing filterable by date range | `WHERE e."startAt" >= :start AND e."startAt" <= :end` filters |
| DISC-03 | Public event listing filterable by city | `WHERE LOWER(e."city") LIKE LOWER(:city) || '%'` per D-09 |
| DISC-04 | Full-text search on title and description via PostgreSQL tsvector | GIN-indexed `search_vector` tsvector column + DB trigger + `plainto_tsquery('simple', :q)` |
| I18N-01 | Event title and description support translations via `event_translations` table | New `EventTranslationEntity` with composite PK `(eventId, locale)`, `@OneToMany` on EventEntity, translations map in response DTOs |
| I18N-03 | API returns translated content — superseded | Decision D-01 replaces server-side resolution with client-side translations map; all available translations always returned |
</phase_requirements>

---

## Summary

Phase 7 builds the public read layer on top of the Phase 6 organizer event infrastructure. The EventsService and EventsController are already in place at `src/events/`; Phase 7 extends both with new methods and routes rather than creating a new module. Three technical domains need careful handling: (1) the PostgreSQL tsvector column and DB trigger, which must be written as raw SQL in a TypeORM migration since TypeORM has no native tsvector support; (2) the `EventTranslationEntity` with a composite `(eventId, locale)` primary key and upsert semantics via `repository.upsert({ conflictPaths: [...] })`; and (3) the public QueryBuilder query that joins organizer, category, and translations in a single call to avoid N+1.

Phase 6 is fully complete as of 2026-05-09. All 6 plans have SUMMARY files, 116/116 tests pass, migration is applied, and human verification passed. EventsController at `src/events/events.controller.ts` and EventsModule are in place. Phase 7 can begin immediately.

The most technically novel element is the tsvector DB trigger. The trigger on `events` can reference `NEW.id` directly; the trigger on `event_translations` must run an UPDATE on the parent `events` row after each translation change to keep `search_vector` in sync. Both triggers must be created in the same Phase 7 migration alongside the `event_translations` table and the new `imageUrl`/`city`/`search_vector` columns.

**Primary recommendation:** Write one migration for all schema changes (ALTER events + CREATE event_translations + CREATE TRIGGER + CREATE GIN INDEX). Add public routes to existing EventsController using `@Public()` at the method level. Add upsert method to EventsService for translations. Keep all service logic in EventsService; controller is thin delegation.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Public event listing + filtering | API / Backend | — | Data filtering is server-authoritative; clients must not receive unpublished events |
| Cursor pagination | API / Backend | — | Row-value keyset comparison belongs in service layer close to DB |
| Full-text search | Database / Storage | API / Backend | tsvector/GIN lives in PostgreSQL; API passes `plainto_tsquery` param via QueryBuilder |
| tsvector synchronization | Database / Storage | — | DB trigger handles it; no application-side sync needed |
| Translations map assembly | API / Backend | — | Service collects entity relations; maps to `{ [locale]: { title, description } }` |
| Translation upsert | API / Backend | Database / Storage | Service calls `repository.upsert`; DB enforces composite PK uniqueness |
| imageUrl / city storage | Database / Storage | API / Backend | New columns on events table; added via migration |
| `@Public()` bypass | API / Backend | — | JWT guard metadata; NestJS Reflector check in JwtAuthGuard |
| Ownership check on translation PUT | API / Backend | — | OrganizerGuard + EventsService.findOwnedOrThrow() pattern from Phase 6 |

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| typeorm | 0.3.29 | ORM, QueryBuilder, upsert | Already installed; project ORM [VERIFIED: package.json] |
| @nestjs/typeorm | 11.0.1 | NestJS TypeORM integration | Already installed [VERIFIED: package.json] |
| class-validator | 0.15.1 | DTO validation decorators | Already installed; `@IsUrl()`, `@IsDateString()`, `@IsInt()` [VERIFIED: package.json] |
| class-transformer | 0.5.1 | `@Type(() => Number)` for query params | Already installed [VERIFIED: package.json] |
| @nestjs/swagger | 11.3.0 | `@ApiProperty` on DTOs | Already installed; mandatory per Phase 5 lesson [VERIFIED: package.json] |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| PostgreSQL tsvector/GIN | (DB native) | Full-text search index | D-04 / D-07: trigger maintains index; GIN optimizes `@@` queries |
| Buffer.from / base64url | (Node.js native) | Cursor encoding/decoding | Already used in EventsService; no new dependency |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| DB trigger for tsvector | App-side update on save | Trigger never goes stale regardless of write path (migrations, seeds, admin); app-side requires touching every write path |
| `repository.upsert` | `repository.save` with find-first | upsert is atomic; find-then-save is a TOCTOU race and requires two DB round-trips |
| `plainto_tsquery` | `to_tsquery` | `plainto_tsquery` handles multi-word natural language input; `to_tsquery` requires callers to know tsquery syntax — wrong for a public search field |

**Installation:** No new packages required. All dependencies already present.

**Version verification:** `npm view typeorm version` → 0.3.29 [VERIFIED: npm registry]. `npm view @nestjs/typeorm version` → 11.0.1 [VERIFIED: npm registry].

---

## Architecture Patterns

### System Architecture Diagram

```
Public Client
    │
    ├── GET /api/v1/events?q=jazz&category=music&city=Praia&start=...
    │       │
    │   [JwtAuthGuard → IS_PUBLIC_KEY → skip]
    │       │
    │   EventsController.findPublished()
    │       │
    │   EventsService.findPublished(query)
    │       │
    │   QueryBuilder
    │     ├── JOIN organizers (for name)
    │     ├── JOIN categories (for id, slug, name)
    │     ├── LEFT JOIN event_translations (for translations map)
    │     ├── WHERE status = 'PUBLISHED'
    │     ├── WHERE (startAt, id) > cursor   [if cursor present]
    │     ├── WHERE search_vector @@ plainto_tsquery('simple', :q)   [if q present]
    │     ├── WHERE c.slug = :category   [if category present]
    │     ├── WHERE LOWER(city) LIKE LOWER(:city) || '%'   [if city present]
    │     ├── WHERE startAt >= :start   [if start present]
    │     ├── WHERE startAt <= :end   [if end present]
    │     └── ORDER BY startAt ASC, id ASC  LIMIT limit+1
    │       │
    │   map rows → PublicEventListItemDto[] + nextCursor
    │       │
    │   return PaginatedPublicEventsResponseDto
    │
    ├── GET /api/v1/events/:id
    │       │
    │   [JwtAuthGuard → IS_PUBLIC_KEY → skip]
    │       │
    │   EventsService.findPublishedById(id)
    │       │
    │   QueryBuilder (same joins + WHERE id = :id AND status = 'PUBLISHED')
    │       │
    │   map → PublicEventDetailDto
    │
    └── PUT /api/v1/organizer/events/:id/translations/:locale
            │
        [OrganizerGuard → @CurrentOrganizer()]
            │
        EventsService.upsertTranslation(organizerId, eventId, locale, dto)
            │
        findOwnedOrThrow(eventId, organizerId)   ← 404 if not owned
            │
        repository.upsert({ eventId, locale, title, description },
                          { conflictPaths: ['eventId', 'locale'] })
            │
        return EventTranslationResponseDto

PostgreSQL (events table)
    ├── events.search_vector tsvector  ← trigger updates on INSERT/UPDATE
    ├── GIN index on search_vector
    └── trigger on event_translations → UPDATE events SET search_vector = ...
```

### Recommended Project Structure

```
src/events/
├── event.entity.ts            # ADD: imageUrl, city, searchVector, @OneToMany translations
├── event-translation.entity.ts  # NEW: composite PK (eventId, locale), no surrogate
├── events.service.ts          # ADD: findPublished(), findPublishedById(), upsertTranslation()
├── events.controller.ts       # ADD: GET /events, GET /events/:id (both @Public())
│                              # ADD: PUT /organizer/events/:id/translations/:locale
├── events.module.ts           # ADD: EventTranslationEntity to TypeOrmModule.forFeature()
├── dto/
│   ├── create-event.dto.ts    # ADD: imageUrl, city fields
│   ├── update-event.dto.ts    # ADD: imageUrl, city fields
│   ├── event-response.dto.ts  # No change (organizer-facing; no translations)
│   ├── paginated-events-response.dto.ts   # No change
│   ├── event-pagination-query.dto.ts      # No change
│   ├── public-event-list-item.dto.ts      # NEW (D-11 list shape)
│   ├── public-event-detail.dto.ts         # NEW (D-11 detail shape, extends list)
│   ├── public-event-pagination-query.dto.ts  # NEW (adds category, start, end, city, q params)
│   ├── paginated-public-events-response.dto.ts  # NEW (data: PublicEventListItemDto[])
│   ├── upsert-event-translation.dto.ts    # NEW (title, description body for translation PUT)
│   └── event-translation-response.dto.ts # NEW (locale, title, description)
└── migrations/
    └── 1749000000000-events-public.ts  # NEW: alter events + event_translations + trigger + GIN
```

### Pattern 1: EventTranslationEntity — Composite PK, No Surrogate

**What:** Entity with `(eventId, locale)` as the natural composite PK. No CUID2 surrogate needed because the composite is the natural upsert key.
**When to use:** Translation tables where (parentId, locale) is always unique and serves as the lookup key.

```typescript
// Source: Codebase pattern (CategoryTranslationEntity) extended with composite PK variant
import { Column, Entity, ManyToOne, PrimaryColumn, JoinColumn } from 'typeorm';
import { EventEntity } from './event.entity';

@Entity('event_translations')
export class EventTranslationEntity {
  // Composite PK: (eventId, locale). No surrogate id — natural upsert key (Claude's Discretion).
  @PrimaryColumn({ type: 'varchar', length: 30 })
  eventId: string;

  // Open string per D-02 — no enum, no DB check constraint
  @PrimaryColumn({ type: 'varchar', length: 10 })
  locale: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'varchar', length: 5000, nullable: true })
  description: string | null;

  // onDelete: CASCADE — translations removed automatically when parent event is deleted
  @ManyToOne(() => EventEntity, (event) => event.translations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eventId' })
  event: EventEntity;
}
```

**Key difference from CategoryTranslationEntity:** No surrogate `id` column. TypeORM supports composite PKs via multiple `@PrimaryColumn` decorators. [VERIFIED: TypeORM docs, `repository-api.md` — `upsert` with `conflictPaths` works on composite keys]

### Pattern 2: Translation Upsert with composite conflictPaths

**What:** `repository.upsert()` with `conflictPaths` on composite PK columns. TypeORM generates `INSERT ... ON CONFLICT (eventId, locale) DO UPDATE SET ...`.
**When to use:** Any upsert where the conflict key is composite.

```typescript
// Source: Verified against /n8n-io/typeorm docs repository-api.md + codebase categories.seed.ts
await this.translationRepository.upsert(
  { eventId, locale, title: dto.title, description: dto.description ?? null },
  { conflictPaths: ['eventId', 'locale'] },
);
```

**Critical note:** `@BeforeInsert` does NOT fire on `repository.upsert()`. [VERIFIED: codebase comment in users.service.ts line 17: "TypeORM bypasses entity lifecycle hooks on the upsert code path"] Since EventTranslationEntity has no surrogate id, this is not a concern here (no id generation needed).

### Pattern 3: tsvector Column on EventEntity

**What:** TypeORM `@Column({ type: 'tsvector', select: false, nullable: true })` declares the column without TypeORM managing its content. The trigger owns all writes to this column. `select: false` prevents it appearing in `SELECT *` — callers only use it in `WHERE` clauses.

```typescript
// Source: [ASSUMED] - TypeORM does not document tsvector specifically; `type: 'tsvector'`
// is passed through as a raw PostgreSQL type. select: false is documented.
@Column({ type: 'tsvector', select: false, nullable: true })
searchVector: unknown; // typed as unknown — never read in app code; trigger owns it
```

**The column MUST be nullable** in TypeORM entity because TypeORM may attempt to set it to null during `save()` if not excluded. Adding `{ insert: false, update: false }` options alongside `select: false` prevents TypeORM from touching the column on any DML operation.

Full recommended declaration:
```typescript
@Column({
  type: 'tsvector',
  select: false,
  nullable: true,
  insert: false,
  update: false,
})
searchVector: unknown;
```

### Pattern 4: tsvector DB Trigger Migration

**What:** Two triggers created in the migration — one on `events`, one on `event_translations`.
**When to use:** Whenever a column's value is maintained by the DB engine rather than the application.

```sql
-- Source: [ASSUMED] based on PostgreSQL docs + 07-CONTEXT.md specifics section
-- Trigger function for events INSERT/UPDATE:
CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    to_tsvector('simple', COALESCE(NEW.title, '')) ||
    to_tsvector('simple', COALESCE(NEW.description, '')) ||
    COALESCE(
      (SELECT tsvector_agg(to_tsvector('simple',
          COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')))
       FROM event_translations t WHERE t."eventId" = NEW.id),
      to_tsvector('simple', '')
    );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER events_search_vector_trigger
BEFORE INSERT OR UPDATE ON events
FOR EACH ROW EXECUTE FUNCTION events_search_vector_update();

-- Trigger function for event_translations INSERT/UPDATE/DELETE:
-- Cannot set NEW.search_vector on parent; must UPDATE the parent row directly.
CREATE OR REPLACE FUNCTION event_translations_search_vector_update() RETURNS trigger AS $$
DECLARE
  affected_event_id varchar(30);
BEGIN
  affected_event_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."eventId" ELSE NEW."eventId" END;
  UPDATE events SET
    "search_vector" = (
      to_tsvector('simple', COALESCE(title, '')) ||
      to_tsvector('simple', COALESCE(description, '')) ||
      COALESCE(
        (SELECT tsvector_agg(to_tsvector('simple',
            COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')))
         FROM event_translations t WHERE t."eventId" = affected_event_id),
        to_tsvector('simple', '')
      )
    )
  WHERE id = affected_event_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_translations_search_vector_trigger
AFTER INSERT OR UPDATE OR DELETE ON event_translations
FOR EACH ROW EXECUTE FUNCTION event_translations_search_vector_update();
```

**Critical detail:** The `event_translations` trigger fires AFTER (not BEFORE) because it does a sibling UPDATE, not a `NEW.col =` assignment. BEFORE triggers cannot do arbitrary UPDATEs reliably on other tables in PostgreSQL without risk of recursion when they target the same table.

### Pattern 5: @Public() on Individual Methods (not class)

**What:** Apply `@Public()` at the method level when the same controller has both public and protected routes.
**When to use:** EventsController has class-level `@UseGuards(OrganizerGuard)` on organizer routes AND needs `@Public()` on `GET /events`, `GET /events/:id`.

Phase 7 adds new public routes to the same controller. Two options:

**Option A (recommended for Phase 7):** Create a second controller `PublicEventsController` at `@Controller('events')`, decorate with `@Public()` at class level. Keeps concerns separated and avoids guard conflict.

**Option B:** Add public methods to the existing `EventsController` with per-method `@Public()` + remove `@UseGuards(OrganizerGuard)` class decorator, move it per-method. More disruptive to existing code.

Option A is recommended. The translation endpoint (`PUT /organizer/events/:id/translations/:locale`) stays in `EventsController` (organizer-guarded). The planner may decide either way — document this as a discretion item.

```typescript
// Source: src/auth/decorators/public.decorator.ts (VERIFIED codebase)
// @Public() sets IS_PUBLIC_KEY metadata; JwtAuthGuard checks it via Reflector
@ApiTags('Public Events')
@Controller('events')
export class PublicEventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Public()
  @Get()
  findPublished(@Query() query: PublicEventPaginationQueryDto) {
    return this.eventsService.findPublished(query);
  }

  @Public()
  @Get(':id')
  findPublishedById(@Param('id') id: string) {
    return this.eventsService.findPublishedById(id);
  }
}
```

### Pattern 6: QueryBuilder with Left Joins for Translations Map

**What:** Build the translations map from joined `event_translations` rows rather than a separate N+1 query.

```typescript
// Source: [ASSUMED based on TypeORM QueryBuilder docs + codebase findOwned() pattern]
const qb = this.eventRepository
  .createQueryBuilder('event')
  .leftJoinAndSelect('event.organizer', 'organizer')
  .leftJoinAndSelect('event.category', 'category')
  .leftJoinAndSelect('event.translations', 'translations')
  .where('event."status" = :status', { status: EventStatus.PUBLISHED });

// After getMany(), build translations map in service:
// const translationsMap = (event.translations ?? []).reduce((acc, t) => {
//   acc[t.locale] = { title: t.title, description: t.description };
//   return acc;
// }, {} as Record<string, { title: string; description: string | null }>);
```

### Pattern 7: Full-Text Search WHERE Clause

```typescript
// Source: [ASSUMED - plainto_tsquery syntax] + D-07 (locked decision)
if (query.q) {
  qb.andWhere(
    'event."search_vector" @@ plainto_tsquery(\'simple\', :q)',
    { q: query.q },
  );
}
```

**TypeORM limitation:** Cannot reference a column declared `select: false` in a TypeScript `andWhere()` directly by relation property name — must use the raw column name in the WHERE string. Use `event."search_vector"` (quoting the column per PostgreSQL camelCase convention in this project).

### Anti-Patterns to Avoid

- **Returning raw EventEntity from public controller:** Always map to `PublicEventListItemDto`/`PublicEventDetailDto`. Raw entity exposes `organizerId` scalar, `deletedAt`, and other internal fields. Never rely on TypeScript type narrowing for field exclusion — call the explicit mapping function.
- **App-side tsvector update in `EventsService.update()`:** D-04 locks the trigger approach. Adding tsvector update to service would create a dual-write maintenance problem.
- **Eager loading translations by default:** `eager: false` is the established pattern (CategoryEntity line 33). Load translations explicitly via `.leftJoinAndSelect()` only when the endpoint needs them.
- **Using `to_tsquery` for user input:** `to_tsquery` raises a PostgreSQL error if the user provides an input that doesn't parse as a valid tsquery expression (e.g. "jazz & "). `plainto_tsquery` always succeeds — D-07 locks this.
- **Using `@Public()` on `EventsController` class while `OrganizerGuard` is active:** Class-level `@Public()` would bypass the organizer guard on all routes, including the translation upsert endpoint. Public decorator and OrganizerGuard must be on separate controllers or applied at the method level.
- **Surrogate PK on EventTranslationEntity:** CategoryTranslationEntity uses CUID2 surrogate. EventTranslationEntity deliberately uses composite PK to avoid the upsert-destroying-id-FK-cascade problem documented in the categories seed comment.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Translation upsert conflict | Manual find + save | `repository.upsert({ conflictPaths: [...] })` | Atomic INSERT ... ON CONFLICT; no TOCTOU race; verified in codebase (users.service.ts, categories.seed.ts) |
| Full-text index maintenance | App-side tsvector update on each save | PostgreSQL DB trigger | Trigger fires on any write path (migration, seed, admin); app-side misses out-of-band writes |
| Cursor encoding | Custom serialization | `Buffer.from(...).toString('base64url')` | Already in codebase; identical pattern in EventsService.encodeCursor/decodeCursor |
| City prefix search | Full-text search index on city | `LIKE LOWER(:city) || '%'` | Simple prefix match is sufficient for MVP per D-09; no index needed for city at MVP scale |
| Search query sanitization | Input cleaning before tsquery | `plainto_tsquery` | Function handles any natural language input without injection risk |

**Key insight:** PostgreSQL tsvector + GIN is a mature, battle-tested full-text search system. The only application code needed is a single `WHERE ... @@ plainto_tsquery(...)` clause — everything else (tokenization, stemming, index lookups) happens in the DB engine.

---

## Runtime State Inventory

> Phase 7 is NOT a rename/refactor/migration phase — no existing strings are renamed. This section is explicitly skipped.
>
> Rationale: Phase 7 only adds new columns, a new table, new routes, and new entities. No existing data is restructured.

---

## Common Pitfalls

### Pitfall 1: TypeORM @BeforeInsert Does Not Fire on upsert()

**What goes wrong:** Developers put PK generation in `@BeforeInsert()` hook, then call `repository.upsert()` and find no `id` is generated — TypeORM throws a DB constraint error.
**Why it happens:** TypeORM bypasses entity lifecycle hooks on the `upsert()` code path.
**How to avoid:** For EventTranslationEntity with composite PK, no surrogate id is generated — this pitfall does not apply. For any entity that uses `upsert()` AND has a surrogate CUID2, pre-generate the id: `{ id: createId(), ...rest }` (pattern already in `users.service.ts` and documented in codebase).
**Warning signs:** `violates not-null constraint` on `id` column when calling `upsert()`.

### Pitfall 2: tsvector Column Triggers TypeORM Null-Write on Save

**What goes wrong:** Adding `@Column({ type: 'tsvector' })` without `insert: false, update: false` causes TypeORM to include `search_vector = NULL` in its generated INSERT/UPDATE SQL, overwriting the trigger's result.
**Why it happens:** TypeORM generates SQL for all `@Column`-decorated fields. Without `insert: false, update: false`, it writes `NULL` when the TypeScript property is undefined.
**How to avoid:** Declare `@Column({ type: 'tsvector', select: false, nullable: true, insert: false, update: false })`.
**Warning signs:** After INSERT via TypeORM, `search_vector` is NULL even though the trigger was created; `@@ plainto_tsquery(...)` queries return no results.

### Pitfall 3: N+1 on Translations

**What goes wrong:** Loading events with `find()`, then iterating and calling `translationRepository.find({ where: { eventId: event.id } })` for each event — N+1 queries.
**Why it happens:** TypeORM doesn't auto-join unless relations are specified.
**How to avoid:** Use `.leftJoinAndSelect('event.translations', 'translations')` in the QueryBuilder so all translations are fetched in one JOIN.
**Warning signs:** Slow response times that scale linearly with result count; DB logs showing many `SELECT * FROM event_translations WHERE eventId = $1` calls.

### Pitfall 4: Column Quoting in QueryBuilder for camelCase Columns

**What goes wrong:** `qb.andWhere('event.searchVector @@ ...')` fails because TypeORM may not resolve `searchVector` to the DB column name when the column is `select: false` or when using raw SQL in the WHERE clause.
**Why it happens:** TypeORM uses the `@Column` name alias internally but the raw WHERE string goes directly to PostgreSQL.
**How to avoid:** Use `event."search_vector"` in raw WHERE strings. Check the actual DB column name in the migration — this project uses camelCase column names stored with quotes (e.g., `"organizerId"`, `"startAt"`). Confirm the column name used in migration DDL.
**Warning signs:** `column "searchvector" does not exist` PostgreSQL error.

### Pitfall 5: Controller Route Order — `GET /events/me` vs `GET /events/:id`

**What goes wrong:** If `GET /events/:id` is registered before a future `GET /events/me`-style route, NestJS matches `"me"` as the `:id` param.
**Why it happens:** NestJS routes match in registration order within a controller.
**How to avoid:** Register any literal-path routes (if added) before parametric routes. Currently Phase 7 only has `GET /events` and `GET /events/:id` — no collision risk. Document for future phases.
**Warning signs:** Fixed-string paths returning 404 or incorrect behavior.

### Pitfall 6: tsvector Trigger on event_translations Must Use AFTER

**What goes wrong:** Using `BEFORE INSERT OR UPDATE OR DELETE` on `event_translations` for the trigger that UPDATEs the parent `events` row causes unpredictable behavior — the UPDATE on `events` fires a second trigger on `events` while still inside the first trigger.
**Why it happens:** PostgreSQL allows BEFORE triggers to UPDATE other tables, but UPDATE on `events` fires `events_search_vector_trigger`. If that trigger is BEFORE too, it reads from `event_translations` which may not reflect the current write yet (the triggering row is not yet committed to the table at BEFORE time on the child).
**How to avoid:** `event_translations` trigger must be `AFTER INSERT OR UPDATE OR DELETE`. The `events` trigger can be `BEFORE INSERT OR UPDATE` (it reads from `event_translations` at that point using already-committed rows, which is correct).
**Warning signs:** Infinite trigger loop detection by PostgreSQL (max stack depth error), or `search_vector` not including the translation that was just upserted.

### Pitfall 7: status Index Already Exists from Phase 6

**What goes wrong:** Migration tries to `CREATE INDEX idx_events_status` but it already exists from the Phase 6 migration (`1748000000000-events-fk.ts` Step 7).
**Why it happens:** Phase 6 already created `idx_events_status`. Phase 7 migration must not attempt to recreate it.
**How to avoid:** Do NOT add a status index in the Phase 7 migration. Verify existing indexes: `idx_events_organizer_id`, `idx_events_start_at_id`, `idx_events_status` all exist from Phase 6. Phase 7 only adds: `idx_events_city` (optional, Claude's Discretion) and `idx_events_search_vector` (GIN). [VERIFIED: codebase, `1748000000000-events-fk.ts`]

---

## Code Examples

Verified patterns from official sources and codebase:

### Cursor Pagination Reuse (from EventsService, verified)

```typescript
// Source: src/events/events.service.ts (VERIFIED codebase)
// encodeCursor and decodeCursor are private static — extract or duplicate for public methods
private static encodeCursor(startAt: Date, id: string): string {
  return Buffer.from(`${startAt.toISOString()}__${id}`).toString('base64url');
}

private static decodeCursor(cursor: string): { cursorStartAt: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorStartAt, cursorId] = raw.split('__');
  return { cursorStartAt, cursorId };
}
```

The public listing reuses the identical `(startAt, id)` cursor key and encoding. The planner can either make these helpers `static` and share them, or duplicate them — either is acceptable since the method bodies are trivial.

### Translation Upsert (from categories.seed.ts pattern, verified)

```typescript
// Source: src/database/seeds/categories.seed.ts (VERIFIED codebase) — same pattern
await this.translationRepository.upsert(
  { eventId, locale, title: dto.title, description: dto.description ?? null },
  { conflictPaths: ['eventId', 'locale'] },
);
```

### @Public() usage (from organizers.controller.ts, verified)

```typescript
// Source: src/organizers/organizers.controller.ts line 43 (VERIFIED codebase)
@Public()
@Get(':id')
async findById(@Param('id') id: string): Promise<OrganizerPublicResponseDto> { ... }
```

### findOwnedOrThrow pattern (from events.service.ts, verified)

```typescript
// Source: src/events/events.service.ts (VERIFIED codebase) — use as-is for translation ownership
private async findOwnedOrThrow(eventId: string, organizerId: string): Promise<EventEntity> {
  const event = await this.eventRepository.findOne({ where: { id: eventId, organizerId } });
  if (!event) {
    throw new NotFoundException(`Event with id '${eventId}' not found`);
  }
  return event;
}
```

The translation PUT endpoint calls this before upsert. Returns 404 (not 403) per no-info-leakage pattern (Phase 5/6 established).

### Translations Map Assembly

```typescript
// Source: [ASSUMED based on CategoriesService.toResponseItem() pattern, codebase]
// CategoriesService verified: Object.fromEntries(translations.map((t) => [t.locale, t.name]))
// Events version produces nested objects:
const translationsMap = (event.translations ?? []).reduce(
  (acc, t) => {
    acc[t.locale] = { title: t.title, description: t.description };
    return acc;
  },
  {} as Record<string, { title: string; description: string | null }>,
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Full-text search with ILIKE | PostgreSQL tsvector/GIN | D-04/D-07 locked | Faster, language-aware, works across translations |
| Server-side Accept-Language | Client-side translations map | D-01 locked | Simpler API; consistent with Category pattern |
| Separate search endpoint | Inline `?q=` filter on list endpoint | D-07 | One endpoint to cache/optimize |

**No deprecated patterns:** All Phase 7 patterns are standard TypeORM 0.3.x + NestJS 11.x practices.

---

## Phase 6 Completion Status

**Confirmed COMPLETE as of 2026-05-09.** [VERIFIED: codebase + SUMMARY files]

| Plan | Status | Evidence |
|------|--------|----------|
| 06-01: Wave 0 TDD stubs | Complete | `src/events/events.service.spec.ts`, `events.controller.spec.ts` exist |
| 06-02: EventEntity relations + DTOs | Complete | `src/events/event.entity.ts` has `@ManyToOne` relations; 5 DTOs exist |
| 06-03: Migration | Complete | `1748000000000-events-fk.ts` exists; FK + indexes applied |
| 06-04: EventsService | Complete | `src/events/events.service.ts` fully implemented |
| 06-05: EventsController + Module | Complete | Controller + module files exist; AppModule wired |
| 06-06: Migration run + verification | Complete | `06-06-SUMMARY.md` documents human verification; 116/116 GREEN |

**Current test state:** 116/116 tests pass. `npx tsc --noEmit` exits 0. [VERIFIED: run during research 2026-05-09]

Phase 7 has a clean foundation. No outstanding Phase 6 debt.

---

## Open Questions

1. **PublicEventsController vs extending EventsController**
   - What we know: EventsController has class-level `@UseGuards(OrganizerGuard)`. Public routes cannot share this guard.
   - What's unclear: Whether the planner prefers a single controller file or two (one per audience).
   - Recommendation: Create `PublicEventsController` at `src/events/public-events.controller.ts` (separate file, same module). Keeps guard responsibilities clean. Translation endpoint stays in `EventsController`.

2. **`DELETE` on translations endpoint**
   - What we know: CONTEXT.md lists this as Claude's Discretion. ROADMAP does not mention it.
   - What's unclear: Whether any v1 use case requires removing a translation (as opposed to updating it to empty string).
   - Recommendation: Skip DELETE in Phase 7 — upsert covers the update case; a translation with empty content can be overwritten on next PUT.

3. **City index**
   - What we know: `WHERE LOWER(city) LIKE LOWER(:city) || '%'` is a prefix LIKE query. A functional index `LOWER(city)` would help at scale.
   - What's unclear: Expected cardinality in MVP (single city/region; likely low).
   - Recommendation: Add `CREATE INDEX idx_events_city ON events (LOWER("city"))` in Phase 7 migration. Cheap to add now; avoids sequential scan even at MVP scale.

4. **`tsvector_agg` PostgreSQL version dependency**
   - What we know: `tsvector_agg` was added in PostgreSQL 14. If the server runs PostgreSQL 13 or below, it is unavailable.
   - What's unclear: The PostgreSQL version in the deployment environment.
   - Recommendation: Verify with `SELECT version()` before finalizing trigger SQL. If PG < 14, replace `tsvector_agg(...)` with an alternative accumulation using `string_agg` + `to_tsvector`. [ASSUMED: PG 14+ is likely given the 2026 codebase, but must be confirmed.]

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | tsvector/GIN, triggers | ✓ (running — migration:run worked in Phase 6) | Assumed 14+ (unverified) | — |
| Node.js | pnpm migration:run | ✓ | — | — |
| pnpm | migration:run, tests | ✓ | — | — |

**Missing dependencies with no fallback:**
- `tsvector_agg` availability — requires PostgreSQL >= 14. Must verify before writing trigger. If PG 13: use `string_agg` workaround.

**Missing dependencies with fallback:**
- None beyond the tsvector_agg version question.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30.0.0 |
| Config file | `package.json` (`jest` key, `testRegex: ".*\\.spec\\.ts$"`) |
| Quick run command | `npx jest --testRegex="events" --passWithNoTests` |
| Full suite command | `npx jest` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EVT-04 | GET /events returns only PUBLISHED events, no auth required | unit | `npx jest --testRegex="public-events.controller.spec"` | ❌ Wave 0 |
| EVT-06 | GET /events returns cursor-paginated result with nextCursor, hasMore | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub in events.service.spec.ts) |
| DISC-01 | ?category=slug filters to events in that category | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| DISC-02 | ?start= and ?end= filter by date range | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| DISC-03 | ?city=Pra returns city-prefix-matched events | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| DISC-04 | ?q=jazz hits search_vector tsvector column | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| I18N-01 | GET /events response includes translations map per event | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| I18N-03 | PUT /organizer/events/:id/translations/:locale upserts translation | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |
| I18N-03 | Translation PUT returns 404 for non-owned event | unit | `npx jest --testRegex="events.service.spec"` | ✅ (stub) |

### Sampling Rate

- **Per task commit:** `npx jest --testRegex="events" --passWithNoTests`
- **Per wave merge:** `npx jest`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/events/public-events.controller.spec.ts` — covers EVT-04, EVT-06 (public controller tests)
- [ ] New describe blocks in `events.service.spec.ts` — covers `findPublished()`, `findPublishedById()`, `upsertTranslation()` methods
- [ ] `src/events/event-translation.entity.spec.ts` — covers EventTranslationEntity composite PK

*(Existing `events.service.spec.ts` and `events.controller.spec.ts` are present with stubs — extend them; do not replace.)*

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes (translation endpoint) | OrganizerGuard + @CurrentOrganizer() — already implemented |
| V3 Session Management | No | Stateless JWT; no sessions |
| V4 Access Control | Yes (ownership check) | findOwnedOrThrow() → 404 not 403 (no info leakage) |
| V5 Input Validation | Yes | class-validator: @IsString, @MaxLength, @IsUrl, @IsDateString on all DTO fields |
| V6 Cryptography | No | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated access to draft/cancelled events | Information disclosure | `WHERE status = 'PUBLISHED'` enforced in service; never from query param |
| tsquery injection via ?q= param | Tampering | `plainto_tsquery` — handles arbitrary input without injection risk; no raw SQL concat |
| City LIKE injection via ?city= param | Tampering | Parameterized `LIKE :city_param || '%'` — no raw SQL concat |
| Cross-organizer translation write | Elevation of privilege | findOwnedOrThrow() before upsert; 404 on non-owned (no 403 info leakage) |
| Oversized imageUrl or description | DoS / DB constraint | `@MaxLength(2048)` on imageUrl DTO, `@MaxLength(5000)` on description; SEC-01 pattern |
| Soft-deleted events appearing in public listing | Information disclosure | TypeORM `@DeleteDateColumn` auto-filters WHERE deletedAt IS NULL by default; no explicit filter needed |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@Column({ type: 'tsvector', insert: false, update: false, select: false })` prevents TypeORM from overwriting the trigger-managed column | Architecture Patterns — Pattern 3 | TypeORM may still include the column in DML; test with a `save()` after trigger creation and verify search_vector is non-null |
| A2 | `tsvector_agg` is available (PostgreSQL >= 14) | Open Questions #4 | If PG 13 or below, must rewrite trigger using `string_agg` accumulation |
| A3 | The `event_translations` AFTER trigger on the parent UPDATE does not cause infinite recursion (events trigger reads from event_translations; event_translations trigger UPDATEs events) | Architecture Patterns — Pattern 4 | PostgreSQL by default does NOT prevent mutual trigger recursion across different tables; must verify in a test DB that updating an event does not loop |
| A4 | TypeORM `conflictPaths: ['eventId', 'locale']` works correctly when both columns form a composite PK (no separate unique constraint is needed) | Architecture Patterns — Pattern 2 | TypeORM may require an explicit unique constraint definition beyond composite PK for `ON CONFLICT` to resolve; if so, add `CONSTRAINT UQ_event_translations_event_locale UNIQUE ("eventId", locale)` in migration |

**Risk mitigation:** Items A1, A3, and A4 should be validated during Wave 0 (migration + trigger creation) before service implementation begins. A2 can be checked with a single `SELECT version()` query.

---

## Sources

### Primary (HIGH confidence)

- Codebase `src/events/events.service.ts` — cursor pagination exact implementation (encodeCursor, decodeCursor, QueryBuilder pattern, findOwnedOrThrow)
- Codebase `src/events/events.controller.ts` — controller structure, OrganizerGuard usage
- Codebase `src/categories/categories.service.ts` — translations map assembly pattern (Object.fromEntries)
- Codebase `src/users/users.service.ts` — upsert with conflictPaths, @BeforeInsert not firing
- Codebase `src/database/seeds/categories.seed.ts` — upsert with composite conflictPaths
- Codebase `src/database/migrations/1748000000000-events-fk.ts` — migration raw SQL pattern, existing indexes (status, startAt, organizerId)
- Codebase `src/auth/decorators/public.decorator.ts` — @Public() implementation
- `/n8n-io/typeorm` Context7 docs — `repository.upsert()` with `conflictPaths`, QueryBuilder `orUpdate`
- `.planning/phases/07-public-event-discovery/07-CONTEXT.md` — all locked decisions (D-01 through D-13)

### Secondary (MEDIUM confidence)

- `.planning/phases/06-organizer-event-crud/06-CONTEXT.md` — Phase 6 completion status, deferred fields
- `.planning/phases/04-categories/04-CONTEXT.md` — D-12 translations map pattern that Phase 7 mirrors

### Tertiary (LOW confidence / ASSUMED)

- TypeORM `@Column({ type: 'tsvector', insert: false, update: false })` behavior — training knowledge; TypeORM docs do not cover tsvector specifically [ASSUMED A1]
- tsvector_agg PostgreSQL 14+ availability — training knowledge; not verified against deployment DB [ASSUMED A2]
- AFTER trigger safety for cross-table mutual triggers — training knowledge; requires runtime validation [ASSUMED A3]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json, npm registry
- Architecture: HIGH — patterns directly observed in codebase (Phase 4, 5, 6 code)
- Cursor pagination: HIGH — exact implementation verified in EventsService
- tsvector/GIN migration: MEDIUM — SQL pattern from CONTEXT.md specifics + PostgreSQL knowledge; marked assumptions need runtime validation
- Pitfalls: HIGH — several verified from codebase comments (Phase 5 Swagger lesson, @BeforeInsert/upsert, find-or-insert for id preservation)

**Research date:** 2026-05-09
**Valid until:** 2026-06-09 (stable stack; TypeORM and NestJS versions locked in package.json)
