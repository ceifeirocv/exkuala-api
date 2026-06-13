# Phase 9: Admin Moderation - Context

**Gathered:** 2026-06-13
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver admin oversight and moderation. Admins get full visibility into organizer applications and all events (drafts, published, suspended, cancelled — regardless of ownership) and can take corrective action: suspending/restoring events and removing them from public view. A new `SUSPENDED` event state and an `event_audit_log` table are introduced. The organizer admin endpoints built in Phase 5 are extended (pagination) and reused (approve/reject/history), not rebuilt.

**In scope:**
- New `EventStatus.SUSPENDED` enum value + migration (column already exists; enum extended)
- Admin event moderation:
  - `GET /api/v1/admin/events` — list ALL events (any owner, any status incl. SUSPENDED), cursor-paginated, full entity; filters `?status=` and `?organizerId=`; soft-deleted excluded unless `?includeDeleted=true`
  - Admin suspend: `PUBLISHED|DRAFT → SUSPENDED` (admin-only; remembers prior status for restore)
  - Admin restore: `SUSPENDED → <prior status>`
  - Admin remove: soft-delete (`deletedAt`) on any event, any status, any owner
- `event_audit_log` table (mirrors `organizer_audit_log`): `id`, `eventId` FK, `action` enum [`suspended` | `restored` | `removed`], `note` (varchar nullable), `adminUserId` (FK → users.id), `createdAt`
- Organizer admin extension:
  - Add cursor pagination to existing `GET /api/v1/admin/organizers` (reuse Phase 6/7 pagination shape)
  - Add `adminUserId` column to `organizer_audit_log`; approve/reject record acting admin
- Admin controllers live in their feature modules: new `admin-events.controller.ts` in `src/events/`; `admin-organizers.controller.ts` stays in `src/organizers/`

**Out of scope:**
- Approve/reject endpoints themselves (already shipped Phase 5 — reused as-is, only audit gains `adminUserId`)
- Full-text search on admin lists (verges on new capability — deferred)
- `suspended` *organizer* status (admin disabling an approved organizer) — Phase 5 deferred candidate, NOT in Phase 9 success criteria; deferred
- Hard delete (EVT-05 mandates soft delete)
- Admin dashboard UI / aggregate metrics — API-only phase
- Organizer self-transition out of SUSPENDED — admin-only by design
</domain>

<decisions>
## Implementation Decisions

### Event Moderation State Machine

- **D-01:** Add `EventStatus.SUSPENDED`. Admin-only state — organizers cannot transition into or out of it. Organizer PATCH on a SUSPENDED event returns 409 (frozen, same treatment as CANCELLED in Phase 6 D-05).
- **D-02:** Admin can suspend from any active state: `DRAFT → SUSPENDED` and `PUBLISHED → SUSPENDED`. Restore (`SUSPENDED → <prior>`) returns the event to the status it held before suspension. This requires remembering the pre-suspend status — planner adds a `statusBeforeSuspension` (or equivalent) column / mechanism on the event row.
- **D-03:** Admin restore is reversible and admin-only: `SUSPENDED → DRAFT` or `SUSPENDED → PUBLISHED` depending on prior status.
- **D-04:** Admin "remove" (EVT-03/ADMIN-04) = soft-delete via `repository.softDelete` (sets `deletedAt`), allowed regardless of status or ownership. Reuses existing soft-delete already on `EventEntity` (Phase 6). Removed events disappear from public and organizer lists but remain in DB and admin view (`?includeDeleted=true`).
- **D-05:** The organizer-facing EventsService state machine (`ALLOWED_TRANSITIONS`, `assertTransitionAllowed`) stays clean — admin transitions are a distinct admin code path, not a bypass flag injected into the organizer flow (honors Phase 6 D-08). Planner decides whether this is a separate admin method on EventsService or a dedicated admin service.

### Admin Event List (ADMIN-02)

- **D-06:** `GET /api/v1/admin/events` reuses the Phase 6/7 cursor pagination contract (`PaginatedEventsResponseDto` shape: `{ data, nextCursor, hasMore }`, cursor on `(startAt, id)`). No new pagination pattern.
- **D-07:** Filters: `?status=` (accepts SUSPENDED and all other statuses), `?organizerId=`. No filter → all events across all organizers.
- **D-08:** Returns the **full `EventEntity`** (all fields incl. status, draft-only fields, organizerId, timestamps) — NOT a public DTO. Follows Phase 5 lesson: admin list endpoints need full entity; public DTOs strip moderation-relevant fields.
- **D-09:** Soft-deleted events are excluded by default; `?includeDeleted=true` uses TypeORM `withDeleted()` to include them (with `deletedAt` visible).

