# Roadmap: Cultural Agenda API

## Overview

This roadmap delivers the Cultural Agenda API in dependency-driven order: foundation and infrastructure first, then auth, then the entities that depend on auth (users, categories, organizers), then the feature layers built on those entities (event CRUD, public discovery, RSVP, admin moderation). Internationalization is woven in alongside the entities it translates rather than deferred to a separate phase. The result is a publicly browsable event discovery API with authenticated RSVP, curated organizer onboarding, and admin moderation — the full v1 scope.

**Total phases:** 9
**Total v1 requirements:** 30

---

## Phases

- [x] **Phase 1: Foundation** - Prisma, ConfigModule, global pipes, Swagger, URI versioning *(complete 2026-04-18)*
- [x] **Phase 1.1: Migrate from prisma to typeorm** *(complete 2026-04-19)*
- [x] **Phase 2: Auth Infrastructure** - JWT guard chain, JWKS validation, role enforcement, public bypass (completed 2026-04-29)
- [x] **Phase 3: Users** - Local user record, auth0Id upsert on first authenticated request *(complete 2026-05-03)*
- [x] **Phase 4: Categories** - Managed category list with admin CRUD and i18n translations *(complete 2026-05-05)*
- [ ] **Phase 5: Organizers** - Application flow, admin approval/rejection, public organizer profile
- [ ] **Phase 6: Organizer Event CRUD** - Event create/edit/delete, ownership enforcement, status lifecycle, soft delete
- [ ] **Phase 7: Public Event Discovery** - Public listing with filtering, pagination, full-text search, i18n content delivery
- [ ] **Phase 8: RSVP** - Authenticated two-state RSVP, upsert semantics, aggregated counts
- [ ] **Phase 9: Admin Moderation** - Admin event oversight, organizer application management

---

## Phase Details

### Phase 1: Foundation
**Goal**: The project runs with a production-quality base: database connected, config validated, API versioned, and developer tooling active
**Depends on**: Nothing (first phase)
**Requirements**: SEC-01
**Success Criteria** (what must be TRUE):
  1. `GET /api/v1/` returns a response, confirming URI versioning and global prefix are active
  2. Prisma client connects to PostgreSQL and migrations run without error
  3. Swagger UI is accessible at `/api/docs` and reflects all registered routes
  4. Environment variables are validated at startup — missing required vars crash the process with a clear error before any request is served
  5. Global validation pipe rejects malformed request bodies with structured 400 errors
**Plans**: 2 plans

Plans:
- [x] 01-01: Prisma setup, schema baseline, and migration pipeline
- [x] 01-02: ConfigModule, environment validation, global pipes, URI versioning, and Swagger

---

### Phase 1.1: Migrate from prisma to typeorm *(INSERTED)*
**Goal**: Replace Prisma ORM with TypeORM across the entire codebase
**Depends on**: Phase 1
**Requirements**: TBD (infrastructure phase — validated against success criteria below)
**Success Criteria** (what must be TRUE):
  1. All Prisma schema models are replicated as TypeORM entities
  2. All database queries use TypeORM repositories/query builder
  3. Migrations are managed by TypeORM
  4. Application starts and passes all existing tests with TypeORM
**Plans**: 6 plans in 4 waves

Plans:
- [x] 1.1-01-PLAN.md — Wave 0: Entity spec stubs (user.entity.spec.ts, event.entity.spec.ts)
- [x] 1.1-02-PLAN.md — Wave 1: Package changes (install TypeORM, remove Prisma, update scripts)
- [x] 1.1-03-PLAN.md — Wave 1: TypeORM entities (UserEntity, EventEntity with full Prisma schema parity)
- [x] 1.1-04-PLAN.md — Wave 1: Infrastructure (data-source.ts + baseline migration)
- [x] 1.1-05-PLAN.md — Wave 2: AppModule wiring + Prisma file deletion
- [x] 1.1-06-PLAN.md — Wave 3: [BLOCKING] migration:run + phase verification

---

