# Requirements — Cultural Agenda API

## v1 Requirements

### Authentication & Identity (AUTH)

- [x] **AUTH-01**: System validates Auth0 JWT tokens on protected routes using jwks-rsa (RS256)
- [x] **AUTH-02**: System enforces role-based access (roles: `user`, `organizer`, `admin`) via Auth0 custom claims
- [x] **AUTH-03**: System upserts a local User record on first authenticated request (auth0Id as identity key)
- [x] **AUTH-04**: Public routes are accessible without authentication (`@Public()` decorator bypasses JWT guard)

### Organizers (ORG)

- [ ] **ORG-01**: Authenticated user can submit an organizer application (name, description, contact info)
- [ ] **ORG-02**: Admin can approve or reject an organizer application with optional notes
- [ ] **ORG-03**: Approved organizer has a public profile (name, bio, contact)
- [ ] **ORG-04**: Organizer can create, edit, and delete their own events
- [ ] **ORG-05**: Organizer can only manage events they own (ownership enforced at service layer)

### Events (EVT)

- [ ] **EVT-01**: Organizer can create an event with: title, description, date/time, venue name, address, category, ticket price, external ticket link
- [ ] **EVT-02**: Events have a status lifecycle: `draft` → `published` → `cancelled`; organizer controls state transitions
- [ ] **EVT-03**: Admin can unpublish or remove any event regardless of organizer
- [ ] **EVT-04**: Published events are publicly accessible without authentication
- [ ] **EVT-05**: Events support soft delete (`deletedAt` timestamp — not physically removed)
- [ ] **EVT-06**: Event list endpoint returns paginated results (cursor-based pagination)

### Discovery (DISC)

- [ ] **DISC-01**: Public event listing can be filtered by category
- [ ] **DISC-02**: Public event listing can be filtered by date range (start/end date params)
- [ ] **DISC-03**: Public event listing can be filtered by city/location
- [ ] **DISC-04**: Public event listing supports full-text search on title and description (PostgreSQL tsvector)

### Categories (CAT)

- [ ] **CAT-01**: Categories exist as a managed list (name + slug)
- [ ] **CAT-02**: Admin can create, edit, and delete categories
- [ ] **CAT-03**: Category names support translations via a separate translations table

### RSVP (RSVP)

- [ ] **RSVP-01**: Authenticated user can RSVP to an event with state `interested` or `going` (upsert semantics)
- [ ] **RSVP-02**: Authenticated user can cancel their RSVP
- [ ] **RSVP-03**: Event detail includes aggregated RSVP counts (interested count, going count)
- [ ] **RSVP-04**: Authenticated user can retrieve the list of events they have RSVPed to

### Admin (ADMIN)

- [ ] **ADMIN-01**: Admin can list all organizers filtered by status (pending / approved / rejected)
- [ ] **ADMIN-02**: Admin can list all events including drafts and unpublished
- [ ] **ADMIN-03**: Admin can approve or reject organizer applications (see ORG-02)
- [ ] **ADMIN-04**: Admin can unpublish or remove events (see EVT-03)

### Security (SEC)

- [x] **SEC-01**: All string database columns have explicit `VarChar` length limits to prevent oversized input from reaching the database; DTOs mirror these limits with `@MaxLength` decorators

### Internationalization (I18N)

- [ ] **I18N-01**: Event title and description support translations via a separate `event_translations` table (locale, title, description)
- [ ] **I18N-02**: Category names support translations via a separate `category_translations` table (locale, name)
- [ ] **I18N-03**: API returns translated content when a valid `Accept-Language` header is provided; falls back to default content if translation is not available

---

## v2 Requirements (Deferred)

- Geo-radius / proximity search (PostGIS) — deferred until multi-city expansion
- Push notifications (event reminders, application status updates)
- Social features (comments, sharing)
- Ticketing / payment processing — v1 links to external ticketing
- API error/validation messages i18n — v2
- Mobile app — API-first, app later
- Multi-region support — MVP is single city/region

---

## Out of Scope

- **Payment processing** — organizers link to external ticket platforms; no in-app payments
- **Image upload / hosting** — organizers provide external image URLs; no S3/CDN pipeline in v1
- **Real-time features** (WebSockets, SSE) — not needed for MVP
- **Comments / reviews** — v2 social layer
- **OAuth social login** — Auth0 handles this; not wired at API level in v1
- **Multi-tenancy / multi-city admin** — single region MVP

---

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 — Auth Infrastructure | Complete |
| AUTH-02 | Phase 2 — Auth Infrastructure | Complete |
| AUTH-03 | Phase 3 — Users | Complete |
| AUTH-04 | Phase 2 — Auth Infrastructure | Complete |
| ORG-01 | Phase 5 — Organizers | Pending |
| ORG-02 | Phase 5 — Organizers | Pending |
| ORG-03 | Phase 5 — Organizers | Pending |
| ORG-04 | Phase 6 — Organizer Event CRUD | Pending |
| ORG-05 | Phase 6 — Organizer Event CRUD | Pending |
| EVT-01 | Phase 6 — Organizer Event CRUD | Pending |
| EVT-02 | Phase 6 — Organizer Event CRUD | Pending |
| EVT-03 | Phase 9 — Admin Moderation | Pending |
| EVT-04 | Phase 7 — Public Event Discovery | Pending |
| EVT-05 | Phase 6 — Organizer Event CRUD | Pending |
| EVT-06 | Phase 7 — Public Event Discovery | Pending |
| DISC-01 | Phase 7 — Public Event Discovery | Pending |
| DISC-02 | Phase 7 — Public Event Discovery | Pending |
| DISC-03 | Phase 7 — Public Event Discovery | Pending |
| DISC-04 | Phase 7 — Public Event Discovery | Pending |
| CAT-01 | Phase 4 — Categories | Pending |
| CAT-02 | Phase 4 — Categories | Pending |
| CAT-03 | Phase 4 — Categories | Pending |
| RSVP-01 | Phase 8 — RSVP | Pending |
| RSVP-02 | Phase 8 — RSVP | Pending |
| RSVP-03 | Phase 8 — RSVP | Pending |
| RSVP-04 | Phase 8 — RSVP | Pending |
| ADMIN-01 | Phase 9 — Admin Moderation | Pending |
| ADMIN-02 | Phase 9 — Admin Moderation | Pending |
| ADMIN-03 | Phase 9 — Admin Moderation | Pending |
| ADMIN-04 | Phase 9 — Admin Moderation | Pending |
| I18N-01 | Phase 7 — Public Event Discovery | Pending |
| I18N-02 | Phase 4 — Categories | Pending |
| I18N-03 | Phase 7 — Public Event Discovery | Pending |
| SEC-01 | Phase 1 — Foundation | Complete |

**Coverage: 34/34 v1 requirements mapped. 100%.**