### Organizer Admin Reuse (ADMIN-01 / ADMIN-03)

- **D-10:** ADMIN-01: upgrade the existing `GET /api/v1/admin/organizers` (Phase 5, unpaginated, status-filtered) to cursor pagination, consistent with the new admin event list. Keep the `?status=` filter behavior (returns all statuses when omitted).
- **D-11:** ADMIN-03: approve/reject endpoints (`PATCH /admin/organizers/:id/approve|reject`) and `/history` are already fully built in Phase 5 — reused as-is. Phase 9 does not rebuild them.
- **D-12:** Add `adminUserId` column to `organizer_audit_log` (deferred in Phase 5 D-13). Approve/reject now record which admin acted. Migration adds the column; approve/reject service methods accept the acting admin id.

### Audit Trail (event moderation)

- **D-13:** New `event_audit_log` table mirroring `organizer_audit_log`: `{ id (CUID2), eventId (FK), action (enum: suspended | restored | removed), note (varchar nullable), adminUserId (FK → users.id), createdAt }`. Every admin event action writes one row. Consistent audit story across both moderation surfaces.
- **D-14:** Admin moderation actions accept an optional `note`/reason in the request body, persisted in the audit row.

### Module & Controller Placement

- **D-15:** Admin controllers live in their feature modules: new `src/events/admin-events.controller.ts` (mirrors `src/organizers/admin-organizers.controller.ts`). No dedicated `src/admin/` module — the roadmap's "AdminModule" is a logical grouping, not a literal NestJS module. Avoids cross-module service coupling.
- **D-16:** `@Roles('admin')` (global RolesGuard) gates every admin endpoint — same pattern as `AdminOrganizersController`. Routes registered under `admin/events` and `admin/organizers` (global prefix + URI versioning → `/api/v1/admin/...`).

### Claude's Discretion

- Exact column name/mechanism for remembering pre-suspend status (`statusBeforeSuspension` column vs. deriving from audit log). Planner decides; column is simplest.
- Whether admin event transitions live as new methods on `EventsService` or a separate `AdminEventsService` — keep the organizer state machine untouched either way (D-05).
- Resolving `adminUserId`: mirror `@CurrentUser()` (`src/auth/decorators/current-user.decorator.ts`) → `UserEntity.id`.
- Exact action verbs and HTTP verbs/paths for suspend/restore/remove (e.g., `PATCH /admin/events/:id/suspend`, `/restore`, `DELETE /admin/events/:id`) — planner picks, consistent with existing admin-organizers verb style.
- 409 error body shape for invalid admin transitions — mirror Phase 6 `assertTransitionAllowed` message format.
- VarChar lengths on new columns (`note`, etc.) — follow SEC-01 (note 2000, mirroring organizer audit).
- Index strategy on `event_audit_log` (e.g., `eventId`, `createdAt`).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 9 goal, success criteria, plan stubs (09-01 organizer, 09-02 events)
- `.planning/REQUIREMENTS.md` — EVT-03 (admin unpublish/remove), ADMIN-01 (list organizers by status), ADMIN-02 (list all events incl. drafts), ADMIN-03 (approve/reject — done Phase 5), ADMIN-04 (unpublish/remove events), EVT-05 (soft delete mandatory)
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar lengths + @MaxLength), admin role in curated model

### Prior Phase Context
- `.planning/phases/05-organizers/05-CONTEXT.md` — D-13/D-14 (organizer_audit_log schema + /history), D-12 (minimal admin list, pagination deferred to Phase 9), approve/reject design; `suspended` organizer status noted as Phase 9 candidate (deferred here)
- `.planning/phases/06-organizer-event-crud/06-CONTEXT.md` — D-02–D-08 (event status machine, `assertTransitionAllowed`), D-08 (no admin bypass — Phase 9 owns override), D-15 (soft-delete), D-17/D-18 (cursor pagination contract to reuse)
- `.planning/phases/07-public-event-discovery/07-CONTEXT.md` — public event DTOs and pagination response shape

