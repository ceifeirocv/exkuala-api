---
phase: 08-rsvp
plan: 01
type: tdd
wave: 4
depends_on: []
files_modified:
  # Wave 0 — TDD RED stubs
  - src/rsvp/rsvp.service.spec.ts
  - src/me/me.controller.spec.ts
  - src/events/events-rsvp.controller.spec.ts
  - src/events/events.service.spec.ts        # extend with RSVP-03 count tests
  # Wave 1 — Infrastructure
  - src/rsvp/rsvp.entity.ts
  - src/rsvp/dto/create-rsvp.dto.ts
  - src/rsvp/dto/rsvp-response.dto.ts
  - src/rsvp/dto/rsvp-history-item.dto.ts
  - src/rsvp/dto/paginated-rsvp-history.dto.ts
  - src/rsvp/dto/rsvp-history-query.dto.ts
  - src/events/dto/public-event-detail.dto.ts  # add interestedCount / goingCount (D-08)
  - src/database/migrations/1750000000000-rsvps.ts
  # Wave 2 — Implementation
  - src/rsvp/rsvp.service.ts
  - src/rsvp/rsvp.module.ts
  - src/events/events-rsvp.controller.ts
  - src/me/me.controller.ts
  - src/me/me.module.ts
  - src/events/events.service.ts              # extend findPublishedById + inject RsvpService
  # Wave 3 — Wiring
  - src/events/events.module.ts
  - src/app.module.ts
autonomous: true
requirements:
  - RSVP-01
  - RSVP-02
  - RSVP-03
  - RSVP-04

must_haves:
  truths:
    - "Authenticated user can RSVP to a published event with INTERESTED or GOING; second call updates state, does not insert a duplicate row"
    - "Authenticated user can cancel their RSVP; cancelled RSVPs do not appear in GET /me/rsvps"
    - "GET /api/v1/events/:id returns interestedCount and goingCount as integers"
    - "GET /api/v1/me/rsvps returns non-cancelled RSVPs cursor-paginated, most-recently-RSVPed first"
    - "RSVP to a non-PUBLISHED event returns 404/422; unauthenticated RSVP request returns 401"
  artifacts:
    - path: "src/rsvp/rsvp.entity.ts"
      provides: "RsvpEntity with cuid2 PK, userId FK, eventId FK, state enum, rsvpedAt"
      contains: "RsvpState"
    - path: "src/rsvp/rsvp.service.ts"
      provides: "upsertRsvp(), cancelRsvp(), listUserRsvps() with cursor pagination"
      exports: ["RsvpService"]
    - path: "src/rsvp/rsvp.module.ts"
      provides: "RsvpModule exporting RsvpService for EventsModule + MeModule"
      exports: ["RsvpModule"]
    - path: "src/events/events-rsvp.controller.ts"
      provides: "POST /events/:id/rsvp and DELETE /events/:id/rsvp (authenticated)"
      exports: ["EventsRsvpController"]
    - path: "src/me/me.controller.ts"
      provides: "GET /me/rsvps (authenticated, cursor-paginated)"
      exports: ["MeController"]
    - path: "src/me/me.module.ts"
      provides: "MeModule importing RsvpModule, registering MeController"
      exports: ["MeModule"]
    - path: "src/database/migrations/1750000000000-rsvps.ts"
      provides: "CREATE TABLE rsvps with enum, FKs, unique constraint, indexes"
      contains: "rsvp_state"
  key_links:
    - from: "src/events/events-rsvp.controller.ts"
      to: "src/rsvp/rsvp.service.ts"
      via: "constructor injection of RsvpService (provided via RsvpModule import in EventsModule)"
      pattern: "RsvpService"
    - from: "src/events/events.service.ts"
      to: "src/rsvp/rsvp.service.ts"
      via: "constructor injection; countByEventAndState() called in findPublishedById()"
      pattern: "countByEventAndState"
    - from: "src/me/me.controller.ts"
      to: "src/rsvp/rsvp.service.ts"
      via: "constructor injection of RsvpService (provided via RsvpModule import in MeModule)"
      pattern: "listUserRsvps"
    - from: "src/events/events.module.ts"
      to: "src/rsvp/rsvp.module.ts"
      via: "EventsModule.imports includes RsvpModule"
      pattern: "RsvpModule"
    - from: "src/app.module.ts"
      to: "src/me/me.module.ts"
      via: "AppModule.imports includes MeModule"
      pattern: "MeModule"
---

# Phase 08: RSVP — Plan

**Goal:** Authenticated users can express interest in or commit to attending events, cancel their RSVP, see aggregated attendance counts on events, and retrieve their personal RSVP history.

**Requirements:** RSVP-01, RSVP-02, RSVP-03, RSVP-04

<objective>
Deliver authenticated two-state RSVP for published events.

Purpose: Allows registered users to commit to or express interest in events, giving organizers attendance signals and users a personal calendar of upcoming events.

Output:
- `src/rsvp/` module with entity, service, DTOs
- `src/events/events-rsvp.controller.ts` — POST + DELETE RSVP write endpoints
- `src/me/` module with MeController — GET /me/rsvps history endpoint
- Extension of EventsService.findPublishedById() to include live RSVP counts
- Database migration creating the `rsvps` table
- TDD spec files covering all four requirements
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/phases/08-rsvp/08-CONTEXT.md
@.planning/phases/08-rsvp/RESEARCH.md
@.planning/phases/08-rsvp/08-PATTERNS.md

