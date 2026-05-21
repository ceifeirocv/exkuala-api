---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: verifying
stopped_at: Phase 8 context gathered
last_updated: "2026-05-21T11:49:24.505Z"
last_activity: 2026-05-10
progress:
  total_phases: 11
  completed_phases: 9
  total_plans: 38
  completed_plans: 38
  percent: 82
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Help people discover local cultural events they'd otherwise miss — filtered by location and personal interests
**Current focus:** Phase 7 complete — ready for Phase 8 (RSVPs / interest)

## Current Position

Phase: 7 of 9 (Public Event Discovery)
Plan: 6 of 6 in current phase
Status: Phase complete — human verified 2026-05-10
Last activity: 2026-05-10

Progress: [██████████] 97%

## Performance Metrics

**Velocity:**

- Total plans completed: 0
- Average duration: -
- Total execution time: 0 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

**Recent Trend:**

- Last 5 plans: none yet
- Trend: -

*Updated after each plan completion*
| Phase 02-auth-infrastructure P01 | 6min | 2 tasks | 12 files |
| Phase 02.1 P03 | 2min | 2 tasks | 2 files |
| Phase 03 P03-01 | 18min | 3 tasks | 3 files |
| Phase 05 P05-02 | 10min | 3 tasks | 8 files |
| Phase 05 P05-03 | 20min | 2 tasks | 3 files |
| Phase 05 P05-04 | 6min | 2 tasks | 4 files |
| Phase 06-organizer-event-crud P03 | 1 min | 1 tasks | 1 files |
| Phase 06-organizer-event-crud P04 | 15 | 1 tasks | 1 files |
| Phase 07-public-event-discovery P02 | 5m | - tasks | - files |
| Phase 07-public-event-discovery P05 | 12 | 2 tasks | 4 files |

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- ORM: Prisma (schema-first, type-safe) — confirmed by research
- Auth: passport-jwt + jwks-rsa with `cache: true` (RS256, JWKS endpoint)
- Auth0 custom claims namespace must be agreed before Phase 2 (e.g. `https://exkuala.app/roles`)
- Soft delete (`deletedAt`) goes on Event in Phase 1 migration — retrofitting later is costly
- Cursor-based pagination built into first event listing endpoint
- Image strategy: external URLs only, no S3 pipeline in v1
- Wave 0 RED stubs import non-existent source files at import level (not assertion level) to guarantee live test failure
- Controller spec uses direct instantiation (no TestingModule); service spec uses TestingModule + getRepositoryToken
- [Phase ?]: Length-mismatch early return before timingSafeEqual prevents TypeError (crypto throws if Buffer byte lengths differ)
- [Phase ?]: Auth0WebhookDto uses only sub and event; ValidationPipe whitelist:true strips extra Auth0 fields silently
- [Phase ?]: Wave 0 TDD RED gate pattern
- [Phase ?]: They go RED in Wave 1 when implementation changes — two-wave TDD contract
- [Phase 04-05]: Seeder scripts must use node dist/...seed.js (not ts-node) when AppDataSource.entities uses dist/** glob — ts-node loads source entity classes unregistered in the dist-based metadata registry
- [Phase 04-05]: Use find-or-insert (not upsert) for idempotent seeds where the row PK is referenced by a FK in a child table — upsert updating id breaks FK constraints on re-run
- [Phase 05]: Never cast raw entity to DTO — always call explicit mapping fn (toPublicResponse) or email leaks through
- [Phase 05]: Admin list endpoints need full entity return (not public DTO) — public DTOs strip status field
- [Phase 05]: Entities used as Swagger response types need @ApiProperty decorators — without them Swagger shows {}
- [Phase 05]: findApprovedById() returns OrganizerEntity (not DTO) — callers map via toPublicResponse(); controller spec mock must include toPublicResponse mock
- [Phase ?]: EventsService implementation
- [Phase ?]: EventTranslationEntity composite PK (eventId, locale) — no surrogate id per D-01
- [Phase 07]: TypeORM orderBy('alias."camelCol"') fails at runtime — use unquoted property name orderBy('alias.prop')
- [Phase 07]: Neon does not expose tsvector_agg despite PG 17 — use string_agg + to_tsvector instead
- [Phase 07]: Entity column name: add name: 'snake_case' to @Column when migration uses snake_case; else TypeORM sync creates duplicate camelCase column

### Roadmap Evolution

- Phase 1.1 inserted after Phase 1: Migrate from prisma to typeorm (URGENT)
- Phase 02.1 inserted after Phase 2: Add a webhook endpoint for Auth0 to add or refresh user on create/login (URGENT)

### Pending Todos

- [ ] Fix pnpm/npm SSL and config warnings on `migration:run`: (1) npm config bleedthrough (`npm-globalconfig`, `verify-deps-before-run`, `_jsr-registry`) — clean up global npm config; (2) pg-connection-string SSL mode deprecation — upgrade to `pg-connection-string` v3 or add `sslmode=verify-full` to DATABASE_URL when SSL is used.
- [ ] Trace why UserEntity bridges three graph communities (Users/Webhook, JWT, Organizer DTOs)
- [ ] Verify inferred graph edges OrganizerEntity→UserEntity and AuthenticatedUser→UserEntity
- [ ] Evaluate splitting Organizer Access Control module (cohesion 0.08)
- [ ] Trace AuthenticatedUser bridging JWT Strategy, Organizer Access Control, and Users communities

### Blockers/Concerns

- [RESOLVED - Phase 2]: Auth0 namespace `https://exkuala.cv/roles` implemented via AUTH0_NAMESPACE env var in JwtStrategy
- [Pre-Phase 3]: Four Auth0 env vars (AUTH0_JWKS_URI, AUTH0_AUDIENCE, AUTH0_ISSUER, AUTH0_NAMESPACE) must be set in .env before app starts

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Discovery | Geo-radius / proximity search (PostGIS) | v2 | Planning |
| Notifications | Push notifications | v2 | Planning |
| Social | Comments, sharing | v2 | Planning |
| Payments | Ticketing / payment processing | v2 | Planning |
| i18n | API error/validation message translations | v2 | Planning |

## Session Continuity

Last session: 2026-05-21T11:49:24.452Z
Stopped at: Phase 8 context gathered
Resume file: .planning/phases/08-rsvp/08-CONTEXT.md
