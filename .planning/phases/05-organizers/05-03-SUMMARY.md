---
phase: 05-organizers
plan: "05-03"
subsystem: service
tags: [nestjs, typeorm, state-machine, audit-log, guard, decorator]

# Dependency graph
requires:
  - phase: 05-02
    provides: "OrganizerEntity, OrganizerAuditLogEntity, DTOs — all consumed by OrganizersService"
provides:
  - "OrganizersService with full state machine enforcement (apply, approve, reject, findApprovedById, findSelfWithLatestNote, findByStatus, findAuditHistory, findApprovedByUserId, toPublicResponse)"
  - "OrganizerGuard that attaches approved OrganizerEntity to req.organizer; throws 403 if not approved"
  - "@CurrentOrganizer() param decorator reading req.organizer — mirrors @CurrentUser()"
affects: [05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "State machine in service layer: assertTransitionAllowed() with Partial<Record<Status, Status[]>> allowed-transitions map"
    - "In-place reapplication (rejected → pending): overwrite entity fields, reset status, save same row (D-06)"
    - "Audit log id pre-generated with createId() at object construction — avoids @BeforeInsert skip on repository.insert()"
    - "Sequential status + audit log saves (not wrapped in transaction) — acceptable for Phase 5 MVP volume; TODO comment left in service"
    - "OrganizerGuard attaches resolved entity to req.organizer; decorator reads req.organizer — no DI in createParamDecorator (RESEARCH.md Pitfall 2 Option A)"
    - "findApprovedByUserId() returns null (not throw) — distinct from findApprovedById() which throws 404"

key-files:
  created:
    - src/organizers/organizers.service.ts
    - src/auth/guards/organizer.guard.ts
    - src/auth/decorators/current-organizer.decorator.ts
  modified: []

key-decisions:
  - "findApprovedById() returns OrganizerEntity (not DTO) — spec asserts result.status; controller will call toPublicResponse() for the HTTP response shape"
  - "toPublicResponse() is a public method (not private) — plan 05-04 controller will call it directly to map entity → DTO"
  - "findSelfWithLatestNote() only queries audit log when status is not APPROVED — avoids unnecessary DB read for approved organizers per D-15"
  - "findByStatus() with no status param returns all organizers (no WHERE filter) — resolves RESEARCH.md open question 1 in favor of ergonomic admin default"

requirements-completed: [ORG-01, ORG-02, ORG-03]

# Metrics
duration: 20min
completed: 2026-05-06
---

# Phase 5 Plan 03: OrganizersService + OrganizerGuard + @CurrentOrganizer() Summary

**OrganizersService with full state machine enforcement (pending→approved|rejected, rejected→pending, approved terminal), OrganizerGuard attaching approved entity to request, and @CurrentOrganizer() param decorator mirroring @CurrentUser()**

## Performance

- **Duration:** 20 min
- **Started:** 2026-05-06T10:51:43Z
- **Completed:** 2026-05-06T11:12:27Z
- **Tasks:** 2
- **Files created:** 3

## Accomplishments

- Created `OrganizersService` implementing all 9 public methods: `apply()` with state-aware submission (APPROVED/PENDING → 409; REJECTED → overwrite in-place per D-06), `assertTransitionAllowed()` enforcing terminal APPROVED state, `approve()`/`reject()` with sequential status save + audit log insert, `findApprovedById()` returning entity (not DTO), `findSelfWithLatestNote()` with latest rejection note from audit log (D-15), `findByStatus()` with optional filter, `findAuditHistory()` newest-first, `findApprovedByUserId()` returning null (not throwing) for OrganizerGuard, and `toPublicResponse()` manually excluding email per D-03
- All 69 tests in the test suite pass GREEN (organizers.service.spec.ts fully resolved from RED)
- Created `OrganizerGuard` injecting OrganizersService, calling `findApprovedByUserId()`, attaching `OrganizerEntity` to `req.organizer`, throwing 403 on missing/unapproved organizer
- Created `@CurrentOrganizer()` param decorator reading `req.organizer` — exact mirror of `@CurrentUser()` pattern (createParamDecorator, same structure)
- No TypeScript errors in any created files; the two pre-existing Wave 0 RED spec errors (missing controllers) remain for plan 05-04

## Task Commits

Each task was committed atomically:

1. **Task 1: OrganizersService** - `9dda364` (feat)
2. **Task 2: OrganizerGuard and @CurrentOrganizer() decorator** - `a262cda` (feat)

## Files Created/Modified

- `src/organizers/organizers.service.ts` - Full OrganizersService with state machine, audit log insertion, public/self response mapping
- `src/auth/guards/organizer.guard.ts` - OrganizerGuard attaching approved OrganizerEntity to req.organizer; throws 403 if not approved
- `src/auth/decorators/current-organizer.decorator.ts` - @CurrentOrganizer() param decorator reading req.organizer

## Decisions Made

- `findApprovedById()` returns `OrganizerEntity` rather than `OrganizerPublicResponseDto` — the spec asserts `result.status` which is absent from the public DTO; the controller in plan 05-04 will call `toPublicResponse()` for the HTTP response
- `toPublicResponse()` is a `public` method (not `private`) so plan 05-04 controller can call it directly
- `findSelfWithLatestNote()` skips the audit log query when `status === APPROVED` — no rejection note to surface, avoids an unnecessary DB round-trip per D-15
- `findByStatus()` with absent status param performs `find()` with no WHERE clause, returning all organizers — resolves RESEARCH.md open question 1 in favor of the ergonomic admin default

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] findApprovedById() return type corrected from OrganizerPublicResponseDto to OrganizerEntity**