<!-- Prior phase summaries needed for interface contracts -->
@src/events/events.service.ts
@src/events/events.module.ts
@src/app.module.ts
@src/events/dto/public-event-detail.dto.ts
@src/events/dto/public-event-list-item.dto.ts
@src/auth/decorators/current-user.decorator.ts

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase. -->

From src/events/events.module.ts (current state — Wave 3 adds RsvpModule here):
```typescript
@Module({
  imports: [TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]), OrganizersModule],
  providers: [EventsService],
  controllers: [EventsController, PublicEventsController],
})
export class EventsModule {}
```

From src/app.module.ts entities array (current — Wave 3 adds RsvpEntity + MeModule):
```typescript
entities: [UserEntity, EventEntity, CategoryEntity, CategoryTranslationEntity,
           OrganizerEntity, OrganizerAuditLogEntity, EventTranslationEntity],
```

From src/events/events.service.ts — findPublishedById signature (Wave 2 extends this):
```typescript
async findPublishedById(id: string): Promise<PublicEventDetailDto>
```

From src/events/dto/public-event-detail.dto.ts (Wave 1 adds interestedCount/goingCount):
```typescript
export class PublicEventDetailDto extends PublicEventListItemDto {
  ticketPrice: number | null;
  externalTicketUrl: string | null;
  declare organizer: { id: string; name: string; bio: string | null; contact: string | null };
  declare category: { id: string; slug: string; name: string; translations: Record<string, string> } | null;
  // Phase 8 adds:
  // interestedCount: number;
  // goingCount: number;
}
```

From src/auth/decorators/current-user.decorator.ts:
```typescript
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
    return request.user;
  },
);
// AuthenticatedUser = { id: string; auth0Id: string; roles: string[] }
```

Cursor encoding convention (from events.service.ts):
```typescript
private static encodeCursor(fieldA: Date, id: string): string {
  return Buffer.from(`${fieldA.toISOString()}__${id}`).toString('base64url');
}
private static decodeCursor(cursor: string): { cursorFieldA: string; cursorId: string } {
  const raw = Buffer.from(cursor, 'base64url').toString('utf8');
  const [cursorFieldA, cursorId] = raw.split('__');
  return { cursorFieldA, cursorId };
}
// Phase 8 uses rsvpedAt DESC + id ASC with < comparison (not > as in Phase 7 ASC)
```
</interfaces>
</context>

---

## Threat Model

