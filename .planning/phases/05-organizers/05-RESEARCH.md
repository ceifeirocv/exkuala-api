# Phase 05: Organizers - Research

**Researched:** 2026-05-05
**Domain:** NestJS / TypeORM organizer application workflow, state machine enforcement, admin approval flow, audit logging
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Application fields: `name` (varchar, required), `description` (varchar, required), `email` (varchar, required), `website` (varchar, optional), `socialLinks` (JSONB, optional). Email is business contact email — manually entered by the organizer, not pulled from Auth0.
- **D-02:** `socialLinks` stored as JSONB with an open map: `{ "instagram": "https://...", "facebook": "..." }`. No platform allowlist — any key accepted.
- **D-03:** Public `GET /organizers/:id` exposes: name, description, website, socialLinks. **Email is admin-only** — not returned in the public profile response.
- **D-04:** `GET /organizers/me` returns all fields including email and the latest rejection note (from audit log). Status always included.
- **D-05:** State machine: `pending → approved`, `pending → rejected`, `rejected → pending` (reapply). `approved` is terminal. Invalid transitions → 409 Conflict with current status and attempted transition in error message.
- **D-06:** Reapplication (`rejected → pending`) overwrites the existing row in-place. One row per user. Application fields are updated. Prior rejection history is preserved in the audit log, not in the organizer row itself.
- **D-07:** Approved organizer attempting to resubmit → 409 Conflict. Profile self-update (PATCH) deferred to a later phase.
- **D-08:** 1:1 relation for Phase 5. `OrganizerEntity` has a `userId` FK with a unique constraint.
- **D-09:** `EventEntity.organizerId` FK points to `OrganizerEntity.id`, not `UserEntity.id`.
- **D-10:** Ownership check at request time: JWT → auth0Id → `UserEntity.id` → `OrganizerEntity WHERE userId = :id AND status = 'approved'`. Source of truth is the DB.
- **D-11:** `@CurrentOrganizer()` decorator mirrors `@CurrentUser()`. Throws 403 if no organizer found for the current user or if status is not `approved`.
- **D-12:** `GET /admin/organizers?status=` — minimal list endpoint in Phase 5 with status filter. No pagination for Phase 5.
- **D-13:** Admin notes stored in a separate `organizer_audit_log` table. Schema: `{ id (CUID2), organizerId (FK), action ('approved' | 'rejected'), note (varchar nullable), createdAt }`. No adminUserId column for Phase 5.
- **D-14:** `GET /admin/organizers/:id/history` — admin-only endpoint returns the full audit log for one organizer, newest first.
- **D-15:** `GET /organizers/me` includes the **latest** rejection note from the audit log when status is `rejected`. Approved organizers do not see audit log in their self-view.

### Claude's Discretion

- VarChar column lengths — follow SEC-01 pattern. Suggested: name 200, description 2000, email 254, website 2048, note 2000.
- URL validation on website and social link values — planner decides whether to apply `@IsUrl()` at DTO level.
- Whether `GET /admin/organizers?status=` also supports no-filter (returns all statuses) or requires a status param.
- Exact error body shape for 409 Conflict on invalid state transitions.
- Whether `@CurrentOrganizer()` is a `createParamDecorator` or implemented as an interceptor — planner mirrors `@CurrentUser()` approach.

### Deferred Ideas (OUT OF SCOPE)

- `PATCH /organizers/me` (approved organizer profile self-update) — future phase
- M:M user↔organizer (team members) — future phase
- `suspended` organizer status — Phase 9 candidate
- Full paginated `GET /admin/organizers` (ADMIN-01) — Phase 9
- `adminUserId` column on audit log — future enhancement
- Auth0 role sync on approval (Management API call) — rejected in favor of DB lookup
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| ORG-01 | Authenticated user can submit an organizer application (name, description, contact info) | POST /api/v1/organizers with CreateOrganizerDto; service enforces one-row-per-user and pending state at submission; CUID2 PK, JSONB for socialLinks |
| ORG-02 | Admin can approve or reject an organizer application with optional notes | PATCH /api/v1/admin/organizers/:id/approve and :id/reject; state machine enforcement in service; OrganizerAuditLogEntity insert on each decision |
| ORG-03 | Approved organizer has a public profile (name, bio, contact) | GET /api/v1/organizers/:id with @Public() decorator; status filter at service layer; email excluded from public response shape |
</phase_requirements>

---

## Summary

