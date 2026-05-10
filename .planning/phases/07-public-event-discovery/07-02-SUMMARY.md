---
phase: 07-public-event-discovery
plan: 02
subsystem: events
tags: [entity, dto, i18n, full-text-search, phase7]
dependency_graph:
  requires: [07-01]
  provides: [EventTranslationEntity, PublicEventListItemDto, PublicEventDetailDto, PublicEventsQueryDto, PaginatedPublicEventsResponseDto, UpsertEventTranslationDto]
  affects: [07-04, 07-05, 07-06]
tech_stack:
  added: []
  patterns: [composite-pk, oneToMany, class-validator, ApiProperty]
key_files:
  created:
    - src/events/event-translation.entity.ts
    - src/events/dto/upsert-event-translation.dto.ts
    - src/events/dto/public-event-list-item.dto.ts
    - src/events/dto/public-event-detail.dto.ts
    - src/events/dto/public-events-query.dto.ts
    - src/events/dto/paginated-public-events-response.dto.ts
  modified:
    - src/events/event.entity.ts
decisions:
  - "EventTranslationEntity uses composite PK (eventId, locale) — no surrogate id, matching D-01"
  - "searchVector column marked select:false so TypeORM never includes it in default SELECT queries"
  - "PublicEventDetailDto uses declare keyword to narrow organizer/category types without re-decorating"
  - "imageUrl and city columns added after externalTicketUrl, before status — follows existing column ordering pattern"
metrics:
  duration: "~5 minutes"
  completed: "2026-05-10"
  tasks_completed: 2
  files_changed: 7
---

# Phase 7 Plan 02: EventTranslationEntity and Phase 7 DTOs Summary

**One-liner:** Composite-PK EventTranslationEntity with tsvector/imageUrl/city on EventEntity, plus 5 typed DTOs for public event discovery endpoints.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create EventTranslationEntity and extend EventEntity | e50d7b8 | event-translation.entity.ts, event.entity.ts |
| 2 | Create all 5 Phase 7 DTOs | e50d7b8 | 5 new DTO files in src/events/dto/ |

## What Was Built

### EventTranslationEntity (`src/events/event-translation.entity.ts`)
- Composite PK: `@PrimaryColumn eventId varchar(30)` + `@PrimaryColumn locale varchar(10)`
- No surrogate id, no `@BeforeInsert`, no `createId()` — natural upsert key per D-01
- `@ManyToOne(() => EventEntity, onDelete: 'CASCADE')` — translations auto-deleted with parent event
- Open locale string per D-02 (no enum, no DB check constraint)

### EventEntity extensions (`src/events/event.entity.ts`)
- `imageUrl varchar(2048) nullable` — external URL only, no upload pipeline (D-10)
- `city varchar(100) nullable` — free-text city for LIKE prefix filter (D-08)
- `searchVector tsvector nullable, select: false` — never written by TypeORM, kept by DB trigger (D-04)
- `@OneToMany(() => EventTranslationEntity, eager: false)` translations relation

### DTOs created
- **UpsertEventTranslationDto** — `title` required (@MaxLength 200), `description` optional (@MaxLength 5000); mitigates T-07-02-01/T-07-02-02
- **PublicEventListItemDto** — full public list shape; excludes ticketPrice/externalTicketUrl per D-12; includes translations map `Record<string, { title, description }>` per D-01
- **PublicEventDetailDto** — extends PublicEventListItemDto; adds ticketPrice, externalTicketUrl; narrows organizer (bio, contact) and category (translations map) types via `declare`
- **PublicEventsQueryDto** — category/start/end/city/q/cursor/limit filters; @IsDateString on start/end, @IsString on q/city per T-07-02-03/T-07-02-04
- **PaginatedPublicEventsResponseDto** — `data: PublicEventListItemDto[]`, `nextCursor: string | null`, `hasMore: boolean` per D-13

## Deviations from Plan

None — plan executed exactly as written. Wave 0 RED spec stubs from 07-01 that referenced these files (entity import, DTO imports) are now resolved. Remaining TS errors (public-events.controller, upsertTranslation, findPublished, findPublishedById) are intentional Wave 2 stubs, not regressions from this plan.

## TypeScript Compile Status

`npx tsc --noEmit` — 13 remaining errors, all in Wave 0 RED stubs targeting Wave 2 files:
- `public-events.controller.ts` — Wave 2 (plan 07-04/07-05)
- `EventsService.upsertTranslation()` — Wave 2 (plan 07-04)
- `EventsService.findPublished()` / `findPublishedById()` — Wave 2 (plan 07-05)

No errors in any of the 7 files created or modified by this plan.

## Known Stubs

None — all fields in the created DTOs are fully typed. No hardcoded empty values or placeholder text flowing to rendering.

## Threat Flags

No new network endpoints, auth paths, or trust boundaries introduced in this plan. DTOs apply @IsString/@MaxLength validation as specified in threat model (T-07-02-01 through T-07-02-04).

## Self-Check

- [x] `src/events/event-translation.entity.ts` — exists, 2 @PrimaryColumn decorators, no @BeforeInsert
- [x] `src/events/event.entity.ts` — imageUrl, city, searchVector, OneToMany translations all present
- [x] All 5 DTO files exist in `src/events/dto/`
- [x] `PublicEventDetailDto extends PublicEventListItemDto` — confirmed
- [x] `ticketPrice`/`externalTicketUrl` in detail only, absent from list item — confirmed
- [x] Commit `e50d7b8` exists — confirmed (`feat(07-02): add EventTranslationEntity and Phase 7 DTOs`)

## Self-Check: PASSED