### Existing Code to Extend or Mirror
- `src/organizers/admin-organizers.controller.ts` — DIRECT template for `admin-events.controller.ts`; this controller gets cursor pagination added (D-10)
- `src/organizers/organizers.service.ts` — `findByStatus`, `approve`/`reject`, `findAuditHistory`, `assertTransitionAllowed` state-machine pattern; approve/reject gain `adminUserId` (D-12)
- `src/organizers/organizer-audit-log.entity.ts` — DIRECT template for `event_audit_log` entity; also gains `adminUserId` column
- `src/events/events.service.ts` — `ALLOWED_TRANSITIONS`, `assertTransitionAllowed`, `findOwned` (cursor pagination impl), `softDelete` usage; admin code path added without altering organizer machine (D-05)
- `src/events/event.entity.ts` — `EventStatus` enum (add SUSPENDED), existing `@DeleteDateColumn` soft-delete
- `src/events/events.module.ts` — register `admin-events.controller.ts`; EventsService already injects OrganizersModule + RsvpModule
- `src/events/dto/paginated-events-response.dto.ts` — cursor pagination response DTO to reuse for admin list
- `src/auth/decorators/roles.decorator.ts` + `src/auth/guards/roles.guard.ts` — `@Roles('admin')` gating (global guard)
- `src/auth/decorators/current-user.decorator.ts` — resolve acting `adminUserId` for audit rows
- `src/users/user.entity.ts` — CUID2 `@BeforeInsert` PK pattern for `event_audit_log`; FK target for `adminUserId`

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `AdminOrganizersController` — near-complete template for admin event controller (`@ApiTags`, `@ApiBearerAuth`, `@Roles('admin')` per route, status-filter query)
- `OrganizerAuditLogEntity` — copy-and-adapt for `EventAuditLogEntity`
- Cursor pagination already implemented in `EventsService.findOwned` (Phase 6 D-17/D-18) — same keyset logic reused for both admin lists
- `repository.softDelete(id)` + `withDeleted()` — soft-delete and include-deleted already available on EventEntity
- `@Roles('admin')` + global `RolesGuard` — admin gating with zero new guard code
- `@paralleldrive/cuid2` `createId()` (`@BeforeInsert`) — PK generation for new audit table

### Established Patterns
- Admin list endpoints return full entity, not public DTO (Phase 5 lesson) — avoids stripping moderation fields
- Entities used as Swagger response types need `@ApiProperty` on every field (Phase 5 lesson) — apply to `EventAuditLogEntity`
- State machine: `ALLOWED_TRANSITIONS` map + `assertTransitionAllowed` throwing 409 — admin transitions follow the same shape in a separate code path
- Soft-delete auto-excludes rows from `find()` unless `withDeleted()` — drives the `?includeDeleted=` default
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation
- Controller spec: direct instantiation; Service spec: TestingModule + getRepositoryToken
- Manual DTO mapping, no ClassSerializerInterceptor — but admin list returns full entity directly
- Migration column naming: add `name: 'snake_case'` to `@Column` matching the migration to avoid TypeORM creating duplicate camelCase columns (Phase 07 lesson)

### Integration Points
- `src/events/events.module.ts` — add `EventAuditLogEntity` to `TypeOrmModule.forFeature([...])`; register `AdminEventsController`
- `src/organizers/organizers.module.ts` — `OrganizerAuditLogEntity` already registered; service/controller gain `adminUserId` wiring
- New TypeORM migration(s): (1) add SUSPENDED to event status check/enum + pre-suspend-status column; (2) create `event_audit_log` table; (3) add `adminUserId` to `organizer_audit_log`
- `event_audit_log.adminUserId` + `organizer_audit_log.adminUserId` → FK to `users.id`
- Beware TypeORM `synchronize`/Neon constraint drift on enum + new table (see memory: typeorm-synchronize-constraint-drift) — verify migrations run cleanly against Neon

</code_context>

<specifics>
## Specific Ideas

- `EventAuditAction` TypeScript enum: `SUSPENDED = 'suspended'`, `RESTORED = 'restored'`, `REMOVED = 'removed'` (mirrors `OrganizerAuditAction`).
- Admin event list response = `PaginatedEventsResponseDto` carrying full `EventEntity` items (not the trimmed public list item DTO).
- Restore returns event to `statusBeforeSuspension`; if that field is null/absent, planner defaults to DRAFT (safe non-public state).
- Admin verb style to mirror Phase 5: `PATCH /admin/events/:id/suspend`, `PATCH /admin/events/:id/restore`, `DELETE /admin/events/:id` (remove), `GET /admin/events/:id/history` (audit log, optional — newest first like organizer history).

</specifics>

<deferred>
## Deferred Ideas

- `suspended` *organizer* status (admin disables an approved organizer) — Phase 5 deferred candidate; not in Phase 9 success criteria. Future phase.
- Full-text search on admin organizer/event lists — verges on new capability; not in scope.
- Admin dashboard aggregate metrics (counts by status, etc.) — future / v2.
- `PATCH /organizers/me` organizer self-update — still deferred (Phase 5/6).
- M:M user↔organizer team membership — future phase.
- Notifications to organizer when their event is suspended/removed — v2 (push notifications deferred).

None of the above were folded into Phase 9.

</deferred>

---

*Phase: 09-admin-moderation*
*Context gathered: 2026-06-13*