Phase 5 builds the organizer application and approval pipeline on top of the existing NestJS + TypeORM stack. Every pattern required here has a direct precedent in Phase 3 (users) and Phase 4 (categories): CUID2 PKs via `@BeforeInsert`, TypeORM `@Column` with explicit VarChar lengths, service-layer error handling with `QueryFailedError`, guard chain inheritance, and Wave-0 TDD RED stubs. No new libraries are needed.

The only genuinely new element is the state machine. The project is too small for a dedicated FSM library — the service method simply checks the current status and throws 409 if the attempted transition is not in the allowed set. This is a two-rule machine (`pending → approved|rejected`, `rejected → pending`; `approved` is terminal) and is best expressed with a plain `if`/`switch` block.

The second new element is the audit log entity. It is a separate table (`organizer_audit_log`) with a FK to `organizers`, inserted (never updated) on every approve/reject action. The self-view endpoint (`GET /organizers/me`) derives the latest rejection note by joining or querying this table sorted by `createdAt DESC LIMIT 1`.

**Primary recommendation:** Mirror the Phase 4 patterns exactly. New files: `OrganizerEntity`, `OrganizerAuditLogEntity`, `OrganizersService`, `OrganizersController`, `AdminOrganizersController`, `OrganizersModule`, one TypeORM migration, and DTOs for each endpoint. Export `OrganizersService` from `OrganizersModule` so Phase 6 can resolve the organizer for event ownership checks.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Submit organizer application | API / Backend | — | Auth-required write; owns state init |
| State machine enforcement | API / Backend | — | Business rule; must never run in client |
| Admin approve / reject | API / Backend | — | Role-gated mutation; audit insert must be atomic with status update |
| Public organizer profile | API / Backend | — | Simple DB read; @Public() bypasses JWT guard |
| Self-view (GET /organizers/me) | API / Backend | — | JWT-gated read + latest rejection note from audit log |
| Admin list / audit history | API / Backend | — | Role-gated read; no pagination in Phase 5 |
| @CurrentOrganizer() decorator | API / Backend | — | Request-scoped resolver; same tier as @CurrentUser() |
| Database persistence | Database / Storage | — | Two PostgreSQL tables with FK relation |

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@nestjs/common` | ^11.0.1 | Controllers, decorators, guards, exceptions | Already installed [VERIFIED: package.json] |
| `@nestjs/typeorm` | ^11.0.1 | TypeORM integration, `@InjectRepository` | Already installed [VERIFIED: package.json] |
| `typeorm` | (peer) | Entity/column decorators, migrations, `QueryFailedError` | Already installed [VERIFIED: package.json] |
| `@paralleldrive/cuid2` | ^3.3.0 | `createId()` for CUID2 PKs | Already installed; used by all entities [VERIFIED: package.json] |
| `class-validator` | ^0.14.1 | `@IsString`, `@IsEmail`, `@IsUrl`, `@MaxLength`, `@IsOptional` | Already installed [VERIFIED: package.json] |
| `class-transformer` | ^0.5.1 | `@Exclude`, `@Expose` for response shaping | Already installed [VERIFIED: package.json] |
| `@nestjs/swagger` | ^11.3.0 | `@ApiTags`, `@ApiBearerAuth`, `@ApiOperation`, `@ApiResponse`, `@ApiProperty` | Already installed; used by categories controller [VERIFIED: package.json] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `jest` | ^30.0.0 | Unit test runner | All `.spec.ts` files |
| `ts-jest` | ^29.2.5 | TypeScript test transform | Configured in `package.json` jest config |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Manual `if`/`switch` state machine | `xstate` or `typeorm-fsm` | Plain conditional is 5 lines; FSM lib adds dependency for 2 transitions |
| Separate audit table | Single `lastRejectionNote` on organizer row | Audit table preserves full history; rejected choice loses prior notes |
| `createParamDecorator` for `@CurrentOrganizer()` | NestJS interceptor | `createParamDecorator` is the established pattern here (`@CurrentUser()` uses it) |

**Installation:** No new packages needed for this phase.

---

## Architecture Patterns

### System Architecture Diagram

```
Incoming Request
      │
      ▼
JwtAuthGuard (global) ──── @Public() bypass ──► GET /organizers/:id
      │                                                  │
      ▼                                                  ▼
RolesGuard ────── @Roles('admin') ──► AdminOrganizersController
      │                                     │
      ▼                                     │
OrganizersController                        │
(authenticated routes)                      │
      │                                     │
      └──────────────┬──────────────────────┘
                     ▼
             OrganizersService
                     │
         ┌───────────┼───────────────┐
         ▼           ▼               ▼
  OrganizerRepo  AuditLogRepo   UserRepo (lookup)
         │           │
         ▼           ▼
  organizers    organizer_audit_log
   (PostgreSQL)    (PostgreSQL)
