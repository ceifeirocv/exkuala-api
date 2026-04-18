# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-04-18)

**Core value:** Help people discover local cultural events they'd otherwise miss — filtered by location and personal interests
**Current focus:** Phase 1 — Foundation

## Current Position

Phase: 1 of 9 (Foundation)
Plan: 0 of 2 in current phase
Status: Ready to execute
Last activity: 2026-04-18 — Phase 1 planned (2 plans, verification passed)

Progress: [░░░░░░░░░░] 0%

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

### Pending Todos

None yet.

### Blockers/Concerns

- [Pre-Phase 2]: Auth0 custom claims namespace must be configured in Auth0 Action AND hardcoded in JwtStrategy before writing any guard — must agree before Phase 2 begins

## Deferred Items

| Category | Item | Status | Deferred At |
|----------|------|--------|-------------|
| Discovery | Geo-radius / proximity search (PostGIS) | v2 | Planning |
| Notifications | Push notifications | v2 | Planning |
| Social | Comments, sharing | v2 | Planning |
| Payments | Ticketing / payment processing | v2 | Planning |
| i18n | API error/validation message translations | v2 | Planning |

## Session Continuity

Last session: 2026-04-18
Stopped at: Phase 1 context gathered — ready to plan
Resume file: .planning/workstreams/milestone/phases/01-foundation/01-CONTEXT.md