### Phase 2: Auth Infrastructure
**Goal**: Protected routes require a valid Auth0 JWT; role claims are enforced; public routes bypass the guard cleanly
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-04
**Success Criteria** (what must be TRUE):
  1. A request with a valid Auth0 JWT reaches a protected route; a request without one receives 401
  2. A route decorated with `@Roles('admin')` returns 403 for a `user`-role token and 200 for an `admin`-role token
  3. A route decorated with `@Public()` returns 200 without any Authorization header
  4. JWKS keys are cached — the JWKS endpoint is not called on every request
**Plans**: 2 plans

Plans:
- [x] 02-01: JwtStrategy (jwks-rsa, RS256, cache enabled), JwtAuthGuard, RolesGuard, @Roles() decorator
- [x] 02-02: @Public() decorator, OptionalJwtAuthGuard, guard integration tests

---

### Phase 02.1: Add a webhook endpoint for Auth0 to add or refresh user on create/login (INSERTED)

**Goal:** Auth0 Actions can notify the API when a user registers or logs in; the API upserts a local User record keyed on auth0Id, secured by a shared-secret header guard
**Requirements**: AUTH-03
**Depends on:** Phase 2
**Plans:** 4/4 plans complete *(complete 2026-05-02)*

Plans:
- [x] 02.1-01-PLAN.md — Wave 0: Test stubs (webhook-secret.guard.spec.ts, users.service.spec.ts, webhooks.controller.spec.ts)
- [x] 02.1-02-PLAN.md — Wave 1: WEBHOOK_SECRET env var, UsersService.upsertFromAuth0(), UsersModule
- [x] 02.1-03-PLAN.md — Wave 1: WebhookSecretGuard (timingSafeEqual), Auth0WebhookDto (parallel to 02)
- [x] 02.1-04-PLAN.md — Wave 2: WebhookController, WebhooksModule, AppModule wiring

### Phase 3: Users
**Goal**: An authenticated user's identity is always backed by a local User record, created or retrieved transparently on first login
**Depends on**: Phase 2
**Requirements**: AUTH-03
**Success Criteria** (what must be TRUE):
  1. First authenticated request for a new Auth0 identity creates a User row in the database
  2. Subsequent requests with the same Auth0 identity do not create duplicate rows (upsert semantics)
  3. The local User record is attached to the request context and available to downstream guards and services
**Plans**: 2 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: Test stubs (findOrCreate tests in users.service.spec.ts, async validate tests in jwt.strategy.spec.ts)
- [ ] 03-02-PLAN.md — Wave 1: AuthenticatedUser type, Express augmentation, UsersService.findOrCreate(), async JwtStrategy.validate(), AuthModule wiring, @CurrentUser() decorator

---

### Phase 4: Categories
**Goal**: Categories exist as a managed, translatable reference list; admins control the list; events and clients can reference categories by slug
**Depends on**: Phase 1
**Requirements**: CAT-01, CAT-02, CAT-03, I18N-02
**Success Criteria** (what must be TRUE):
  1. `GET /api/v1/categories` returns the full category list with default name, slug, and translations map `{ locale: name }`
  2. Admin can create, edit, and delete a category via authenticated endpoints
  3. `GET /api/v1/categories` always returns full translations map per category; clients resolve their preferred locale (D-12: supersedes Accept-Language server-side resolution)
  4. Category slugs are unique, URL-safe, and write-once after creation
**Plans**: 5 plans in 3 waves

Plans:
- [x] 04-01-PLAN.md — Wave 0: TDD RED stubs (categories.service.spec.ts, categories.controller.spec.ts)
- [x] 04-02-PLAN.md — Wave 1: CategoryEntity, CategoryTranslationEntity, DTOs (create, update, response interface)
- [x] 04-03-PLAN.md — Wave 1: TypeORM migration (categories + category_translations tables), seeder script, package.json seed:categories script
- [x] 04-04-PLAN.md — Wave 2: CategoriesService (CRUD + slug derivation + translations map), CategoriesController, CategoriesModule, AppModule wiring, slugify install
- [x] 04-05-PLAN.md — Wave 3: [BLOCKING] pnpm migration:run + pnpm seed:categories + full test suite + human verification