```

### Recommended Project Structure
```
src/
├── organizers/
│   ├── dto/
│   │   ├── create-organizer.dto.ts       # POST /organizers body
│   │   ├── approve-organizer.dto.ts      # PATCH /admin/organizers/:id/approve body
│   │   ├── reject-organizer.dto.ts       # PATCH /admin/organizers/:id/reject body
│   │   ├── organizer-public-response.dto.ts  # GET /organizers/:id shape (no email)
│   │   └── organizer-self-response.dto.ts    # GET /organizers/me shape (all fields + latestRejectionNote)
│   ├── organizer.entity.ts
│   ├── organizer-audit-log.entity.ts
│   ├── organizers.service.ts
│   ├── organizers.service.spec.ts
│   ├── organizers.controller.ts          # POST /organizers, GET /organizers/me, GET /organizers/:id
│   ├── organizers.controller.spec.ts
│   ├── admin-organizers.controller.ts    # all /admin/organizers/** routes
│   ├── admin-organizers.controller.spec.ts
│   └── organizers.module.ts
├── auth/
│   └── decorators/
│       └── current-organizer.decorator.ts  # new — mirrors current-user.decorator.ts
├── database/
│   └── migrations/
│       └── 1747000000000-organizers.ts     # new migration
```

### Pattern 1: CUID2 Entity (established pattern)
**What:** PrimaryColumn with `@BeforeInsert` generateId, matching all existing entities.
**When to use:** Every new entity in this project.
**Example:**
```typescript
// Source: src/users/user.entity.ts [VERIFIED: file read]
import { createId } from '@paralleldrive/cuid2';
import { BeforeInsert, PrimaryColumn } from 'typeorm';

@PrimaryColumn({ type: 'varchar', length: 30 })
id: string;

