# Phase 7: Public Event Discovery - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-09
**Phase:** 07-public-event-discovery
**Areas discussed:** i18n delivery strategy, Full-text search setup, city field + filter semantics, Public event response shape

---

## i18n Delivery Strategy

### Q1 — Locale resolution approach

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side (Accept-Language) | API resolves locale, returns single translated title+description. Matches I18N-03. | |
| Client-side (all translations map) | Return translations: { pt: {...}, en: {...} }. Consistent with Category pattern. | ✓ |
| Both fields | Return default + translations map always. Verbose but maximally flexible. | |

**User's choice:** Client-side — return full translations map, consistent with Phase 4 categories.
**Notes:** I18N-03 spec (server-side Accept-Language) is superseded by this decision.

### Q2 — Supported locales

| Option | Description | Selected |
|--------|-------------|----------|
| Any string (open) | No validation on locale. Simple, no enum migration. | ✓ |
| Hard-coded list | Enumerate allowed locales in enum/check constraint. | |

**User's choice:** Open strings — any locale value accepted.

### Q3 — Organizer translation endpoint

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated endpoint | PUT /organizer/events/:id/translations/:locale — upsert per locale. | ✓ |
| Embedded in PATCH event | PATCH accepts optional translations: { pt: { title, description } }. | |

**User's choice:** Dedicated endpoint — clean REST, mirrors Category translation pattern.

---

## Full-Text Search Setup

### Q1 — tsvector sync mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| DB trigger | PostgreSQL trigger auto-updates on INSERT/UPDATE. Zero stale risk. | ✓ |
| App-side update | EventsService computes and writes tsvector. Fragile to direct DB writes. | |

**User's choice:** DB trigger.

### Q2 — tsvector language config

| Option | Description | Selected |
|--------|-------------|----------|
| simple | No stemming, no stop words. Works for any language. | ✓ |
| portuguese | PT stemming + stop words. Breaks non-PT content. | |
| english | EN stemming. Good for EN content only. | |

**User's choice:** simple — multilingual safe.

### Q3 — tsvector content scope

| Option | Description | Selected |
|--------|-------------|----------|
| Default only | Index events.title + events.description. Simple trigger. | |
| Default + all translations | Trigger joins event_translations and concatenates all locales. | ✓ |

**User's choice:** Default + all translations — richer search across all locales.

---

## city Field + Filter Semantics

### Q1 — city field type

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text varchar | Organizer types city. Consistent with venueName/address. | ✓ |
| Managed list / enum | City selected from predefined list. No typos but needs admin CRUD. | |

**User's choice:** Free-text varchar(100).

### Q2 — City filter semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Case-insensitive exact match | WHERE LOWER(city) = LOWER(:city). Simple. | |
| Case-insensitive LIKE prefix | WHERE LOWER(city) LIKE LOWER(:city) \|\| '%'. Prefix match. | ✓ |

**User's choice:** LIKE prefix — 'Pra' matches 'Praia'.

### Q3 — city varchar length

| Option | Description | Selected |
|--------|-------------|----------|
| 100 chars | Covers longest city names globally. Common convention. | ✓ |
| 200 chars | Same as title. Consistent but oversized. | |

**User's choice:** 100 chars.

---

## Public Event Response Shape

### Q1 — List item fields (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Organizer name embedded | organizer { id, name } inline. | ✓ |
| Category slug + name embedded | category { id, slug, name } inline. | ✓ |
| Translations map | translations: { [locale]: { title, description } }. | ✓ |
| imageUrl field | Include imageUrl (external URL). Nullable. | ✓ |

**User's choice:** All four — full embedded objects in list.

### Q2 — List vs. detail shape

| Option | Description | Selected |
|--------|-------------|----------|
| Same shape | Single DTO for both list and detail. Simpler. | |
| Richer detail shape | Detail has extra fields. Two DTOs. | ✓ |

**User's choice:** Two DTOs — richer detail.

### Q3 — Extra detail fields (multi-select)

| Option | Description | Selected |
|--------|-------------|----------|
| Full organizer profile | organizer { id, name, bio, contact }. | ✓ |
| All category translations | category with full translations map { locale: name }. | ✓ |
| ticketPrice + externalTicketUrl | Ticket info on detail only. | ✓ |

**User's choice:** All three — full organizer profile, category translations, and ticket info on detail only.

---

## Claude's Discretion

- event_translations PK: composite (eventId, locale)
- imageUrl validation: @IsUrl() decorator
- Exact tsvector trigger SQL implementation
- Index on events.city and events.status
- Whether PUT translations endpoint also supports DELETE for locale removal
- Organizer translation endpoint returns 404 (not 403) for wrong ownership

## Deferred Ideas

- Server-side Accept-Language resolution — superseded by client-side decision
- Geo-radius / proximity search (PostGIS) — v2
- Managed city list + admin CRUD — v2
- imageUrl upload/CDN pipeline — out of scope v1
- DELETE /organizer/events/:id/translations/:locale — planner decides