---

### Phase 5: Organizers
**Goal**: Authenticated users can apply to become organizers; admins review applications; approved organizers have a visible public profile
**Depends on**: Phase 3
**Requirements**: ORG-01, ORG-02, ORG-03
**Success Criteria** (what must be TRUE):
  1. Authenticated user can submit an organizer application with name, description, and contact info; application status is `pending`
  2. Admin can view, approve, or reject a pending application — status transitions to `approved` or `rejected`
  3. `GET /api/v1/organizers/:id` returns the public profile (name, bio, contact) for an approved organizer
  4. Rejected or pending organizers do not appear in public profile endpoints
  5. State transitions are enforced — an already-approved organizer cannot be re-submitted as pending
**Plans**: TBD

Plans:
- [ ] 05-01: Organizer Prisma model (status state machine: pending/approved/rejected), OrganizersModule, application endpoint
- [ ] 05-02: Admin approval/rejection endpoints, public profile endpoint, state transition enforcement

---

### Phase 6: Organizer Event CRUD
**Goal**: Approved organizers can create, edit, and delete their own events; events move through a defined status lifecycle; deleted events are soft-deleted
**Depends on**: Phase 5
**Requirements**: ORG-04, ORG-05, EVT-01, EVT-02, EVT-05
**Success Criteria** (what must be TRUE):
  1. Approved organizer can create an event with all required fields (title, description, date/time, venue, address, category, ticket price, ticket link)
  2. Organizer can edit and delete only events they own — attempts to modify another organizer's event return 403
  3. Event status transitions from `draft` to `published` to `cancelled` are organizer-controlled and validated
  4. Deleting an event sets `deletedAt` rather than removing the row; soft-deleted events do not appear in listings
**Plans**: TBD

Plans:
- [ ] 06-01: Event Prisma model (with deletedAt, status enum, organizer FK, category FK), EventsModule scaffold
- [ ] 06-02: Organizer event CRUD endpoints, ownership guard, status transition service

---

### Phase 7: Public Event Discovery
**Goal**: Anyone can browse, filter, search, and paginate published events; responses include translated content when the client requests a supported locale; event translations are stored and served per locale
**Depends on**: Phase 6, Phase 4
**Requirements**: EVT-04, EVT-06, DISC-01, DISC-02, DISC-03, DISC-04, I18N-01, I18N-03
**Success Criteria** (what must be TRUE):
  1. `GET /api/v1/events` without authentication returns only published events, paginated with cursor-based pagination
  2. Filtering by category slug, date range (start/end), and city returns correctly scoped results
  3. Full-text search on `title` and `description` via `?q=` returns relevant results using PostgreSQL tsvector
  4. `GET /api/v1/events` with `Accept-Language: pt` returns event title and description in Portuguese where an `event_translations` row exists, falling back to default content otherwise
  5. `GET /api/v1/events/:id` is accessible without authentication and includes full event detail
**Plans**: TBD

Plans:
- [ ] 07-01: EventTranslation Prisma model, organizer endpoint to add/update translations per locale
- [ ] 07-02: Public GET /events endpoint with cursor pagination, category/date/city filters
- [ ] 07-03: Full-text search (PostgreSQL tsvector column + GIN index), Accept-Language i18n resolution for events

---

### Phase 8: RSVP
**Goal**: Authenticated users can express interest in or commit to attending events, cancel their RSVP, see aggregated attendance counts on events, and retrieve their personal RSVP history
**Depends on**: Phase 7, Phase 3
**Requirements**: RSVP-01, RSVP-02, RSVP-03, RSVP-04
**Success Criteria** (what must be TRUE):
  1. Authenticated user can RSVP to a published event with state `interested` or `going`; a second RSVP to the same event updates (not duplicates) the state
  2. Authenticated user can cancel their RSVP; cancelled RSVPs no longer appear in their history
  3. `GET /api/v1/events/:id` includes `interestedCount` and `goingCount` aggregated from RSVP records
  4. `GET /api/v1/me/rsvps` returns the list of events the authenticated user has RSVPed to, with their RSVP state