@BeforeInsert()
generateId() {
  if (!this.id) {
    this.id = createId();
  }
}
```

### Pattern 2: Status Enum Column (established pattern, new for organizer)
**What:** PostgreSQL native enum column via TypeORM `type: 'enum'`.
**When to use:** Status fields with a fixed domain (prevents invalid values at DB level).
**Example:**
```typescript
// Source: src/events/event.entity.ts [VERIFIED: file read]
export enum OrganizerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Column({
  type: 'enum',
  enum: OrganizerStatus,
  enumName: 'organizer_status',  // explicit name prevents TypeORM auto-name collisions
  default: OrganizerStatus.PENDING,
})
status: OrganizerStatus;
```

### Pattern 3: JSONB Column
**What:** TypeORM `type: 'jsonb'` for PostgreSQL JSON binary column. Stored as binary — supports GIN indexing, path queries.
**When to use:** Open-schema maps where keys are not known at schema design time (e.g., socialLinks).
**Example:**
```typescript
// Source: TypeORM docs [ASSUMED — JSONB column is standard TypeORM PostgreSQL usage]
@Column({ type: 'jsonb', nullable: true })
socialLinks: Record<string, string> | null;
```

### Pattern 4: State Machine Enforcement
**What:** Service method checks current status before applying transition. Throws `ConflictException` on invalid transition.
**When to use:** Any entity with a lifecycle requiring transition validation.
**Example:**
```typescript
// Source: derived from categories service pattern + D-05 decisions [VERIFIED: 05-CONTEXT.md]
private assertTransitionAllowed(current: OrganizerStatus, target: OrganizerStatus): void {
  const allowed: Partial<Record<OrganizerStatus, OrganizerStatus[]>> = {
    [OrganizerStatus.PENDING]: [OrganizerStatus.APPROVED, OrganizerStatus.REJECTED],
    [OrganizerStatus.REJECTED]: [OrganizerStatus.PENDING],
    // APPROVED has no allowed transitions — terminal
  };
  if (!allowed[current]?.includes(target)) {
    throw new ConflictException(
      `Organizer is already ${current} — transition to ${target} is not allowed`,
    );
  }
}
```

### Pattern 5: createParamDecorator for @CurrentOrganizer()
**What:** Mirrors `@CurrentUser()` — extracts a resolved entity from request context. Resolves `OrganizerEntity` by querying DB via `userId = req.user.id` and status = 'approved'. Throws 403 if not found.
**When to use:** On routes that require the caller to be an approved organizer.
**Example:**
```typescript
// Source: src/auth/decorators/current-user.decorator.ts [VERIFIED: file read]
// @CurrentOrganizer() follows the same createParamDecorator shape.
// The decorator itself cannot be async in the simple form; use an interceptor
// or resolve via an injected service in the decorator's factory.
// Preferred: inject OrganizersService into the decorator factory via APP_GUARD or
// use ExecutionContext to call a method that returns the organizer from a request-scoped cache.
```

NOTE: `createParamDecorator` does not support constructor injection. To resolve the organizer entity from the DB, the decorator must use `app.get(OrganizersService)` via the module reference, or attach the organizer to `req` in a guard/interceptor. See Pitfall 2 below.

### Pattern 6: Atomic Status + Audit Log Insert
**What:** In approve/reject service methods, update organizer status and insert audit log record in a single operation. TypeORM does not auto-wrap multiple `save()` calls in a transaction — use `dataSource.transaction()` or perform both writes sequentially (acceptable for Phase 5 given low volume).
**When to use:** Any action that must update status AND write an immutable audit record.
**Example:**
```typescript
// Source: TypeORM QueryRunner transaction pattern [ASSUMED — verify with TypeORM docs if atomicity is required]
async approveOrganizer(id: string, note?: string): Promise<void> {
  const organizer = await this.findOrganizerOrThrow(id);
  this.assertTransitionAllowed(organizer.status, OrganizerStatus.APPROVED);
  organizer.status = OrganizerStatus.APPROVED;
  await this.organizerRepository.save(organizer);
  const log = this.auditLogRepository.create({
    id: createId(),
    organizerId: id,
    action: OrganizerAuditAction.APPROVED,
    note: note ?? null,
  });
  await this.auditLogRepository.save(log);
}
```

### Pattern 7: Latest Rejection Note Query
**What:** For `GET /organizers/me`, query the most recent `rejected` audit log entry for the organizer.
**When to use:** Self-view response construction.
**Example:**
```typescript
// Source: TypeORM findOne with order + where [ASSUMED — standard TypeORM pattern]
const latestRejection = await this.auditLogRepository.findOne({
  where: { organizerId: organizer.id, action: OrganizerAuditAction.REJECTED },
  order: { createdAt: 'DESC' },
});
const latestRejectionNote = latestRejection?.note ?? null;
```

### Pattern 8: Route Order — /me before /:id
**What:** NestJS routes are matched in registration order. `/organizers/me` must be registered BEFORE `/organizers/:id` or the string `"me"` will be interpreted as an id param.
**When to use:** Any controller with both a named static route and a dynamic `:id` route sharing the same HTTP verb and path prefix.
**Example:**
```typescript
// Source: NestJS routing behavior [VERIFIED: standard NestJS behavior, matches route ordering rules]
@Get('me')   // must come before @Get(':id')
getMyProfile() { ... }

