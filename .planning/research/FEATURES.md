# Feature Landscape

**Domain:** Cultural Events Discovery Platform API
**Project:** exkuala-api (Cultural Agenda)
**Researched:** 2026-04-18
**Confidence:** HIGH (domain patterns well-established; Auth0 + NestJS specifics from Context7; event platform patterns from Eventbrite, RA, Sympla, Fever, Time Out precedents)

---

## Table Stakes

Features users expect. Missing = product is unusable or users leave immediately.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Public event listing (paginated) | Unauthenticated browsing is the primary entry point | Low | Must not require login; default sort by date ASC |
| Public event detail | Users need full event info before deciding to attend | Low | Venue, date/time, description, organizer, ticket link |
| Filter by category | Cultural events span many types (music, theatre, art, cinema, festival) — mixed listing is unusable | Low | Enum-based; multiple categories selectable |
| Filter by date range | Today / This Weekend / This Week / Custom — browsing without time-scoping returns stale events | Low | Default to future events only; past events archive |
| Event search by keyword | Users search by event title or artist name | Medium | Postgres `ILIKE` on title + description is sufficient for MVP; full-text index recommended |
| Event status (published/draft/cancelled) | Organizers need to control visibility; cancellations happen | Low | Status field on event; only published events shown publicly |
| Organizer profile (public) | Users want to know who is running an event | Low | Name, description, website, contact — read-only for public |
| Auth0 JWT validation | Authenticated endpoints require identity | Medium | NestJS guard + Auth0 JWKS; required before any protected route ships |
| Role system (user / organizer / admin) | Three distinct actor types with different permissions | Medium | Stored in DB; Auth0 app_metadata or DB roles table with JWT claim sync |
| User registration (sync with Auth0) | Local user record needed for RSVP, preferences, and FK relationships | Low-Med | Triggered post-Auth0 login; upsert on first authenticated call |
| RSVP / Interest (authenticated) | Core interaction for registered users; enables re-engagement | Low | See RSVP Patterns section below |
| Organizer create/edit/delete own events | Organizers need CRUD on their content | Medium | Ownership guard: organizer can only touch their own events |
| Organizer application flow | Curated model requires apply → review → approve/reject | Medium | Application entity with status; admin review endpoints |
| Admin: approve/reject organizer | Platform quality control is the stated differentiator | Low | Status update on application; triggers organizer role grant |
| Admin: unpublish/remove event | Moderation capability for inappropriate or erroneous listings | Low | Soft-delete or status change; not hard delete |
| Ticket/price info + external link | Users need to know cost and where to buy — omitting this breaks the discovery-to-attendance funnel | Low | Fields: `price_range` (free/paid/price string), `ticket_url` (external URL) |
| Pagination on all list endpoints | Without pagination, large event sets crash performance and UX | Low | Cursor or offset; standardize early — hard to change later |
| Consistent error responses | API clients (web, mobile) need predictable error shapes | Low | RFC 7807 Problem Details or simple `{ error, message, statusCode }` shape |

---

## Standard Event Data Model

What fields are universally expected across cultural event platforms. Missing fields create friction at organizer onboarding or for event consumers.

### Core Event Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | Primary key |
| `title` | string | Yes | Max 120 chars |
| `description` | text | Yes | Markdown-safe; 2000 chars recommended |
| `status` | enum | Yes | `draft`, `published`, `cancelled`, `archived` |
| `category` | enum | Yes | `music`, `theatre`, `art`, `cinema`, `festival`, `other` |
| `tags` | string[] | No | Free-form for search enrichment |
| `starts_at` | timestamptz | Yes | Always store in UTC |
| `ends_at` | timestamptz | No | Not all events have a fixed end |
| `is_all_day` | boolean | No | For festivals that span a full day |
| `venue_name` | string | Yes | Display name of venue |
| `venue_address` | string | Yes | Full address |
| `venue_city` | string | Yes | For filtering in MVP (single-city scope) |
| `venue_lat` | decimal | No | For geo-proximity queries in v2 |
| `venue_lng` | decimal | No | For geo-proximity queries in v2 |
| `price_type` | enum | Yes | `free`, `paid`, `donation` |
| `price_range` | string | No | e.g. "R$20–R$80"; display string, not structured |
| `ticket_url` | string | No | External ticketing link |
| `cover_image_url` | string | No | Stored externally (S3/Cloudinary); URL reference only |
| `organizer_id` | UUID FK | Yes | References organizer who owns the event |
| `published_at` | timestamptz | No | Set when status transitions to `published` |
| `created_at` | timestamptz | Yes | Auto |
| `updated_at` | timestamptz | Yes | Auto |

