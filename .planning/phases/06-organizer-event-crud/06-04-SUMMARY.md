---
phase: 06-organizer-event-crud
plan: "04"
subsystem: events
tags: [service, tdd, state-machine, cursor-pagination, ownership]
dependency_graph:
  requires: [06-01, 06-02, 06-03]
  provides: [EventsService]
  affects: [EventsModule, EventsController (Wave 3)]
tech_stack:
  added: []
  patterns: [cursor-pagination-row-value, compound-where-ownership, tdd-green]
key_files:
  created:
    - src/events/events.service.ts
  modified: []
decisions:
  - "applyFieldUpdates() extracted as private helper to keep update() under 20 lines (CLAUDE.md SRP)"
  - "assertPublishGate() runs after field updates so same-request fields are evaluated correctly"
  - "ALLOWED_TRANSITIONS and PUBLISH_REQUIRED_FIELDS extracted as module-level constants for clarity"
metrics:
  duration: "~15 minutes"
  completed: "2026-05-08"
  tasks_completed: 1
  files_created: 1
---

# Phase 06 Plan 04: EventsService Implementation Summary

EventsService with full CRUD, ownership enforcement (compound WHERE D-21), state machine (DRAFT→PUBLISHED→CANCELLED), publish gate (6 required fields + startAt > now()), and (startAt, id) row-value cursor pagination.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Create src/events/events.service.ts — GREEN phase | 94ee422 |

## Test Results

- `events.service.spec.ts`: 25/25 tests pass (GREEN)
- Full suite: 105/105 runnable tests pass
- `events.controller.spec.ts`: pre-existing RED stub from plan 06-01 (Wave 3 scope — controller not yet implemented)

## TypeScript

`npx tsc --noEmit` reports one error: `events.controller.spec.ts` cannot find `./events.controller`. This is the pre-existing Wave 3 RED stub condition from plan 06-01 — out of scope for this plan.

## Implementation Notes

### create()
Sets `status=DRAFT` and `organizerId` from the caller parameter (guard-resolved), never from the request body. Coerces ISO string dates to `Date` objects before saving.

### findOwned()
Uses TypeORM `QueryBuilder` with row-value cursor comparison:
```sql
AND (event."startAt", event."id") > (:cursorStartAt::timestamptz, :cursorId)
```
Fetches `effectiveLimit + 1` rows to detect `hasMore` without a `COUNT(*)` query.

### findOwnedById() / findOwnedOrThrow()
Single compound `WHERE { id: eventId, organizerId }` query — returns 404 regardless of whether the event exists but is owned by another organizer (D-21, T-06-04-06, no 403 leakage).

### update()
Order: findOwnedOrThrow → frozen-cancelled guard (409) → assertTransitionAllowed → applyFieldUpdates → assertPublishGate (if →PUBLISHED) → save. Publish gate runs after field updates so required fields supplied in the same PATCH are evaluated correctly.

### softDeleteDraft()
Checks `status === DRAFT` before calling `repository.softDelete()`. Non-DRAFT events throw `ConflictException` (D-15, T-06-04-05).

### State Machine
```
DRAFT → [PUBLISHED]
PUBLISHED → [CANCELLED]
CANCELLED → [] (terminal)
```

### Cursor Encoding
`encodeCursor(startAt, id)` → `Buffer.from('ISO__id').toString('base64url')`
`decodeCursor(cursor)` → splits on `__` to recover `{ cursorStartAt, cursorId }`

## Deviations from Plan

### Auto-added

**1. [Rule 2 - Missing Functionality] applyFieldUpdates() private helper**
- **Found during:** Task 1 — update() would exceed 20-line limit (CLAUDE.md) if written inline
- **Fix:** Extracted field-copy logic into `applyFieldUpdates(event, dto)` private method
- **Files modified:** src/events/events.service.ts

No other deviations — plan executed as written.

## Threat Surface Scan

All mitigations from the plan's threat register are implemented:
- T-06-04-01: organizerId from param only (create)
- T-06-04-02: compound WHERE in findOwnedOrThrow (update, softDeleteDraft)
- T-06-04-03: assertTransitionAllowed before any DB write (update)
- T-06-04-04: assertPublishGate with startAt > now() (update)
- T-06-04-05: DRAFT-only check before softDelete (softDeleteDraft)
- T-06-04-06: 404 for non-owned events in findOwnedById (findOwnedOrThrow)

No new threat surface introduced beyond the plan's scope.

## Self-Check: PASSED

- [x] `src/events/events.service.ts` exists (94ee422)
- [x] 25/25 events.service.spec.ts tests pass
- [x] No regressions in 105 passing tests
- [x] Commit 94ee422 verified in git log