@Get(':id')
getPublicProfile() { ... }
```

### Pattern 9: Response Shape with Excluded Fields
**What:** Use manual mapping (build a plain response object) rather than `@Exclude()` class-transformer on the entity, to avoid global `ClassSerializerInterceptor` side effects across other controllers.
**When to use:** When a DTO must omit fields from the entity (e.g., email in public profile).
**Example:**
```typescript
// Source: derived from categories toResponseItem() pattern [VERIFIED: src/categories/categories.service.ts]
private toPublicResponse(org: OrganizerEntity): OrganizerPublicResponseDto {
  return {
    id: org.id,
    name: org.name,
    description: org.description,
    website: org.website,
    socialLinks: org.socialLinks,
  };
  // email intentionally excluded per D-03
}
```

### Anti-Patterns to Avoid
- **Using `synchronize: true` with the organizers entities:** App module already has `synchronize` off in non-dev envs. Do not add the organizer entities without also providing the migration file.
- **Forgetting the `enumName` on status column:** Without `enumName`, TypeORM generates a composite name that can collide with other enum columns, causing migration failures on PostgreSQL.
- **Placing `/me` after `/:id` in route registration:** NestJS will try to look up an organizer with id `"me"` instead of routing to the self-view handler.
- **Using `@BeforeInsert` for audit log id without pre-generating:** Audit log entities may be created via `repository.create()` and `save()` — the `@BeforeInsert` hook fires on `save()`, so id generation works. However, bulk insert via `repository.insert()` does NOT fire hooks. Use `createId()` explicitly at object construction time for audit log rows, matching the categories service pattern.
- **Not exporting OrganizersService from OrganizersModule:** Phase 6 will need `OrganizersService` to resolve organizer ownership for events. Export it now to avoid a module refactor in Phase 6.
- **Running the seeder with `ts-node` instead of `node dist/`:** Existing STATE.md decision — seeders run via `node dist/...seed.js`, not `ts-node`, when `AppDataSource.entities` uses a dist glob.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Input validation | Custom validation middleware | `class-validator` decorators on DTOs + `ValidationPipe` (global) | Already configured globally; handles `@IsEmail`, `@MaxLength`, `@IsUrl`, `@IsOptional` |
| Auth guard | Custom JWT parsing | `JwtAuthGuard` + `RolesGuard` (globally registered) | New controllers inherit the guard chain automatically — no `@UseGuards()` needed |
| Conflict detection on duplicate userId | Manual `findOne` before insert | Rely on PostgreSQL unique constraint on `userId` + catch `QueryFailedError` code `23505` | Matches established pattern in categories service |
| CUID2 generation | UUID v4 or nanoid | `createId()` from `@paralleldrive/cuid2` | Already installed; all entities use it |

**Key insight:** This phase adds zero new libraries. Every mechanism has a direct precedent in the existing codebase.

---

## Common Pitfalls

### Pitfall 1: Missing `enumName` on PostgreSQL Enum Column
**What goes wrong:** TypeORM generates a name like `organizers_status_enum`. If you later rename the column or table, the enum type name becomes stale. Worse, if another entity uses an un-named status enum, PostgreSQL may refuse to create a second anonymous enum type with the same generated name.
**Why it happens:** TypeORM auto-names enums from the table+column combination when `enumName` is omitted.
**How to avoid:** Always set `enumName: 'organizer_status'` (and `organizer_audit_action` for the audit log).
**Warning signs:** Migration error: `type "organizer_status_enum" already exists`.

### Pitfall 2: @CurrentOrganizer() Decorator Cannot Inject Services Directly
**What goes wrong:** `createParamDecorator` factories don't participate in NestJS DI — you cannot inject `OrganizersService` via constructor. Attempting to do so returns `undefined`.
**Why it happens:** `createParamDecorator` is a plain function, not a provider.
**How to avoid:** Two options:
  - **Option A (recommended — matches @CurrentUser() simplicity):** Attach the resolved `OrganizerEntity` to the `req` object in a guard or interceptor. The `@CurrentOrganizer()` decorator then reads `req.organizer`. This requires a new `OrganizerGuard` that runs after `JwtAuthGuard`.
  - **Option B:** Use `ModuleRef` hack with `app.get()` — fragile, not idiomatic NestJS.
  - Option A is preferred. The `OrganizerGuard` checks `req.user`, queries `OrganizersService.findApprovedByUserId()`, attaches result to `req`, and throws 403 on not-found. The decorator then extracts `req.organizer`.
**Warning signs:** `req.organizer` is `undefined` in the controller method parameter.

### Pitfall 3: Route Order — /me vs /:id
**What goes wrong:** `GET /organizers/me` resolves to `GET /organizers/:id` with `id = "me"`, triggering a DB lookup for a non-existent organizer and returning 404 instead of the authenticated user's profile.
**Why it happens:** NestJS route registration order determines precedence for same-method same-prefix routes.
**How to avoid:** Register `@Get('me')` before `@Get(':id')` in the controller class.
**Warning signs:** `GET /organizers/me` returns 404 with message `Organizer with id 'me' not found`.

### Pitfall 4: Status Filter — Optional vs Required Query Param
**What goes wrong:** If `GET /admin/organizers?status=` is called with no value (or with an invalid value like `status=all`), the service may throw an unexpected error or return zero results.
**Why it happens:** Undecided behavior — D-12 leaves this to planner discretion.
**How to avoid:** Validate with `@IsOptional()` + `@IsEnum(OrganizerStatus)` on the query DTO. When status param is absent, return all organizers (no filter). This is the most ergonomic choice for an admin list with no pagination.
**Warning signs:** `GET /admin/organizers` returns 400 when status param is omitted.

### Pitfall 5: Audit Log `createdAt` Missing `@CreateDateColumn`
**What goes wrong:** Audit log rows have `null` createdAt because the column is defined as a plain `@Column` instead of `@CreateDateColumn`.
**Why it happens:** Copy-paste from a non-timestamp entity.
**How to avoid:** Use `@CreateDateColumn()` on `createdAt` in `OrganizerAuditLogEntity`. No `@UpdateDateColumn` — audit log rows are immutable.
**Warning signs:** `GET /admin/organizers/:id/history` returns rows with `createdAt: null`.

### Pitfall 6: Not Adding OrganizerEntity to AppModule entities Array
**What goes wrong:** TypeORM does not know about the entity — queries throw `EntityMetadataNotFoundError`.
**Why it happens:** The `AppModule` `entities` array is explicit (not a glob) — confirmed by reading `app.module.ts`.
**How to avoid:** Add `OrganizerEntity` and `OrganizerAuditLogEntity` to the `entities` array in `app.module.ts` TypeOrmModule config.
**Warning signs:** `EntityMetadataNotFoundError: No metadata for "OrganizerEntity" was found.` at runtime.

---

## Code Examples

Verified patterns from existing source:

### OrganizerEntity skeleton
```typescript
// Source: mirrors src/users/user.entity.ts and src/events/event.entity.ts [VERIFIED: files read]
import { createId } from '@paralleldrive/cuid2';
import { BeforeInsert, Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export enum OrganizerStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('organizers')
export class OrganizerEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  userId: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ type: 'varchar', length: 2000 })
  description: string;

  @Column({ type: 'varchar', length: 254 })
  email: string;

  @Column({ type: 'varchar', length: 2048, nullable: true })
  website: string | null;

  @Column({ type: 'jsonb', nullable: true })
  socialLinks: Record<string, string> | null;

  @Column({
    type: 'enum',
    enum: OrganizerStatus,
    enumName: 'organizer_status',
    default: OrganizerStatus.PENDING,
  })
  status: OrganizerStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

