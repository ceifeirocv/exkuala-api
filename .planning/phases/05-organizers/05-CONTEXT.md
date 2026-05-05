# Phase 5: Organizers - Context

**Gathered:** 2026-05-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the organizer application flow. Authenticated users apply to become organizers (name, description, email, optional website + social links). Admins approve or reject applications; rejections include optional notes stored in an audit table. Approved organizers have a public profile. State transitions are enforced in the service layer. Phase 5 includes a minimal admin list endpoint and a self-view endpoint (GET /organizers/me); full admin moderation belongs to Phase 9.

**In scope:**
- `OrganizerEntity` (id, userId FK unique, name, description, email, website, socialLinks JSONB, status enum, createdAt, updatedAt)
- `OrganizerAuditLogEntity` (id, organizerId FK, action enum [approved|rejected], note varchar nullable, createdAt)
- `POST /api/v1/organizers` — authenticated users submit application (name + description + email required; website + social optional)
- `PATCH /api/v1/admin/organizers/:id/approve` and `PATCH /api/v1/admin/organizers/:id/reject` — admin-only, optional note in body
- `GET /api/v1/organizers/:id` — public profile (approved organizers only; name, description, website, socialLinks — no email)
- `GET /api/v1/organizers/me` — authenticated user's own application (all fields including email + latest rejection note)
- `GET /api/v1/admin/organizers?status=pending|approved|rejected` — minimal admin list with status filter (no pagination required for Phase 5)
- `GET /api/v1/admin/organizers/:id/history` — admin-only audit log for one organizer
- State machine enforcement: pending → approved | rejected → pending. Approved is terminal.
- `@CurrentOrganizer()` decorator (mirrors `@CurrentUser()`) — resolves OrganizerEntity from request user, throws 403 if not found or not approved

**Out of scope:**
- `PATCH /organizers/me` (organizer profile self-update) — future phase
- M:M user↔organizer team membership — future phase
- suspended organizer state — Phase 9 candidate
- Full paginated GET /admin/organizers — ADMIN-01 in Phase 9
- Auth0 role sync on approval — ownership via DB lookup only
- Organizer profile images or rich media

</domain>

<decisions>
## Implementation Decisions

### Contact Info Fields

- **D-01:** Application fields: `name` (varchar, required), `description` (varchar, required), `email` (varchar, required), `website` (varchar, optional), `socialLinks` (JSONB, optional). Email is the business contact email — manually entered by the organizer, not auto-pulled from Auth0.
- **D-02:** `socialLinks` stored as a JSONB column with an open map: `{ "instagram": "https://...", "facebook": "..." }`. No platform allowlist — any key accepted. Flexible for new platforms without schema migration.
- **D-03:** Public `GET /organizers/:id` exposes: name, description, website, socialLinks. **Email is admin-only** — not returned in the public profile response.
- **D-04:** `GET /organizers/me` returns all fields including email and the latest rejection note (from audit log). Status is always included so the organizer knows where their application stands.

### Re-application Policy

- **D-05:** State machine: `pending → approved`, `pending → rejected`, `rejected → pending` (reapply). `approved` is terminal — no transitions out. Any invalid transition returns 409 Conflict with the current status and attempted transition in the error message.
- **D-06:** Reapplication (`rejected → pending`) overwrites the existing row in-place. One row per user. Application fields (name, description, etc.) are updated. Prior rejection history is preserved in the audit log, not in the organizer row itself.
- **D-07:** Approved organizer attempting to resubmit → 409 Conflict. Profile self-update (PATCH) deferred to a later phase.

### User↔Organizer Relation

- **D-08:** 1:1 relation for Phase 5. `OrganizerEntity` has a `userId` FK with a unique constraint → one organizer profile per user. Expand to M:M (organizer_members join table) in a future phase — migration is additive (remove unique constraint, add join table, seed from existing userId column).
- **D-09:** `EventEntity.organizerId` FK points to `OrganizerEntity.id`, not `UserEntity.id`. Events belong to the organizer profile, not the individual user identity. This is correct even under future M:M expansion.
- **D-10:** Ownership check at request time: JWT → auth0Id → `UserEntity.id` → `OrganizerEntity WHERE userId = :id AND status = 'approved'`. Source of truth is the DB. No Auth0 Management API calls, no role sync.
- **D-11:** `@CurrentOrganizer()` decorator (mirrors `@CurrentUser()`) resolves `OrganizerEntity` from the request context. Throws 403 if no organizer found for the current user or if status is not `approved`. Used on all organizer-only endpoints (Phase 6+ event CRUD).
- **D-12:** `GET /admin/organizers?status=` — minimal list endpoint in Phase 5 with a status filter query param. No pagination for Phase 5 (MVP volume is small). Full ADMIN-01 list (paginated, sortable) belongs to Phase 9.

### Admin Notes & Audit Trail

- **D-13:** Admin notes stored in a separate `organizer_audit_log` table, not in the `OrganizerEntity` row. Schema: `{ id (CUID2), organizerId (FK), action ('approved' | 'rejected'), note (varchar nullable), createdAt }`. No adminUserId column for Phase 5.
- **D-14:** `GET /admin/organizers/:id/history` — admin-only endpoint returns the full audit log for one organizer (all approval/rejection events, newest first).
- **D-15:** `GET /organizers/me` includes the **latest** rejection note from the audit log when status is `rejected`. This tells the organizer why they were rejected so they can fix it before reapplying. Approved organizers do not see audit log in their self-view.