**Plans**: TBD

Plans:
- [ ] 08-01: Rsvp Prisma model (User × Event unique constraint, state enum), RsvpModule, upsert endpoint
- [ ] 08-02: Cancel RSVP endpoint, RSVP counts on event detail, user RSVP history endpoint

---

### Phase 9: Admin Moderation
**Goal**: Admins have full visibility into organizer applications and all events (including drafts), and can take corrective action — unpublishing events or removing them from public view
**Depends on**: Phase 8
**Requirements**: EVT-03, ADMIN-01, ADMIN-02, ADMIN-03, ADMIN-04
**Success Criteria** (what must be TRUE):
  1. Admin can list all organizers filtered by status (`pending`, `approved`, `rejected`)
  2. Admin can list all events including drafts and unpublished events (organizers only see their own)
  3. Admin can approve or reject a pending organizer application
  4. Admin can unpublish or soft-delete any event regardless of organizer ownership
**Plans**: TBD

Plans:
- [ ] 09-01: AdminModule — organizer list (filtered by status), organizer approve/reject endpoints
- [ ] 09-02: Admin event list (all statuses), admin unpublish/remove event endpoints

---

## Progress

**Execution Order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 2/2 | Complete | 2026-04-18 |
| 1.1. Migrate from prisma to typeorm *(INSERTED)* | 6/6 | Complete | 2026-04-19 |
| 2. Auth Infrastructure | 2/2 | Complete   | 2026-04-29 |
| 02.1. Auth0 webhook endpoint *(INSERTED)* | 4/4 | Complete | 2026-05-02 |
| 3. Users | 1/2 | In Progress|  |
| 4. Categories | 5/5 | Complete | 2026-05-05 |
| 5. Organizers | 0/2 | Not started | - |
| 6. Organizer Event CRUD | 0/2 | Not started | - |
| 7. Public Event Discovery | 0/3 | Not started | - |
| 8. RSVP | 0/2 | Not started | - |
| 9. Admin Moderation | 0/2 | Not started | - |

---

## Coverage Map

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 2 | Pending |
| ORG-01 | Phase 5 | Pending |
| ORG-02 | Phase 5 | Pending |
| ORG-03 | Phase 5 | Pending |
| ORG-04 | Phase 6 | Pending |
| ORG-05 | Phase 6 | Pending |
| EVT-01 | Phase 6 | Pending |
| EVT-02 | Phase 6 | Pending |
| EVT-03 | Phase 9 | Pending |
| EVT-04 | Phase 7 | Pending |
| EVT-05 | Phase 6 | Pending |
| EVT-06 | Phase 7 | Pending |
| DISC-01 | Phase 7 | Pending |
| DISC-02 | Phase 7 | Pending |
| DISC-03 | Phase 7 | Pending |
| DISC-04 | Phase 7 | Pending |
| CAT-01 | Phase 4 | Complete |
| CAT-02 | Phase 4 | Complete |
| CAT-03 | Phase 4 | Complete |
| RSVP-01 | Phase 8 | Pending |
| RSVP-02 | Phase 8 | Pending |
| RSVP-03 | Phase 8 | Pending |
| RSVP-04 | Phase 8 | Pending |
| ADMIN-01 | Phase 9 | Pending |
| ADMIN-02 | Phase 9 | Pending |
| ADMIN-03 | Phase 9 | Pending |
| ADMIN-04 | Phase 9 | Pending |
| I18N-01 | Phase 7 | Pending |
| I18N-02 | Phase 4 | Complete |
| I18N-03 | Phase 7 | Pending |

**Total: 33 requirements mapped across 9 phases. 100% coverage.**

---
*Created: 2026-04-18*