### OrganizerAuditLogEntity skeleton
```typescript
// Source: D-13 decisions [VERIFIED: 05-CONTEXT.md]
export enum OrganizerAuditAction {
  APPROVED = 'approved',
  REJECTED = 'rejected',
}

@Entity('organizer_audit_log')
export class OrganizerAuditLogEntity {
  @PrimaryColumn({ type: 'varchar', length: 30 })
  id: string;

  @Column({ type: 'varchar', length: 30 })
  organizerId: string;

  @Column({
    type: 'enum',
    enum: OrganizerAuditAction,
    enumName: 'organizer_audit_action',
  })
  action: OrganizerAuditAction;

  @Column({ type: 'varchar', length: 2000, nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @BeforeInsert()
  generateId() {
    if (!this.id) {
      this.id = createId();
    }
  }
}
```

### Service constructor injection (established pattern)
```typescript
// Source: src/categories/categories.service.ts [VERIFIED: file read]
constructor(
  @InjectRepository(OrganizerEntity)
  private readonly organizerRepository: Repository<OrganizerEntity>,
  @InjectRepository(OrganizerAuditLogEntity)
  private readonly auditLogRepository: Repository<OrganizerAuditLogEntity>,
) {}
```

### Test pattern — service spec (established pattern)
```typescript
// Source: src/categories/categories.service.spec.ts [VERIFIED: file read]
const module: TestingModule = await Test.createTestingModule({
  providers: [
    OrganizersService,
    { provide: getRepositoryToken(OrganizerEntity), useValue: mockOrganizerRepository },
    { provide: getRepositoryToken(OrganizerAuditLogEntity), useValue: mockAuditLogRepository },
  ],
}).compile();
```

### Test pattern — controller spec (established pattern)
```typescript
// Source: src/categories/categories.controller.spec.ts [VERIFIED: file read]
// Direct instantiation, no TestingModule
controller = new OrganizersController(mockOrganizersService as unknown as OrganizersService);
```

