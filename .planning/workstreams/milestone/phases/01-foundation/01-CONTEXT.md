# Phase 1: Foundation - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a production-quality infrastructure baseline: PostgreSQL connected via Prisma, environment variables validated at startup, global request validation active, API URI-versioned under `/api/v1/`, and Swagger UI accessible at `/api/docs`. All 9 phases depend on this foundation.

</domain>

<decisions>
## Implementation Decisions

### Schema Baseline

- **D-01:** Bootstrap with **User + Event models only** in Phase 1 migration. Organizer and Category models added in their respective phases (Phase 4, Phase 5).
- **D-02:** **Event model: full schema now** — include all known fields to avoid disruptive ALTER TABLE migrations mid-build:
  - `id`, `title`, `description`, `startAt`, `endAt`, `location` (venue + address), `categoryId` (nullable FK placeholder), `ticketPrice`, `externalTicketUrl`, `status` (enum: DRAFT | PUBLISHED | CANCELLED), `organizerId` (nullable FK placeholder), `deletedAt` (soft delete — MUST be present from day one), `createdAt`, `updatedAt`
- **D-03:** **User model: minimal in Phase 1** — `id`, `auth0Id` (unique), `createdAt`, `updatedAt` only. Additional fields (email, name, role enum) added in Phase 3 when user sync is implemented.

### Environment Validation

- **D-04:** Use **class-validator + class-transformer** for ConfigModule env validation (via `validate` option). Same library as request DTOs — one validation pattern across the entire codebase.
- **D-05:** **Phase 1 required vars:** `DATABASE_URL`, `PORT`. Auth0 vars (`AUTH0_JWKS_URI`, `AUTH0_AUDIENCE`, `AUTH0_ISSUER`, `AUTH0_NAMESPACE`) added as required in Phase 2. Missing required vars must crash the process with a clear error before any request is served.

### Swagger

- **D-06:** **Bearer auth pre-armed** — `addBearerAuth()` included in Phase 1 `DocumentBuilder` so Phase 2 protected routes can be tested from `/api/docs` immediately without Swagger changes.
- **D-07:** **Non-production only** — Swagger setup guarded by `NODE_ENV !== 'production'`. API contract not exposed in prod.

### Global ValidationPipe

- **D-08:** Enable `whitelist: true` and `transform: true`. Unknown properties stripped silently; payloads transformed to DTO class instances. `forbidNonWhitelisted` intentionally omitted — not enabled at this stage.
- **D-09:** Use **default NestJS error shape** — detailed field-level messages array (`{ message: [...], statusCode: 400, error: "Bad Request" }`). No custom ExceptionFilter needed.

### Claude's Discretion

- URI versioning global prefix and version string (`/api`, `v1`) — standard NestJS approach, Claude decides implementation detail.
- `.env.example` file content and structure — Claude decides which vars to document.
- Prisma client singleton pattern (module vs. direct injection) — Claude decides.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/workstreams/milestone/ROADMAP.md` — Phase 1 goal, success criteria, and plan breakdown (01-01, 01-02)
- `.planning/workstreams/milestone/REQUIREMENTS.md` — Full requirement list with traceability
- `.planning/PROJECT.md` — Core project vision, stack decisions, and out-of-scope items

### Established Stack Decisions (from STATE.md)
- `.planning/workstreams/milestone/STATE.md` — Records confirmed decisions: Prisma, soft delete day-one, cursor pagination, Auth0 namespace warning

No external specs or ADRs — all requirements captured in decisions above and planning docs.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/main.ts` — Bare bootstrap (`NestFactory.create` + `app.listen`). All Phase 1 bootstrap additions go here.
- `src/app.module.ts` — Empty imports array. ConfigModule wired in here.

### Established Patterns
- None yet — this is Phase 1. Patterns established here become the baseline for all subsequent phases.

### Integration Points
- `src/main.ts:5` — Insert `app.setGlobalPrefix`, `app.enableVersioning`, `app.useGlobalPipes`, and Swagger setup before `app.listen`
- `src/app.module.ts:6` — Import `ConfigModule.forRoot({ validate })` here

</code_context>

<specifics>
## Specific Ideas

- Soft delete (`deletedAt`) on Event is an explicit project-level constraint from STATE.md: "Soft delete (`deletedAt`) goes on Event in Phase 1 migration — retrofitting later is costly." This must not be deferred.
- Auth0 namespace (`AUTH0_NAMESPACE`) will be needed as a validated env var starting Phase 2, but only optional in Phase 1 `.env.example` documentation — not yet required at boot time.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-foundation*
*Context gathered: 2026-04-18*
