---
phase: 07-public-event-discovery
plan: 05
subsystem: api
tags: [nestjs, typeorm, postgres, public-endpoints, i18n, controller]

# Dependency graph
requires:
  - phase: 07-03
    provides: DTOs for public event listing, detail, query, and translation upsert
  - phase: 07-04
    provides: EventsService methods findPublished, findPublishedById, upsertTranslation; EventTranslationEntity
  - phase: 06-organizer-event-crud
    provides: EventsController, EventsModule, AppModule baseline, OrganizerGuard pattern

provides:
  - PublicEventsController at src/events/public-events.controller.ts with @Public() class-level decorator
  - GET /api/v1/events (findPublished) and GET /api/v1/events/:id (findPublishedById) — unauthenticated
  - PUT /api/v1/organizer/events/:id/translations/:locale (upsertTranslation) on EventsController
  - EventsModule wires EventTranslationEntity repository and PublicEventsController
  - AppModule includes EventTranslationEntity in TypeORM root entities array

affects:
  - 07-06-integration-tests
  - any future phase extending events module

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "@Public() at class level to bypass JwtAuthGuard on all routes in a controller"
    - "Two controllers on one module: EventsController (OrganizerGuard) + PublicEventsController (@Public())"
    - "PUT :id/translations/:locale using organizerId from @CurrentOrganizer(), never from body"

key-files:
  created:
    - src/events/public-events.controller.ts
  modified:
    - src/events/events.controller.ts
    - src/events/events.module.ts
    - src/app.module.ts

key-decisions:
  - "Two controllers registered in EventsModule: EventsController (organizer-guarded) and PublicEventsController (@Public()) — no route conflict because controllers are at different prefixes (organizer/events vs events)"
  - "EventTranslationEntity added to both EventsModule.forFeature and AppModule entities array so TypeORM can manage the table and EventsService can inject the repository"

patterns-established:
  - "Class-level @Public() on PublicEventsController makes all its routes unauthenticated without per-route decoration"
  - "upsertTranslation organizerId sourced from guard-resolved OrganizerEntity, never from request body (T-07-05-03)"

requirements-completed: [EVT-04, EVT-06, I18N-01, DISC-01, DISC-02, DISC-03, DISC-04]

# Metrics
duration: 12min
completed: 2026-05-10
---

# Phase 7 Plan 05: Controllers and Module Wiring Summary

**PublicEventsController with class-level @Public() wired into EventsModule alongside OrganizerGuard-protected EventsController; EventTranslationEntity registered in both module and app TypeORM config**

## Performance

- **Duration:** 12 min
- **Started:** 2026-05-10T00:00:00Z
- **Completed:** 2026-05-10T00:12:00Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- Created `PublicEventsController` with `@Public()` at class level, exposing GET /events and GET /events/:id without authentication
- Extended `EventsController` with PUT :id/translations/:locale endpoint delegating to `eventsService.upsertTranslation`, organizerId sourced from guard-resolved entity
- Wired `EventTranslationEntity` into `EventsModule.forFeature` and `AppModule` entities array so TypeORM manages the table and service can inject the repository

## Task Commits

Each task was committed atomically:

1. **Tasks 1 + 2: Create PublicEventsController, extend EventsController, wire EventsModule and AppModule** - `d6cde4c` (feat)

## Files Created/Modified

- `src/events/public-events.controller.ts` - New controller: @Public() class level, GET /events → findPublished, GET /events/:id → findPublishedById
- `src/events/events.controller.ts` - Added Put import, UpsertEventTranslationDto import, upsertTranslation endpoint at PUT :id/translations/:locale
- `src/events/events.module.ts` - Added EventTranslationEntity to forFeature, PublicEventsController to controllers array
- `src/app.module.ts` - Added EventTranslationEntity import and to TypeORM entities array

## Decisions Made

None - followed plan as specified. All patterns established in 07-CONTEXT.md (D-11, D-03) and 07-PATTERNS.md were applied directly.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. TypeScript compiled clean (`npx tsc --noEmit` exits 0). Full test suite: 21 suites, 133 tests, all GREEN.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 7 HTTP endpoints are registered and type-safe
- PublicEventsController delegates to EventsService methods implemented in 07-04
- Full test suite GREEN — ready for 07-06 integration tests
- No blockers

---
*Phase: 07-public-event-discovery*
*Completed: 2026-05-10*