### Organizer Entity Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | |
| `user_id` | UUID FK | Yes | The user who owns this organizer profile |
| `name` | string | Yes | Venue or promoter name |
| `bio` | text | No | |
| `website_url` | string | No | |
| `contact_email` | string | No | Public contact; may differ from login email |
| `instagram_handle` | string | No | Common for cultural event organizers |
| `status` | enum | Yes | `pending`, `approved`, `rejected`, `suspended` |
| `approved_at` | timestamptz | No | |
| `approved_by` | UUID FK | No | Admin user reference |

### RSVP / Interest Entity Fields

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `id` | UUID | Yes | |
| `user_id` | UUID FK | Yes | |
| `event_id` | UUID FK | Yes | |
| `type` | enum | Yes | `interested` or `going` — see RSVP Patterns |
| `created_at` | timestamptz | Yes | |
| Unique constraint on `(user_id, event_id)` | — | — | One response per user per event |

---

## RSVP / Interest Patterns

How event platforms typically handle user interest signals:

**Two-state model (recommended for MVP):** `interested` (soft interest, "save for later") and `going` (committed). Users can toggle between states or remove. Single record per user+event with a `type` field.

**Why not just `going`:** Cultural events have high browse-to-attend conversion friction. "Interested" captures intent without commitment and enables re-engagement (v2: "event is tomorrow and you said you're interested"). Platforms like Eventbrite, Facebook Events, and RA all use a two-state model.

**Aggregate counts:** Public event detail should expose `interested_count` and `going_count` as computed aggregates, not raw RSVP lists (privacy).

**Authentication gate:** RSVP requires auth. The create-RSVP endpoint should return 401 with a clear message for unauthenticated calls, not silently fail — this is the primary conversion funnel from browser to registered user.

**Idempotency:** `PUT /events/:id/rsvp` with `{ type }` is cleaner than separate POST/DELETE. Upsert semantics: if record exists, update type; if sent `null` or `none`, delete record.

---

## Search and Filter Patterns

Standard discovery patterns for cultural event APIs:

**Filter dimensions (MVP):**
- `category` — multi-value enum filter (`?category=music,theatre`)
- `date_from` / `date_to` — ISO 8601 date strings; default `date_from = today`
- `q` — keyword search on title + description
- `status=published` — always enforced for public endpoints (never expose draft/cancelled to public)

**Sort options:**
- `starts_at ASC` (default — soonest first)
- `created_at DESC` (newest listings)
- Relevance (if full-text search is implemented)

**Pagination pattern:** Offset-based (`page` + `limit`) is sufficient for MVP. Cursor-based pagination is only necessary when results sets exceed ~10K rows or real-time feeds are needed — defer to v2.

**Default behavior contract:** Public listing always filters `status = published` AND `starts_at >= now()`. This must be a hardcoded default, not client-controlled. Clients should not be able to request draft events or past events in the main listing (past events may be a separate `/events/past` endpoint if needed).

---

## Organizer Onboarding Patterns

Standard flow for curated organizer platforms:

1. **User registers** (Auth0 flow, gets `user` role by default)
2. **User applies to become organizer** — POST `/organizer-applications` with profile info (name, bio, website, reason)
3. **Application enters `pending` state** — user is notified (v2: email); admin sees it in dashboard
4. **Admin reviews** — GET `/admin/organizer-applications?status=pending`; PATCH to `approved` or `rejected`
5. **On approval** — organizer entity is created, user's role is updated to include `organizer`
6. **Organizer can now** — create events (in `draft` state by default), publish them

**Key design decisions for onboarding:**
- Application and organizer profile are separate entities: Application captures the "why" (reason text, timestamps, reviewer); Organizer captures the "what" (public profile shown on events).
- An organizer entity should only be created on approval, not at application time.
- Rejected applicants should be able to re-apply (new application, previous applications archived). Do not hard-block by user_id.
- Role sync with Auth0: updating the DB role is not enough if Auth0 tokens carry role claims. Plan for a mechanism to refresh/invalidate tokens after role change (Auth0 Management API call or a re-login requirement).

---

## Differentiators

Features that set the platform apart. Not expected at launch, but create competitive advantage. All are explicitly deferred to v2+.

