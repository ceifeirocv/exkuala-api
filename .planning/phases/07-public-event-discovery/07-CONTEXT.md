# Phase 7: Public Event Discovery - Context

**Gathered:** 2026-05-09
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the public read layer for events. Unauthenticated clients can browse, filter, full-text search, and paginate published events. Organizers can add/update per-locale translations. Responses include a translations map; clients resolve their preferred locale. Phase 7 also adds `imageUrl` and `city` to EventEntity (deferred from Phase 6), the `event_translations` table, and a GIN-indexed tsvector column for full-text search.

**In scope:**
- `GET /api/v1/events` — public listing, cursor-paginated, published events only, no auth required
- `GET /api/v1/events/:id` — public event detail, no auth required
- Filters on listing: `?category=<slug>`, `?start=<ISO date>`, `?end=<ISO date>`, `?city=<string>`, `?q=<search term>`
- `PUT /api/v1/organizer/events/:id/translations/:locale` — organizer upserts a translation for one locale
- EventEntity: add `imageUrl` (varchar 2048, nullable) and `city` (varchar 100, nullable)
- `event_translations` table: (eventId, locale, title, description) — composite PK, upsert semantics
- tsvector column on events: auto-updated by DB trigger, indexes default title+description AND all event_translations content, `simple` config
- GIN index on tsvector column
- EVT-04, EVT-06, DISC-01, DISC-02, DISC-03, DISC-04, I18N-01, I18N-03

**Out of scope:**
- RSVP counts on events — Phase 8 (interestedCount, goingCount added then)
- Admin event oversight — Phase 9
- Geo-radius / proximity search (PostGIS) — v2 (single city/region MVP)
- Server-side Accept-Language resolution — superseded by client-side translations map (see D-01)
- Managed city list / city admin CRUD — v2
- imageUrl upload pipeline (S3/CDN) — out of scope entirely (external URLs only)
</domain>

<decisions>
## Implementation Decisions

### i18n — Translations Delivery

- **D-01:** Client-side locale resolution chosen over I18N-03 server-side Accept-Language approach. Events return a `translations` map: `{ pt: { title, description }, en: { title, description } }`. Consistent with Phase 4 Category pattern (D-12 from 04-CONTEXT.md). Clients pick their locale; API always returns all available translations. I18N-03 spec is superseded by this decision.
- **D-02:** Locale values are open strings — no enum, no DB check constraint. Organizer passes any locale string ('pt', 'en', 'fr', etc.). No migration needed when adding locales.
- **D-03:** Organizer adds/updates translations via dedicated endpoint: `PUT /api/v1/organizer/events/:id/translations/:locale`. Upsert semantics (insert or update). Requires `@CurrentOrganizer()` + ownership check. Returns the updated translation object.

### Full-Text Search

- **D-04:** tsvector column kept in sync via PostgreSQL DB trigger (not app-side). Trigger fires on INSERT/UPDATE of `events` AND on INSERT/UPDATE/DELETE of `event_translations`. Ensures tsvector never goes stale regardless of how rows are written.
- **D-05:** tsvector text search config: `simple`. No stemming, no stop words. Works correctly for any language (Portuguese, English, Creole, etc.). Best choice for a multilingual event listing.
- **D-06:** tsvector content: concatenates default `events.title || ' ' || events.description` AND all `event_translations.(title || ' ' || description)` for that event. Trigger joins `event_translations` on update. Searching in any translated locale will surface the event.
- **D-07:** GIN index on the tsvector column. Query: `WHERE search_vector @@ plainto_tsquery('simple', :q)`. `plainto_tsquery` chosen over `to_tsquery` — handles multi-word phrases without requiring the caller to know tsquery syntax.

### city + imageUrl Fields

- **D-08:** `city` is a free-text `varchar(100)`, nullable, on EventEntity. Organizer types the city name at event creation/update. No managed list in v1.
- **D-09:** City filter semantics: case-insensitive LIKE prefix — `WHERE LOWER(city) LIKE LOWER(:city) || '%'`. Allows partial prefix ('Pra' matches 'Praia'). No full-text or fuzzy — simple prefix is sufficient for a single-region MVP.
- **D-10:** `imageUrl` is `varchar(2048)`, nullable, on EventEntity. External URL only — no upload pipeline. Consistent with SEC-01 and PROJECT.md "Out of Scope" (no S3/CDN in v1).