### Claude's Discretion

- VarChar column lengths — follow SEC-01 pattern (SEC-01: explicit length on all string columns, DTOs mirror with `@MaxLength`). Suggested: name 200, description 2000, email 254, website 2048, note 2000.
- URL validation on website and social link values — planner decides whether to apply `@IsUrl()` at DTO level.
- Whether `GET /admin/organizers?status=` also supports no-filter (returns all statuses) or requires a status param.
- Exact error body shape for 409 Conflict on invalid state transitions.
- Whether `@CurrentOrganizer()` is a `createParamDecorator` or implemented as an interceptor — planner mirrors `@CurrentUser()` approach.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 5 goal, success criteria, plan stubs (ORG-01, ORG-02, ORG-03)
- `.planning/REQUIREMENTS.md` — ORG-01 (application), ORG-02 (admin approve/reject with notes), ORG-03 (public profile)
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar lengths + @MaxLength), curated organizer model

### Prior Phase Context
- `.planning/phases/04-categories/04-CONTEXT.md` — Entity patterns (CUID2 PK, VarChar lengths, TypeORM decorators, service+controller structure)
- `.planning/phases/03-users/03-CONTEXT.md` — @CurrentUser() decorator pattern to mirror for @CurrentOrganizer()

### Existing Code to Extend or Mirror
- `src/users/user.entity.ts` — CUID2 PK pattern (`@BeforeInsert` generateId), TypeORM decorator style
- `src/auth/decorators/current-user.decorator.ts` — Mirror for @CurrentOrganizer() implementation
- `src/auth/guards/roles.guard.ts` — @Roles('admin') enforcement pattern for admin endpoints
- `src/auth/decorators/public.decorator.ts` — @Public() for GET /organizers/:id (public profile)
- `src/events/event.entity.ts` — organizerId FK (varchar 30) — this phase defines what it points to (OrganizerEntity.id)
- `src/categories/categories.service.ts` — Service pattern: constructor injection, error handling (QueryFailedError → typed exception), Logger usage

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@paralleldrive/cuid2` — already installed; `createId()` for all new entity IDs
- `@Roles('admin')` decorator (`src/auth/decorators/roles.decorator.ts`) — use on all admin endpoints without modification
- `@Public()` decorator (`src/auth/decorators/public.decorator.ts`) — use on `GET /organizers/:id`
- `JwtAuthGuard` + `RolesGuard` globally registered — new controllers inherit guard chain automatically
- `@CurrentUser()` decorator (`src/auth/decorators/current-user.decorator.ts`) — mirror this for `@CurrentOrganizer()`

### Established Patterns
- CUID2 `@BeforeInsert` PK generation — copy from `UserEntity` or `CategoryEntity`
- `@Entity`, `@Column({ type: 'varchar', length: N })`, `@PrimaryColumn`, `@CreateDateColumn` — TypeORM decorator style
- Service constructor injection with `@InjectRepository` + named `Repository<T>` params
- `QueryFailedError` catch + code `'23505'` → HTTP 409 for unique constraint violations
- `@Column({ type: 'jsonb' })` — available in TypeORM for PostgreSQL JSONB columns
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation — project-standard TDD flow
- Controller spec: direct instantiation (no TestingModule); Service spec: TestingModule + getRepositoryToken

### Integration Points
- `src/app.module.ts` — Add `OrganizersModule` to `imports[]`
- New module: `src/organizers/` — `OrganizerEntity`, `OrganizerAuditLogEntity`, `OrganizersModule`, `OrganizersService`, `OrganizersController`
- `src/events/event.entity.ts` — `organizerId` FK is already defined; Phase 6 will add the TypeORM `@ManyToOne` relation pointing to `OrganizerEntity`. No change needed in Phase 5 to the event entity.
- New TypeORM migration: create `organizers` table + `organizer_audit_log` table

</code_context>

<specifics>
## Specific Ideas

- `socialLinks` response shape: return as-is from JSONB column — `{ "instagram": "https://...", "facebook": "..." }`. No transformation needed.
- `GET /organizers/me` response includes: all organizer fields + `{ latestRejectionNote: string | null }` derived from the most recent `rejected` audit log entry.
- State transition error: 409 with body `{ statusCode: 409, message: "Organizer is already [status] — transition to [target] is not allowed" }` (planner picks exact wording).
- Audit log `action` as a TypeScript enum: `OrganizerAuditAction.APPROVED = 'approved'`, `OrganizerAuditAction.REJECTED = 'rejected'`.

</specifics>

<deferred>
## Deferred Ideas

- `PATCH /organizers/me` (approved organizer profile self-update) — meaningful capability, but Phase 5 scope is application + approval only. Add in a future phase.
- M:M user↔organizer (team members) — `organizer_members(userId, organizerId, role)` join table. Migration path from 1:1 is clean (remove unique constraint, add join table, seed). Future phase.
- `suspended` organizer status — admin disables an approved organizer without removing them. Phase 9 candidate.
- Full paginated `GET /admin/organizers` (ADMIN-01) — Phase 9. Phase 5 includes only the minimal status-filter list.
- `adminUserId` column on audit log — track which admin approved/rejected. Future enhancement when admin accountability is needed.
- Auth0 role sync on approval (Management API call) — rejected in favor of DB lookup. Revisit only if Auth0-side role enforcement is needed.

</deferred>

---

*Phase: 05-organizers*
*Context gathered: 2026-05-05*