| Feature | Value Proposition | Complexity | Dependency |
|---------|-------------------|------------|------------|
| Personalized recommendations | "Events based on your interests" — drives repeat visits | High | Requires interest history (RSVP data), user preference profile |
| User interest/taste profile | Lets users say "I like jazz, contemporary art" — improves discovery | Medium | User entity extension; feeds recommendation engine |
| Saved/favourite events (wishlist) | Distinct from RSVP — "I want to attend this" vs "I'm tracking it" | Low | RSVP table extension or separate entity |
| Email digests ("This week in [city]") | Re-engagement without push; high ROI for discovery platforms | Medium | Notification service, email provider (SendGrid/Resend), cron job |
| Recurring events | Concerts series, weekly markets — single entity with recurrence rules | High | Complex scheduling logic (iCal RRULE or custom); schema change |
| Organizer stats dashboard | Attendance interest counts per event, RSVP trends | Medium | Aggregate queries on RSVP table; permissions-scoped |
| Geo-radius search | "Events within 5km of me" — relevant once multi-district/city | Medium | PostGIS extension, lat/lng on venues, radius query |
| Multi-language support (i18n) | Event descriptions in multiple languages | High | Schema change (translation tables or JSONB), significant complexity |
| Social sharing metadata (OG tags) | Events link-preview correctly on WhatsApp/social | Low | Meta tags on frontend; API can expose structured data endpoint |
| Event collections / curated lists | "Top 10 this weekend" — editorial curation by admins | Medium | Admin-managed list entity; many-to-many with events |
| Waitlist for capacity-limited events | Events with max attendance — "notify me if spot opens" | Medium | Capacity field on event, waitlist queue entity |
| Review / rating after event | Post-event engagement; trust signal for organizers | High | Temporal constraint (only after starts_at), moderation complexity |

---

## Anti-Features

Things to deliberately NOT build in v1. Attempting these introduces complexity that stalls MVP delivery without proportional user value.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| In-platform ticketing / payment | PCI compliance, Stripe integration, refund logic — months of work. Platform stated goal is discovery, not ticketing. | Link to external ticket URL (Sympla, Eventim, etc.) |
| Comments / reviews on events | Moderation burden is high from day 1; feature is secondary to discovery | Defer to v2; collect RSVP data first |
| Multi-city / multi-region support | Premature scaling; data model complexity (location scoping on every query) before core is validated | Hard-scope to one city in MVP; add region_id later as a nullable FK |
| Push notifications | Infrastructure cost (FCM/APNs), device token management — not justified until retention is proven | Email digest in v2; no push in v1 |
| Social graph (follow organizer / user) | High complexity, low value without existing user base | Organizer profile is sufficient; following is v3+ |
| Admin analytics dashboard | Nice to have but not blocking platform operation | DB queries + pgAdmin is sufficient for admin in v1 |
| Open organizer self-service (no approval) | Loses quality control, the stated differentiator of the platform | Keep curated approval flow |
| Event series / recurring events | iCal RRULE parsing or custom recurrence is deceptively complex | Model single occurrences; organizers create multiple individual events |
| User-generated event submissions | Opens spam/moderation issues immediately | Organizer-only submissions via approval gate |
| Image upload / media management | S3 + CDN + image processing pipeline is significant infra. | Accept external image URLs from organizers; defer own upload to v2 |
| Real-time features (WebSockets) | RSVP counts do not need real-time; adds infra complexity | Polling or stale-while-revalidate on the frontend is sufficient |

---

## Feature Dependencies

```
Auth0 JWT guard
  └── User sync (post-login upsert)
        ├── RSVP / Interest
        └── Role system
              ├── Organizer application flow
              │     └── Admin: approve/reject organizer
              │           └── Organizer CRUD events
              │                 └── Event publish workflow
              └── Admin: moderate events

Public event listing
  └── Filter (category, date range)
        └── Keyword search (builds on listing endpoint)

Organizer profile (public)
  └── Organizer application flow (creates approved profile)
        └── Organizer CRUD events

RSVP / Interest
  └── RSVP aggregate counts on event detail
        └── (v2) Personalized recommendations
```

---

## MVP Recommendation

The following is the minimum set that makes the platform functional and delivers core value.

**Must ship in milestone 1 (foundation):**
1. Auth0 JWT guard + User sync
2. Role system (user / organizer / admin)
3. Public event listing with category + date filters
4. Public event detail
5. Event data model (all table stakes fields)

**Must ship in milestone 2 (organizer flows):**
6. Organizer application + admin approve/reject
7. Organizer CRUD events (draft/publish lifecycle)
8. Admin moderation (unpublish/remove)

**Must ship in milestone 3 (user engagement):**
9. RSVP / Interest (interested + going)
10. RSVP aggregate counts on event detail
11. Keyword search

**Defer explicitly:**
- Image upload (accept URL instead)
- Email notifications (v2)
- Geo-radius search (v2 — MVP is single city, address string is sufficient)
- Any social or recommendation feature

---

## Sources

- Domain analysis: Eventbrite API (REST), Resident Advisor platform, Sympla (Brazil), Fever, Facebook Events — behavioral patterns inferred from public-facing product experience and established industry conventions
- Auth0 + NestJS patterns: to be verified via Context7 during implementation phases
- Postgres full-text search: native `tsvector`/`tsquery` capabilities (well-established, HIGH confidence)
- iCal RRULE complexity: RFC 5545 (HIGH confidence — well-documented standard)
- Confidence: HIGH for feature categorization; MEDIUM for specific field choices (validated against multiple platform conventions but not a formal spec)