### Public Event Response Shape

- **D-11:** Two DTOs — `PublicEventListItemDto` (list) and `PublicEventDetailDto` (detail). Detail extends list.

  **List item includes:** `id`, `title`, `description`, `startAt`, `endAt`, `venueName`, `address`, `city`, `imageUrl`, `status` (always `PUBLISHED` for public endpoints), `category: { id, slug, name }`, `organizer: { id, name }`, `translations: { [locale]: { title, description } }`, `createdAt`.

  **Detail adds:** `organizer: { id, name, bio, contact }` (full public organizer profile, not just name), `category: { id, slug, name, translations: { [locale]: name } }` (category with full translations map), `ticketPrice`, `externalTicketUrl`.

- **D-12:** Ticket info (`ticketPrice`, `externalTicketUrl`) only on detail — not in list. Keeps list payload lean.
- **D-13:** Cursor pagination shape reuses Phase 6 canonical: `{ data: PublicEventListItemDto[], nextCursor: string | null, hasMore: boolean }`. Cursor key: composite `(startAt, id)`, base64-encoded. Default limit=20, max=100. Sort: `startAt ASC`.

### Claude's Discretion

- `event_translations` table PK: composite `(eventId, locale)` — natural upsert key, no surrogate ID needed.
- Whether `PUT /organizer/events/:id/translations/:locale` also supports `DELETE` for removing a locale (planner decides based on whether ROADMAP mentions it).
- `imageUrl` validation: `@IsUrl()` decorator from class-validator on the DTO field.
- Exact tsvector trigger SQL (planner writes migration).
- Index on `events.city` for filter performance (planner decides based on query patterns).
- Index on `events.status` if not already present (for `WHERE status = 'PUBLISHED'` on public listing).
- Organizer endpoint ownership: return 404 (not 403) when event doesn't belong to organizer — consistent with Phase 5/6 no-info-leakage pattern.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Planning
- `.planning/ROADMAP.md` — Phase 7 goal, success criteria (EVT-04, EVT-06, DISC-01–04, I18N-01, I18N-03), plan stubs
- `.planning/REQUIREMENTS.md` — EVT-04, EVT-06, DISC-01, DISC-02, DISC-03, DISC-04, I18N-01, I18N-03 requirement definitions
- `.planning/PROJECT.md` — Stack (NestJS, TypeORM, PostgreSQL), SEC-01 (VarChar + @MaxLength), "Out of Scope" (no S3/CDN)

### Prior Phase Context (mandatory reads)
- `.planning/phases/06-organizer-event-crud/06-CONTEXT.md` — D-17 (cursor shape), D-18 (cursor key), D-19 (sort), D-22 (EventsModule at src/events/), deferred imageUrl/city/translations from Phase 6
- `.planning/phases/04-categories/04-CONTEXT.md` — D-12 (client-side locale resolution pattern that Phase 7 mirrors for events), CategoryTranslationEntity pattern

### Existing Code to Extend or Mirror
- `src/events/event.entity.ts` — Phase 7 adds `imageUrl` and `city` columns
- `src/events/events.service.ts` — add public listing/detail methods; cursor pagination already implemented for organizer listing
- `src/events/events.controller.ts` — add `GET /events` and `GET /events/:id` public routes (use `@Public()`)
- `src/categories/category.entity.ts` + `src/categories/category-translation.entity.ts` — pattern for event_translations table
- `src/auth/decorators/public.decorator.ts` — `@Public()` for unauthenticated event endpoints
- `src/organizers/organizers.controller.ts` + `src/organizers/dto/` — pattern for organizer sub-routes and DTO structure
- `src/events/dto/` — existing DTOs (create, update, response, paginated, pagination-query); Phase 7 adds public variants