- **Found during:** Task 1 (TDD GREEN verification — test failure)
- **Issue:** Plan action showed `findApprovedById` returning `OrganizerPublicResponseDto`, but the spec asserts `result.status` which is not a field on the public DTO (email excluded, no status field per D-03)
- **Fix:** Changed return type to `OrganizerEntity`; controller in plan 05-04 calls `toPublicResponse()` for the HTTP response
- **Files modified:** `src/organizers/organizers.service.ts`
- **Verification:** `organizers.service.spec.ts` findApprovedById tests pass GREEN
- **Commit:** `9dda364`

**Total deviations:** 1 auto-fixed (Rule 1 bug). **Impact:** None on downstream plans — the controller was already expected to call `toPublicResponse()` to produce the public response shape.

## Issues Encountered

None beyond the auto-fixed deviation above.

## User Setup Required

None.

## Next Phase Readiness

- `OrganizersService` is fully implemented and tested. Plan 05-04 (controllers + module) depends on this service.
- `OrganizerGuard` and `@CurrentOrganizer()` are ready for use in Phase 6+ event CRUD routes.
- `OrganizerEntity` and `OrganizerAuditLogEntity` still need to be registered in `AppModule` entities array (Pitfall 6 from RESEARCH.md) — this is plan 05-04's responsibility.
- Wave 0 RED spec stubs for `organizers.controller.spec.ts` and `admin-organizers.controller.spec.ts` remain failing (missing controllers) — plan 05-04 resolves them.

## Known Stubs

None — all methods are fully implemented with real logic, no hardcoded returns or placeholder values.

## Threat Flags

No new security-relevant surface introduced beyond what the plan's threat model covers. All T-05-03-01 through T-05-03-05 mitigations are implemented:
- T-05-03-01: `userId` comes from `req.user.id` (JWT), not request body
- T-05-03-02: `assertTransitionAllowed()` enforces transitions; APPROVED is terminal; 409 on violation
- T-05-03-03: `OrganizerGuard` throws 403 on missing/unapproved organizer
- T-05-03-04: `toPublicResponse()` manually excludes email
- T-05-03-05: `approve()`/`reject()` service methods called directly — no raw status field exposed

## Self-Check

- [x] `src/organizers/organizers.service.ts` exists on disk
- [x] `src/auth/guards/organizer.guard.ts` exists on disk
- [x] `src/auth/decorators/current-organizer.decorator.ts` exists on disk
- [x] Commits 9dda364 and a262cda exist in git log
- [x] 69/69 tests pass (pnpm test)
- [x] No TypeScript errors in created files (only pre-existing Wave 0 RED stub errors for missing controllers)
- [x] `findApprovedByUserId()` returns null (not throw)
- [x] `toPublicResponse()` is a public method
- [x] `OrganizerGuard.canActivate()` calls `findApprovedByUserId()` and attaches result to `req.organizer`

## Self-Check: PASSED

---
*Phase: 05-organizers*
*Completed: 2026-05-06*