### Migration skeleton
```typescript
// Source: src/database/migrations/1746000000000-categories.ts [VERIFIED: file read]
export class Organizers1747000000000 implements MigrationInterface {
  name = 'Organizers1747000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "organizer_status" AS ENUM ('pending', 'approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE TYPE "organizer_audit_action" AS ENUM ('approved', 'rejected')
    `);
    await queryRunner.query(`
      CREATE TABLE "organizers" (
        "id"          varchar(30)     NOT NULL,
        "userId"      varchar(30)     NOT NULL,
        "name"        varchar(200)    NOT NULL,
        "description" varchar(2000)   NOT NULL,
        "email"       varchar(254)    NOT NULL,
        "website"     varchar(2048)   NULL,
        "socialLinks" jsonb           NULL,
        "status"      "organizer_status" NOT NULL DEFAULT 'pending',
        "createdAt"   TIMESTAMPTZ     NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMPTZ     NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizers" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_organizers_userId" UNIQUE ("userId"),
        CONSTRAINT "FK_organizers_userId"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "organizer_audit_log" (
        "id"           varchar(30)            NOT NULL,
        "organizerId"  varchar(30)            NOT NULL,
        "action"       "organizer_audit_action" NOT NULL,
        "note"         varchar(2000)          NULL,
        "createdAt"    TIMESTAMPTZ            NOT NULL DEFAULT now(),
        CONSTRAINT "PK_organizer_audit_log" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_log_organizer"
          FOREIGN KEY ("organizerId") REFERENCES "organizers"("id") ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "organizer_audit_log"`);
    await queryRunner.query(`DROP TABLE "organizers"`);
    await queryRunner.query(`DROP TYPE "organizer_audit_action"`);
    await queryRunner.query(`DROP TYPE "organizer_status"`);
  }
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `synchronize: true` in TypeORM | Explicit migrations only | Established in Phase 1 | Migrations must be written for every schema change |
| Prisma | TypeORM | Phase 1.1 migration | TypeORM migration file pattern is the project standard |
| UUID v4 for PKs | CUID2 via `@paralleldrive/cuid2` | Established in Phase 1 | All entities use `createId()` + varchar(30) PK |