No external ADRs — all decisions captured above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `@Public()` decorator — already built Phase 2; decorate `GET /events` and `GET /events/:id` without modification
- `@CurrentOrganizer()` + `OrganizerGuard` — use on `PUT /organizer/events/:id/translations/:locale`
- `JwtAuthGuard` + `RolesGuard` — globally registered; `@Public()` bypasses both
- Cursor pagination logic in EventsService — already implemented for organizer listing; public listing reuses same `(startAt, id)` cursor key, shape, and limit logic
- `@paralleldrive/cuid2` `createId()` — NOT needed for event_translations (composite PK, no surrogate)
- `@ApiProperty` pattern — mandatory on all entity fields and DTOs (Phase 5 lesson)
- Manual DTO mapping (no ClassSerializerInterceptor) — service returns entity + joins; controller calls mapping fn

### Established Patterns
- TypeORM `@OneToMany` / `@ManyToOne` relation pattern — mirror CategoryTranslationEntity for EventTranslationEntity
- `QueryFailedError` code `'23505'` → 409 for unique constraint violations
- Wave 0 TDD RED stubs (import non-existent source at import level) → Wave 1 implementation
- Controller spec: direct instantiation (no TestingModule); Service spec: TestingModule + getRepositoryToken
- Service returns entity (with joins); controller maps to DTO — never return raw entity from controller
- VarChar lengths per SEC-01: city varchar(100), imageUrl varchar(2048) — mirror existing column lengths

### Integration Points
- `src/events/event.entity.ts` — add `imageUrl` varchar(2048) nullable, `city` varchar(100) nullable, `searchVector` tsvector column, `@OneToMany(() => EventTranslationEntity)`
- New TypeORM migration: ALTER TABLE events (add imageUrl, city, searchVector), CREATE TABLE event_translations, CREATE GIN INDEX on searchVector, CREATE TRIGGER for tsvector auto-update
- `src/events/events.module.ts` — add EventTranslationEntity repository to providers
- `src/events/events.controller.ts` — new public routes at `/events` prefix alongside existing `/organizer/events`
- `src/app.module.ts` — add EventTranslationEntity to TypeORM entities array

</code_context>

<specifics>
## Specific Ideas

- tsvector trigger pseudo-SQL:
  ```sql
  CREATE OR REPLACE FUNCTION events_search_vector_update() RETURNS trigger AS $$
  BEGIN
    NEW.search_vector :=
      to_tsvector('simple', COALESCE(NEW.title, '')) ||
      to_tsvector('simple', COALESCE(NEW.description, '')) ||
      (SELECT coalesce(tsvector_agg(to_tsvector('simple',
        COALESCE(t.title, '') || ' ' || COALESCE(t.description, '')
      )), to_tsvector('simple', ''))
       FROM event_translations t WHERE t.event_id = NEW.id);
    RETURN NEW;
  END;
  $$ LANGUAGE plpgsql;
  ```
  Note: trigger on `event_translations` must also call `UPDATE events SET search_vector = ... WHERE id = NEW.event_id` to keep vector fresh when translations change.

- City LIKE query: `WHERE LOWER(e.city) LIKE LOWER(:city) || '%'` with `city` param from `?city=` query string.

- `PUT /api/v1/organizer/events/:id/translations/:locale` request body:
  ```json
  { "title": "...", "description": "..." }
  ```
  Response: `{ locale, title, description }` (the upserted translation).

- Public listing filter params: `?category=<slug>`, `?start=<ISO8601>`, `?end=<ISO8601>`, `?city=<string>`, `?q=<search>`, `?cursor=<opaque>`, `?limit=<number>`.

- Detail organizer shape: `{ id, name, bio, contact }` — same fields as `GET /organizers/:id` public profile (Phase 5 OrganizerPublicResponseDto).

</specifics>

<deferred>
## Deferred Ideas

- Server-side Accept-Language resolution (I18N-03) — superseded by client-side translations map decision. Can be added as a response transform in v2 if clients request it.
- Geo-radius / proximity search (PostGIS) — v2, already in REQUIREMENTS.md v2 deferred list.
- Managed city list + admin CRUD — v2.
- imageUrl upload/CDN pipeline — out of scope v1 entirely.
- `DELETE /organizer/events/:id/translations/:locale` (remove a translation) — not discussed; planner decides if ROADMAP scope warrants it.
- tsvector on translated content only (no default) — considered but rejected; default content always indexed.

</deferred>

---

*Phase: 07-public-event-discovery*
*Context gathered: 2026-05-09*