| Boundary | Description |
|----------|-------------|
| client → POST /events/:id/rsvp | Unauthenticated or misrouted request could attempt RSVP write |
| client → DELETE /events/:id/rsvp | User could attempt to cancel another user's RSVP |
| client → GET /me/rsvps | User could attempt to read another user's RSVP history |

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-08-01 | Elevation of Privilege | POST /events/:id/rsvp | mitigate | No `@Public()` on EventsRsvpController — JwtAuthGuard applies globally; `@CurrentUser()` extracts userId from verified JWT, never from request body |
| T-08-02 | Tampering | DELETE /events/:id/rsvp | mitigate | cancelRsvp(userId, eventId) — userId sourced from JWT via `@CurrentUser()`, not from URL; 404 if row not found for that userId (no info leakage of other users' RSVPs) |
| T-08-03 | Information Disclosure | GET /me/rsvps | mitigate | listUserRsvps() scopes WHERE clause to userId from JWT; a valid token for user A cannot retrieve user B's history |
| T-08-04 | Tampering | POST /events/:id/rsvp on non-PUBLISHED event | mitigate | Guard in upsertRsvp(): fetch event first, throw NotFoundException if not found, throw UnprocessableEntityException if status != PUBLISHED |
| T-08-05 | Tampering | npm/pip/cargo installs | mitigate | No new packages introduced in this phase; all libraries already present in package.json |

---

## Wave 0 — TDD Red Stubs

**Goal:** Create spec files that import source modules that do not yet exist. Jest must fail at the import level ("Cannot find module"). This is the required RED state before any implementation.

<task type="tdd" tdd="true">
  <name>Task 1: Wave 0 — TDD RED stubs for RsvpService and MeController</name>
  <files>
    src/rsvp/rsvp.service.spec.ts,
    src/me/me.controller.spec.ts,
    src/events/events-rsvp.controller.spec.ts
  </files>
  <behavior>
    RsvpService spec:
    - Test: upsertRsvp() calls repository insert().orUpdate() and returns fetched entity
    - Test: upsertRsvp() throws NotFoundException when event does not exist
    - Test: upsertRsvp() throws UnprocessableEntityException when event.status != PUBLISHED
    - Test: cancelRsvp() happy path — mockRepo.findOne.mockResolvedValue(mockRsvpRow); assert
      repository.update({ userId, eventId }, { state: CANCELLED }) called; returns void
    - Test: cancelRsvp() throws NotFoundException when no RSVP row found —
      mockRepo.findOne.mockResolvedValue(null)
    - Test: listUserRsvps() returns paginated envelope { data, nextCursor, hasMore }
    - Test: listUserRsvps() filters out CANCELLED RSVPs (WHERE state != CANCELLED)
    - Test: listUserRsvps() with cursor decodes and applies < comparison

    EventsRsvpController spec:
    - Test: POST /events/:id/rsvp calls rsvpService.upsertRsvp(user.id, eventId, dto) and returns 201
    - Test: DELETE /events/:id/rsvp calls rsvpService.cancelRsvp(user.id, eventId) and returns 204

    MeController spec:
    - Test: GET /me/rsvps calls rsvpService.listUserRsvps(user.id, query) and returns result
    - Test: GET /me/rsvps passes cursor and limit from query params to service
  </behavior>
  <action>
    Create three spec files with complete test suites. All imports reference non-existent source
    files — this is intentional to establish the RED state.

    src/rsvp/rsvp.service.spec.ts:
    - Use TestingModule pattern with getRepositoryToken(RsvpEntity) mock and a mock EventRepository
    - Mock repository: { createQueryBuilder: jest.fn(), count: jest.fn(), update: jest.fn(), findOne: jest.fn() }
    - Mock eventRepository (for PUBLISHED guard): { findOne: jest.fn() }
    - Wire both via providers array in TestingModule
    - Include all behavior tests listed above with jest.fn() stubs; assertions use
      mockReturnValue/mockResolvedValue to control return shapes
    - Import from './rsvp.entity' and './rsvp.service' (both RED imports)

    src/events/events-rsvp.controller.spec.ts:
    - Use direct instantiation pattern (no TestingModule)
    - mockRsvpService = { upsertRsvp: jest.fn(), cancelRsvp: jest.fn() }
    - controller = new EventsRsvpController(mockRsvpService as unknown as RsvpService)
    - Import from './events-rsvp.controller' (RED) and '../rsvp/rsvp.service' (RED)

    src/me/me.controller.spec.ts:
    - Use direct instantiation pattern
    - mockRsvpService = { listUserRsvps: jest.fn() }
    - controller = new MeController(mockRsvpService as unknown as RsvpService)
    - Import from './me.controller' (RED) and '../rsvp/rsvp.service' (RED)

    Additionally extend src/events/events.service.spec.ts: add a describe block
    'findPublishedById with RSVP counts' with tests:
    - returns interestedCount as a number in the DTO
    - returns goingCount as a number in the DTO
    - calls rsvpService.countByEventAndState() twice (once per state)
    Add a mock variable and a NestJS provider entry to the existing TestingModule:
      const mockRsvpService = { countByEventAndState: jest.fn() };
      // in TestingModule providers array — MUST use { provide, useValue } form:
      { provide: RsvpService, useValue: mockRsvpService }
    Import RsvpService from '../rsvp/rsvp.service' (RED).

    Verify RED state: run `pnpm test --passWithNoTests 2>&1 | grep -E "Cannot find module|FAIL"`.
    Expected: "Cannot find module" errors for rsvp.service, rsvp.entity, events-rsvp.controller,
    me.controller. This confirms the TDD RED baseline.
  </action>
  <verify>
    <automated>pnpm test -- --testPathPattern="rsvp.service.spec|me.controller.spec|events-rsvp.controller.spec" 2>&1 | grep -E "Cannot find module|Cannot find|FAIL" | head -20</automated>
  </verify>
  <done>
    All three spec files exist. Running the test suite shows "Cannot find module" import errors
    for rsvp.service, rsvp.entity, events-rsvp.controller, and me.controller. No spec passes
    yet — this is the required RED baseline.
  </done>
</task>

---

## Wave 1 — Infrastructure

**Goal:** Create the database foundation and all types/DTOs. No service logic yet. Tests from Wave 0 remain RED (source files not created until Wave 2).

<task type="auto">
  <name>Task 2: Wave 1 — RsvpEntity, all DTOs, and migration</name>
  <files>
    src/rsvp/rsvp.entity.ts,
    src/rsvp/dto/create-rsvp.dto.ts,
    src/rsvp/dto/rsvp-response.dto.ts,
    src/rsvp/dto/rsvp-history-item.dto.ts,
    src/rsvp/dto/paginated-rsvp-history.dto.ts,
    src/rsvp/dto/rsvp-history-query.dto.ts,
    src/events/dto/public-event-detail.dto.ts,
    src/database/migrations/1750000000000-rsvps.ts
  </files>
  <action>
    src/rsvp/rsvp.entity.ts:
    - Export enum RsvpState { INTERESTED = 'INTERESTED', GOING = 'GOING', CANCELLED = 'CANCELLED' }
    - @Entity('rsvps') class RsvpEntity
    - @PrimaryColumn({ type: 'varchar', length: 30 }) id: string
    - @BeforeInsert() generateId() { if (!this.id) this.id = createId(); }  — import createId from @paralleldrive/cuid2
    - @Column({ type: 'varchar', length: 30 }) userId: string
    - @Column({ type: 'varchar', length: 30 }) eventId: string
    - @Column({ type: 'enum', enum: RsvpState, enumName: 'rsvp_state' }) state: RsvpState
      — enumName is REQUIRED per RESEARCH.md pitfall (prevents TypeORM auto-generated name collision)
    - @CreateDateColumn() rsvpedAt: Date  — set on INSERT, never updated (D-08 of CONTEXT; matches
      @CreateDateColumn semantics: only written on first insert)
    - @CreateDateColumn() createdAt: Date
    - @UpdateDateColumn() updatedAt: Date
    - No @ManyToOne relation properties — service uses scalar FK columns only (mirrors EventEntity pattern)
    - @ApiProperty() on every column field
    - No unique constraint decorator on entity — uniqueness enforced at DB level in migration only

    src/rsvp/dto/create-rsvp.dto.ts:
    - class CreateRsvpDto
    - @ApiProperty({ enum: [RsvpState.INTERESTED, RsvpState.GOING] })
      @IsEnum([RsvpState.INTERESTED, RsvpState.GOING])
      @IsNotEmpty()
      state: RsvpState.INTERESTED | RsvpState.GOING
      — CANCELLED is intentionally excluded from the allowed enum values (internal-only state)

    src/rsvp/dto/rsvp-response.dto.ts:
    - class RsvpResponseDto — returned by POST /events/:id/rsvp (201)
    - @ApiProperty() id: string
    - @ApiProperty({ enum: RsvpState }) state: RsvpState
    - @ApiProperty() rsvpedAt: Date

    src/rsvp/dto/rsvp-history-item.dto.ts:
    - class RsvpHistoryItemDto — one item in GET /me/rsvps data array (D-09, D-11)
    - @ApiProperty({ enum: RsvpState }) rsvpState: RsvpState
    - @ApiProperty() rsvpedAt: Date
    - @ApiProperty() event: { id: string; title: string; startAt: Date; city: string | null; imageUrl: string | null }
      Use inline type (not separate class) — matches PublicEventListItemDto pattern

    src/rsvp/dto/paginated-rsvp-history.dto.ts:
    - class PaginatedRsvpHistoryDto — paginated envelope (D-10, D-11)
    - @ApiProperty({ type: [RsvpHistoryItemDto] }) data: RsvpHistoryItemDto[]
    - @ApiPropertyOptional({ nullable: true, description: 'Opaque base64url cursor for next page. Null if no more results.' })
      nextCursor: string | null
    - @ApiProperty() hasMore: boolean

    src/rsvp/dto/rsvp-history-query.dto.ts:
    - class RsvpHistoryQueryDto — query params for GET /me/rsvps
    - @ApiPropertyOptional() @IsOptional() @IsString() cursor?: string
    - @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
      @IsOptional() @IsInt() @Min(1) @Max(100) @Type(() => Number) limit?: number

    src/events/dto/public-event-detail.dto.ts — extend with RSVP count fields (D-08):
    - Read the file first, then add after externalTicketUrl:
      @ApiProperty({ example: 0 }) interestedCount: number;
      @ApiProperty({ example: 0 }) goingCount: number;

    src/database/migrations/1750000000000-rsvps.ts:
    - Class name: Rsvps1750000000000, property name = 'Rsvps1750000000000'
    - up():
      1. CREATE TYPE "rsvp_state" AS ENUM ('INTERESTED', 'GOING', 'CANCELLED')
      2. CREATE TABLE "rsvps" with:
         "id" varchar(30) NOT NULL
         "userId" varchar(30) NOT NULL
         "eventId" varchar(30) NOT NULL
         "state" "rsvp_state" NOT NULL
         "rsvpedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
         "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
         "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
         CONSTRAINT "PK_rsvps" PRIMARY KEY ("id")
         CONSTRAINT "UQ_rsvps_userId_eventId" UNIQUE ("userId", "eventId")
         CONSTRAINT "FK_rsvps_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
         CONSTRAINT "FK_rsvps_eventId" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE
      3. CREATE INDEX "idx_rsvps_eventId" ON "rsvps" ("eventId")
         — supports COUNT(*) WHERE eventId = ? (RSVP-03 performance)
      4. CREATE INDEX "idx_rsvps_userId_state" ON "rsvps" ("userId", "state")
         — supports WHERE userId = ? AND state != 'CANCELLED' (RSVP-04 performance)
    - down(): DROP INDEX idx_rsvps_userId_state, DROP INDEX idx_rsvps_eventId,
              DROP TABLE rsvps, DROP TYPE rsvp_state  (reverse order of up)
    - Add jsdoc comment block explaining: rsvp_state enum (D-04), UNIQUE constraint upsert target (D-06),
      CASCADE FKs rationale, rsvpedAt insert-only semantics, index purposes

    SEC-01 compliance: all varchar columns have explicit length (30). Enum column is DB-constrained.
    No @MaxLength needed on entity (migration-enforced DB constraint). DTOs have no free-text fields
    requiring @MaxLength.
  </action>
  <verify>
    <automated>pnpm tsc --noEmit 2>&1 | grep -v "node_modules" | head -30</automated>
  </verify>
  <done>
    All files exist. TypeScript compilation passes with no errors in project files.
    Migration file follows the 1750000000000-rsvps.ts naming convention. PublicEventDetailDto
    has interestedCount and goingCount fields.
  </done>
</task>

---

## Wave 2 — Implementation (GREEN)

**Goal:** Implement RsvpService, EventsRsvpController, MeController, and extend EventsService. All Wave 0 spec files must pass after this wave.

<task type="tdd" tdd="true">
  <name>Task 3: Wave 2 — RsvpService implementation</name>
  <files>
    src/rsvp/rsvp.service.ts,
    src/rsvp/rsvp.module.ts
  </files>
  <behavior>
    upsertRsvp(userId, eventId, dto):
    - Fetches event from eventRepository.findOne({ where: { id: eventId } })
    - Throws NotFoundException('Event with id ... not found') if null
    - Throws UnprocessableEntityException('Event is not published') if event.status != PUBLISHED
    - Calls createQueryBuilder().insert().into(RsvpEntity).values({...}).orUpdate(['state','updatedAt'],
      ['userId','eventId']).execute() — preserves rsvpedAt and id on conflict
    - Fetches and returns rsvpRepository.findOneOrFail({ where: { userId, eventId } }) after upsert

    cancelRsvp(userId, eventId):
    - Calls rsvpRepository.findOne({ where: { userId, eventId } })
    - Throws NotFoundException('RSVP not found') if null
    - Calls rsvpRepository.update({ userId, eventId }, { state: RsvpState.CANCELLED })
    - Returns void (controller sends 204)

    listUserRsvps(userId, query):
    - effectiveLimit = Math.min(query.limit ?? 20, 100)
    - QueryBuilder: FROM rsvps JOIN event WHERE userId = :userId AND state != CANCELLED
      ORDER BY rsvpedAt DESC, id ASC TAKE effectiveLimit + 1
    - If query.cursor: decodes base64url 'rsvpedAt__rsvpId', applies
      (rsvp."rsvpedAt", rsvp."id") < (:cursorRsvpedAt::timestamptz, :cursorId)
    - hasMore = rows.length > effectiveLimit
    - data = rows.slice(0, effectiveLimit) if hasMore else rows
    - nextCursor = hasMore && lastItem ? encodeCursor(lastItem.rsvpedAt, lastItem.id) : null
    - Returns { data: data.map(toRsvpHistoryItemDto), nextCursor, hasMore }

    countByEventAndState(eventId, state):
    - rsvpRepository.count({ where: { eventId, state } })
    - Returns number
  </behavior>
  <action>
    src/rsvp/rsvp.service.ts:
    - @Injectable() class RsvpService
    - private readonly logger = new Logger(RsvpService.name)
    - Constructor: @InjectRepository(RsvpEntity) rsvpRepository: Repository<RsvpEntity>,
      @InjectRepository(EventEntity) eventRepository: Repository<EventEntity>
      — EventEntity injection needed for the PUBLISHED guard in upsertRsvp()
    - Implement upsertRsvp(userId: string, eventId: string, dto: CreateRsvpDto): Promise<RsvpResponseDto>
      per behavior above. Use createQueryBuilder().insert().orUpdate() pattern (not repository.upsert())
      because rsvpedAt must NOT be overwritten on subsequent calls (RESEARCH.md pitfall).
      After orUpdate().execute(), fetch with rsvpRepository.findOneOrFail({ where: { userId, eventId } })
      and map to RsvpResponseDto manually: { id, state, rsvpedAt }.
    - Implement cancelRsvp(userId: string, eventId: string): Promise<void>
      per behavior above.
    - Implement listUserRsvps(userId: string, query: RsvpHistoryQueryDto): Promise<PaginatedRsvpHistoryDto>
      per behavior above. RsvpEntity has no @ManyToOne relation (scalar FKs only per PATTERNS.md).
      Use leftJoinAndMapOne to fetch event data in one query — this is the committed approach:
        const qb = this.rsvpRepository.createQueryBuilder('rsvp')
          .leftJoinAndMapOne('rsvp.event', EventEntity, 'event', 'event.id = rsvp.eventId')
          .where('rsvp.userId = :userId', { userId })
          .andWhere("rsvp.state != :cancelled", { cancelled: RsvpState.CANCELLED })
          .orderBy('rsvp.rsvpedAt', 'DESC')
          .addOrderBy('rsvp.id', 'ASC')
          .take(effectiveLimit + 1);
        if (query.cursor) {
          const { cursorRsvpedAt, cursorRsvpId } = RsvpService.decodeCursor(query.cursor);
          qb.andWhere(
            '(rsvp.rsvpedAt, rsvp.id) < (:cursorRsvpedAt::timestamptz, :cursorRsvpId)',
            { cursorRsvpedAt, cursorRsvpId }
          );
        }
        const rows = await qb.getMany() as (RsvpEntity & { event: EventEntity })[];
      Return PaginatedRsvpHistoryDto with mapped RsvpHistoryItemDto items.
      toRsvpHistoryItemDto(rsvp: RsvpEntity & { event: EventEntity }): RsvpHistoryItemDto
        { rsvpState: rsvp.state, rsvpedAt: rsvp.rsvpedAt,
          event: { id: rsvp.event.id, title: rsvp.event.title, startAt: rsvp.event.startAt,
                   city: rsvp.event.city, imageUrl: rsvp.event.imageUrl } }
    - Implement countByEventAndState(eventId: string, state: RsvpState): Promise<number>
      per behavior above.
    - Private static encodeCursor(rsvpedAt: Date, rsvpId: string): string
      Buffer.from(`${rsvpedAt.toISOString()}__${rsvpId}`).toString('base64url')
    - Private static decodeCursor(cursor: string): { cursorRsvpedAt: string; cursorRsvpId: string }
      split on '__'

    src/rsvp/rsvp.module.ts:
    - @Module({
        imports: [TypeOrmModule.forFeature([RsvpEntity, EventEntity])],
        // RsvpModule registers EventEntity here so RsvpService can inject
        // @InjectRepository(EventEntity) for the PUBLISHED guard in upsertRsvp().
        // TypeORM handles multiple forFeature() registrations of the same entity across
        // modules safely — each module gets its own repository token.
        // EventsModule also registers EventEntity independently; no circular dependency
        // exists (RsvpModule → TypeOrmModule only).
        providers: [RsvpService],
        exports: [RsvpService],
      })
      export class RsvpModule {}
    - No controllers in RsvpModule (write routes in EventsModule, read in MeModule per D-01)

    After implementation, run the Wave 0 rsvp.service.spec.ts to verify GREEN.
  </action>
  <verify>
    <automated>pnpm test -- --testPathPattern="rsvp.service.spec" --verbose 2>&1 | tail -30</automated>
  </verify>
  <done>
    rsvp.service.spec.ts passes. RsvpService and RsvpModule exist. TypeScript compiles clean.
    upsertRsvp, cancelRsvp, listUserRsvps, countByEventAndState are all implemented and tested.
  </done>
</task>

<task type="tdd" tdd="true">
  <name>Task 4: Wave 2 — EventsRsvpController, MeController, extend EventsService</name>
  <files>
    src/events/events-rsvp.controller.ts,
    src/me/me.controller.ts,
    src/me/me.module.ts,
    src/events/events.service.ts
  </files>
  <behavior>
    EventsRsvpController:
    - POST /events/:id/rsvp returns 201 with RsvpResponseDto
    - DELETE /events/:id/rsvp returns 204 with no body
    - Both routes require authentication (no @Public() — JwtAuthGuard applies globally)

    MeController:
    - GET /me/rsvps returns 200 with PaginatedRsvpHistoryDto
    - Passes cursor and limit from @Query() to rsvpService.listUserRsvps()

    EventsService.findPublishedById() — extended:
    - Returns interestedCount and goingCount as integers in the DTO
    - Calls rsvpService.countByEventAndState() for each state
    - Uses Promise.all() for parallel execution
  </behavior>
  <action>
    src/events/events-rsvp.controller.ts:
    - @ApiTags('Events') @Controller('events') — registers at /api/v1/events (same prefix as
      PublicEventsController, which is fine in NestJS — multiple controllers can share a prefix)
    - No class-level @Public() and no class-level @UseGuards — JWT guard applies globally
    - Constructor: constructor(private readonly rsvpService: RsvpService)
    - @Post(':id/rsvp')
      @HttpCode(HttpStatus.CREATED)
      @ApiBearerAuth()
      @ApiOperation({ summary: 'RSVP to a published event (upsert — second call updates state)' })
      @ApiResponse({ status: 201, type: RsvpResponseDto })
      @ApiResponse({ status: 404, description: 'Event not found' })
      @ApiResponse({ status: 422, description: 'Event is not published' })
      upsertRsvp(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') eventId: string,
        @Body() dto: CreateRsvpDto,
      ): Promise<RsvpResponseDto>
      return this.rsvpService.upsertRsvp(user.id, eventId, dto)
    - @Delete(':id/rsvp')
      @HttpCode(HttpStatus.NO_CONTENT)
      @ApiBearerAuth()
      @ApiOperation({ summary: 'Cancel RSVP (sets state to CANCELLED, row preserved)' })
      @ApiResponse({ status: 204 })
      @ApiResponse({ status: 404, description: 'RSVP not found' })
      cancelRsvp(
        @CurrentUser() user: AuthenticatedUser,
        @Param('id') eventId: string,
      ): Promise<void>
      return this.rsvpService.cancelRsvp(user.id, eventId)

    src/me/me.controller.ts:
    - @ApiTags('Me') @Controller('me') — registers at /api/v1/me
    - Constructor: constructor(private readonly rsvpService: RsvpService)
    - @Get('rsvps')
      @ApiBearerAuth()
      @ApiOperation({ summary: "Get the authenticated user's RSVP history (excludes cancelled)" })
      @ApiResponse({ status: 200, type: PaginatedRsvpHistoryDto })
      listRsvps(
        @CurrentUser() user: AuthenticatedUser,
        @Query() query: RsvpHistoryQueryDto,
      ): Promise<PaginatedRsvpHistoryDto>
      return this.rsvpService.listUserRsvps(user.id, query)

    src/me/me.module.ts:
    - @Module({ imports: [RsvpModule], controllers: [MeController] })
      export class MeModule {}
    - No providers (MeController gets RsvpService via RsvpModule import)

    src/events/events.service.ts — extend findPublishedById():
    - Add RsvpService to constructor: constructor(...existing..., private readonly rsvpService: RsvpService)
    - Replace findPublishedById body:
      const [event, interestedCount, goingCount] = await Promise.all([
        this.findPublishedOrThrow(id),
        this.rsvpService.countByEventAndState(id, RsvpState.INTERESTED),
        this.rsvpService.countByEventAndState(id, RsvpState.GOING),
      ]);
      return this.toPublicDetailDto(event, interestedCount, goingCount);
    - Update toPublicDetailDto() signature: toPublicDetailDto(event: EventEntity, interestedCount = 0,
      goingCount = 0): PublicEventDetailDto — add interestedCount and goingCount to the returned DTO
    - Import RsvpService from '../rsvp/rsvp.service' and RsvpState from '../rsvp/rsvp.entity'

    After implementation, run all three Wave 0 spec files to confirm GREEN.
  </action>
  <verify>
    <automated>pnpm test -- --testPathPattern="events-rsvp.controller.spec|me.controller.spec|events.service.spec" --verbose 2>&1 | tail -40</automated>
  </verify>
  <done>
    events-rsvp.controller.spec.ts, me.controller.spec.ts, and the new findPublishedById tests in
    events.service.spec.ts all pass. TypeScript compiles clean. Four files created/modified.
  </done>
</task>

---

## Wave 3 — Integration and Wiring

**Goal:** Wire all modules into the NestJS dependency graph, run the migration, and verify the full test suite.

<task type="auto">
  <name>Task 5: Wave 3 — Module wiring and AppModule registration</name>
  <files>
    src/events/events.module.ts,
    src/app.module.ts
  </files>
  <action>
    src/events/events.module.ts — add RsvpModule and EventsRsvpController:
    - Add import: import { RsvpModule } from '../rsvp/rsvp.module'
    - Add import: import { EventsRsvpController } from './events-rsvp.controller'
    - In @Module imports array: add RsvpModule after OrganizersModule
    - In @Module controllers array: add EventsRsvpController
    - Result:
      @Module({
        imports: [TypeOrmModule.forFeature([EventEntity, EventTranslationEntity]),
                  OrganizersModule, RsvpModule],
        providers: [EventsService],
        controllers: [EventsController, PublicEventsController, EventsRsvpController],
      })
    - NOTE: RsvpModule is imported here so EventsService can inject RsvpService (for RSVP-03 counts)
      AND so EventsRsvpController can receive RsvpService. RsvpModule exports RsvpService.
    - NOTE: EventEntity is registered in TypeOrmModule.forFeature twice (here and in RsvpModule).
      TypeORM handles this correctly — multiple forFeature() calls for the same entity in different
      modules are safe; each module gets its own repository token.

    src/app.module.ts — add RsvpEntity and MeModule:
    - Add import: import { RsvpEntity } from './rsvp/rsvp.entity'
    - Add import: import { MeModule } from './me/me.module'
    - In TypeOrmModule entities array: add RsvpEntity after EventTranslationEntity
    - In AppModule imports array: add MeModule after EventsModule
    - RsvpModule does NOT need to be in AppModule.imports — it is transitively loaded by
      EventsModule (and MeModule). AppModule only imports top-level feature modules.
    - Add comment: "MeModule — registers /api/v1/me/rsvps endpoint"

    After wiring, verify the application compiles and module graph resolves:
    pnpm build 2>&1 | grep -v "node_modules" | tail -20

    Then run the full migration to create the rsvps table:
    pnpm migration:run

    Then run the complete test suite:
    pnpm test
  </action>
  <verify>
    <automated>pnpm build 2>&1 | grep -E "error TS|Error:" | grep -v node_modules | head -20 && pnpm test --passWithNoTests 2>&1 | tail -20</automated>
  </verify>
  <done>
    EventsModule imports RsvpModule and registers EventsRsvpController. AppModule imports MeModule
    and registers RsvpEntity. Build passes. All spec files pass (green). Migration runs successfully
    — rsvps table exists with unique constraint, FK constraints, and both indexes.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 6: Wave 3 — Human verification of RSVP endpoints</name>
  <what-built>
    Full RSVP feature: POST /events/:id/rsvp, DELETE /events/:id/rsvp, GET /me/rsvps,
    and interestedCount/goingCount on GET /events/:id
  </what-built>
  <how-to-verify>
    Prerequisites: API running locally (`pnpm start:dev`), valid Auth0 JWT for a test user,
    at least one PUBLISHED event in the database.

    1. RSVP-01 — Upsert semantics:
       POST /api/v1/events/{eventId}/rsvp with Authorization header and body { "state": "INTERESTED" }
       Expected: 201 with { id, state: "INTERESTED", rsvpedAt }

       POST the same endpoint again with body { "state": "GOING" }
       Expected: 201 with same id, state: "GOING", same rsvpedAt (timestamp NOT updated on state change)

    2. RSVP-03 — Counts on event detail:
       GET /api/v1/events/{eventId} (no auth needed)
       Expected: response includes "interestedCount": 0, "goingCount": 1 (after the GOING RSVP above)

    3. RSVP-04 — History:
       GET /api/v1/me/rsvps with Authorization header
       Expected: 200 with { data: [{ rsvpState, rsvpedAt, event: { id, title, startAt, city, imageUrl } }],
       nextCursor: null, hasMore: false }

    4. RSVP-02 — Cancel:
       DELETE /api/v1/events/{eventId}/rsvp with Authorization header
       Expected: 204 No Content

       GET /api/v1/me/rsvps again
       Expected: empty data array (cancelled RSVP filtered out)

       GET /api/v1/events/{eventId} again
       Expected: interestedCount: 0, goingCount: 0

    5. Re-RSVP after cancel (D-06):
       POST /api/v1/events/{eventId}/rsvp with body { "state": "INTERESTED" }
       Expected: 201, same row id as original RSVP (upsert, not new row)

    6. Guard on non-PUBLISHED event:
       POST /api/v1/events/{draftEventId}/rsvp
       Expected: 422 Unprocessable Entity (or 404 if event not found)

    7. Swagger:
       Visit http://localhost:3000/api/docs
       Expected: RSVP endpoints visible under "Events" and "Me" tags with correct request/response schemas
  </how-to-verify>
  <resume-signal>Type "approved" when all checks pass, or describe which checks failed</resume-signal>
</task>

---

## Verification Checklist

| Requirement | Done when |
|-------------|-----------|
| RSVP-01 | POST /events/:id/rsvp with INTERESTED or GOING returns 201; second POST to same event returns 201 with updated state and unchanged rsvpedAt; DB has exactly one row per (userId, eventId) pair |
| RSVP-02 | DELETE /events/:id/rsvp returns 204; subsequent GET /me/rsvps does not include that event; re-POST restores state via upsert |
| RSVP-03 | GET /events/:id returns interestedCount and goingCount as integer fields reflecting live DB counts |
| RSVP-04 | GET /me/rsvps returns { data, nextCursor, hasMore } with non-cancelled RSVPs ordered by rsvpedAt DESC; cursor pagination navigates correctly |

---

## Source Audit

| Source | Item | Covered by | Status |
|--------|------|------------|--------|
| GOAL | Authenticated two-state RSVP, upsert semantics | Task 3 (RsvpService.upsertRsvp), Task 4 (EventsRsvpController) | COVERED |
| GOAL | Cancel RSVP | Task 3 (RsvpService.cancelRsvp), Task 4 (EventsRsvpController.DELETE) | COVERED |
| GOAL | Aggregated counts on events | Task 4 (EventsService.findPublishedById + RsvpService.countByEventAndState) | COVERED |
| GOAL | Personal RSVP history | Task 3 (RsvpService.listUserRsvps), Task 4 (MeController) | COVERED |
| REQ RSVP-01 | Upsert semantics, no duplicate rows | Task 3 upsertRsvp() via orUpdate() | COVERED |
| REQ RSVP-02 | Cancel RSVP | Task 3 cancelRsvp(), logical state = CANCELLED | COVERED |
| REQ RSVP-03 | interestedCount + goingCount on event detail | Task 4 EventsService extension | COVERED |
| REQ RSVP-04 | Paginated RSVP history, non-cancelled only | Task 3 listUserRsvps(), Task 4 MeController | COVERED |
| RESEARCH | orUpdate() upsert preserving rsvpedAt | Task 3 action (explicit orUpdate columns list) | COVERED |
| RESEARCH | enumName: 'rsvp_state' required | Task 2 RsvpEntity column definition | COVERED |
| RESEARCH | Cursor direction: < for DESC sort | Task 3 listUserRsvps() cursor WHERE clause | COVERED |
| RESEARCH | New EventsRsvpController (PublicEventsController is @Public()) | Task 4 events-rsvp.controller.ts | COVERED |
| RESEARCH | Promise.all() for parallel counts in findPublishedById | Task 4 EventsService extension | COVERED |
| CONTEXT D-01 | Write endpoints in events module, read in MeModule | Task 4 + Task 5 module wiring | COVERED |
| CONTEXT D-02 | RsvpService exported, imported by EventsModule + MeModule | Task 3 rsvp.module.ts exports, Task 5 wiring | COVERED |
| CONTEXT D-03 | Cancel = logical CANCELLED state, no physical delete | Task 3 cancelRsvp() | COVERED |
| CONTEXT D-04 | Single state enum: INTERESTED/GOING/CANCELLED | Task 2 RsvpEntity RsvpState enum | COVERED |
| CONTEXT D-05 | GET /me/rsvps filters WHERE state != CANCELLED | Task 3 listUserRsvps() QueryBuilder filter | COVERED |
| CONTEXT D-06 | Re-RSVP after cancel via upsert | Task 3 upsertRsvp() orUpdate() | COVERED |
| CONTEXT D-07 | Counts via live COUNT, no denormalized columns | Task 4 countByEventAndState() | COVERED |
| CONTEXT D-08 | PublicEventDetailDto gains interestedCount + goingCount | Task 2 DTO extension | COVERED |
| CONTEXT D-09 | Slim RSVP history shape | Task 2 RsvpHistoryItemDto | COVERED |
| CONTEXT D-10 | Cursor on (rsvpedAt DESC, rsvpId), limit 20/100 | Task 3 listUserRsvps() | COVERED |
| CONTEXT D-11 | RsvpHistoryItemDto + PaginatedRsvpHistoryDto | Task 2 | COVERED |

No deferred ideas included. No gaps detected.

---

<verification>
Full phase verification:
1. `pnpm tsc --noEmit` — zero TypeScript errors
2. `pnpm test` — all specs pass including new rsvp.service.spec.ts, events-rsvp.controller.spec.ts, me.controller.spec.ts, and extended events.service.spec.ts
3. `pnpm migration:run` — Rsvps1750000000000 migration applies cleanly
4. Manual endpoint checks per Task 6 checkpoint
5. Swagger at /api/docs shows RSVP endpoints with correct schemas
</verification>

<success_criteria>
- RsvpEntity table created via migration with enum, unique constraint, FK cascades, and two indexes
- POST /api/v1/events/:id/rsvp returns 201 with { id, state, rsvpedAt }; re-posting same event updates state without changing rsvpedAt or creating a duplicate row
- DELETE /api/v1/events/:id/rsvp returns 204; cancelled record excluded from history
- GET /api/v1/events/:id returns interestedCount and goingCount as integers
- GET /api/v1/me/rsvps returns paginated { data, nextCursor, hasMore } ordered by rsvpedAt DESC, excluding cancelled RSVPs
- All four requirements (RSVP-01 through RSVP-04) verified passing
- Full test suite passes with no regressions
</success_criteria>

<output>
Create `.planning/phases/08-rsvp/08-01-SUMMARY.md` when done
</output>