**Deprecated/outdated:**
- `synchronize: true` in production: never acceptable — project enforces this explicitly in AppModule.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@Column({ type: 'jsonb' })` works without additional TypeORM configuration for PostgreSQL | Standard Stack, Code Examples | Low — JSONB is a well-established TypeORM PostgreSQL column type; risk is minimal |
| A2 | TypeORM `QueryRunner.query()` with raw SQL for CREATE TYPE before CREATE TABLE is necessary when using native enum type | Code Examples (migration) | Medium — if TypeORM auto-creates the type from the column definition, the explicit CREATE TYPE statement would fail on second run. Planner should verify by running migration in dev and checking for duplicate type errors. Alternatively, use `varchar` with application-layer enum check and skip the CREATE TYPE entirely. |
| A3 | `@BeforeInsert` on `OrganizerAuditLogEntity` fires when using `repository.save()` | Code Examples | Low — `@BeforeInsert` fires on `save()`. Risk: if planner uses `repository.insert()` for audit log, hook won't fire. Mitigation: use `createId()` at object construction time explicitly (as categories service does). |
| A4 | `OrganizerGuard` (Option A for @CurrentOrganizer) is the cleanest approach | Pattern 5, Pitfall 2 | Medium — if the project prefers a different decorator resolution pattern, the guard approach adds one extra file. Low implementation risk, no correctness risk. |

---

## Open Questions

1. **Does `GET /admin/organizers?status=` support omitted status param?**
   - What we know: D-12 defers this to planner discretion.
   - What's unclear: Does an admin user want "show me everything" as a default, or is status filter always required?
   - Recommendation: Make status optional (`@IsOptional() @IsEnum(OrganizerStatus)`). When absent, return all organizers (all statuses). This is ergonomically simpler for admin workflows with small data volumes.

2. **Should `@IsUrl()` be applied to website and socialLinks values in DTOs?**
   - What we know: D-01 marks website as optional. D-02 marks socialLinks as an open map.
   - What's unclear: `@IsUrl()` on the website field is straightforward. Validating individual values inside `socialLinks` JSONB requires a custom validator or schema-level check.
   - Recommendation: Apply `@IsUrl({ require_protocol: true })` to the `website` DTO field. For `socialLinks` values, skip deep validation in Phase 5 — open map semantics (D-02) implies flexibility. Add a note in the DTO comment that URL format is not enforced on socialLinks values.

3. **Should approve/reject be atomic (transaction) or sequential saves?**
   - What we know: Phase 5 has low volume (MVP). TypeORM supports `dataSource.transaction()`.
   - What's unclear: What happens if the status save succeeds but the audit log save fails?
   - Recommendation: Use sequential saves for Phase 5 simplicity. If the audit log insert fails after the status update, the system is in an inconsistent state but this is recoverable (admin can re-reject to create the missing log entry). Add a TODO comment in the service method. Wrap in a transaction in a future phase if audit reliability becomes a requirement.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | NestJS runtime | ✓ | v24.15.0 | — |
| pnpm | Package manager | ✓ | 10.33.2 | — |
| PostgreSQL (psql CLI) | Migration runs | ✓ | 18.3 | — |
| `@paralleldrive/cuid2` | Entity PK generation | ✓ | ^3.3.0 | — |
| `class-validator` | DTO validation | ✓ | installed | — |
| `typeorm` | ORM + migrations | ✓ | installed | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `package.json` (jest key) |
| Quick run command | `pnpm test -- --testPathPattern=organizers` |
| Full suite command | `pnpm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| ORG-01 | Submit application creates pending organizer | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-01 | Duplicate userId returns 409 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-01 | Rejected organizer can reapply (rejected → pending) | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-01 | Approved organizer cannot reapply (409) | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-02 | Admin approve transitions pending → approved | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-02 | Admin reject transitions pending → rejected with note | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-02 | Audit log row inserted on approve/reject | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-02 | Invalid transition returns 409 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-03 | GET /organizers/:id returns public profile (no email) | unit | `pnpm test -- --testPathPattern=organizers.controller.spec` | ❌ Wave 0 |
| ORG-03 | GET /organizers/:id for pending/rejected organizer returns 404 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |
| ORG-03 | GET /organizers/me returns all fields + latestRejectionNote | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test -- --testPathPattern=organizers`
- **Per wave merge:** `pnpm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/organizers/organizers.service.spec.ts` — covers ORG-01, ORG-02, ORG-03 service layer
- [ ] `src/organizers/organizers.controller.spec.ts` — covers public routes (GET /organizers/:id, /organizers/me, POST /organizers)
- [ ] `src/organizers/admin-organizers.controller.spec.ts` — covers admin routes (PATCH approve/reject, GET list, GET history)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `JwtAuthGuard` (globally registered) — already enforced |
| V3 Session Management | no | Stateless JWT; no server-side sessions |
| V4 Access Control | yes | `RolesGuard` + `@Roles('admin')` on all admin endpoints; ownership check in OrganizersService for self-view |
| V5 Input Validation | yes | `class-validator` DTOs + global `ValidationPipe(whitelist: true, forbidNonWhitelisted: true)` |
| V6 Cryptography | no | No secrets or cryptographic operations in this phase |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated application submission | Spoofing | `JwtAuthGuard` global — POST /organizers requires valid JWT |
| Horizontal privilege escalation (user A submits for user B) | Tampering | `userId` derived from JWT (`req.user.id`), not from request body — users cannot spoof userId |
| Admin endpoint access without admin role | Elevation of Privilege | `@Roles('admin')` on `AdminOrganizersController`; `RolesGuard` enforces |
| Email field exposed in public profile | Information Disclosure | D-03 locks this: manual mapping in `toPublicResponse()` omits email field |
| Oversized input (description, note, socialLinks) | DoS / Tampering | `@MaxLength` on all string fields per SEC-01; JSONB column stores arbitrary size but validator limits |
| State machine bypass (client sends raw status value) | Tampering | DTOs for approve/reject do not accept a status field — admin endpoints call `approveOrganizer()` / `rejectOrganizer()` service methods, not a generic update |

---

## Sources

### Primary (HIGH confidence)
- `src/auth/decorators/current-user.decorator.ts` — @CurrentOrganizer() implementation pattern
- `src/categories/categories.service.ts` — service constructor injection, error handling, toResponseItem pattern
- `src/categories/categories.controller.ts` — controller structure, @Roles, @Public, Swagger decorators
- `src/categories/categories.service.spec.ts` — service spec pattern (TestingModule + getRepositoryToken)
- `src/categories/categories.controller.spec.ts` — controller spec pattern (direct instantiation)
- `src/users/user.entity.ts` — CUID2 PK pattern
- `src/events/event.entity.ts` — enum column pattern, entity structure
- `src/auth/guards/roles.guard.ts` — RolesGuard behavior (isPublic bypass, role check)
- `src/app.module.ts` — entity registration, TypeORM config, module imports array
- `src/database/migrations/1746000000000-categories.ts` — migration file structure
- `.planning/phases/05-organizers/05-CONTEXT.md` — all locked decisions
- `package.json` — installed packages, test/migration scripts, Jest config

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md` — ORG-01, ORG-02, ORG-03 requirement text
- `.planning/STATE.md` — seeder must use `node dist/` not `ts-node` (verified accumulated decision)

### Tertiary (LOW confidence)
- None — all critical claims verified from codebase or CONTEXT.md

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified in package.json
- Architecture patterns: HIGH — all patterns verified from existing codebase files
- Pitfalls: HIGH — route ordering and decorator injection are well-documented NestJS behavior; entity registration and enum naming verified from existing migration
- State machine: HIGH — design verified from CONTEXT.md D-05/D-06/D-07

**Research date:** 2026-05-05
**Valid until:** 2026-06-05 (stable stack, no fast-moving dependencies)
