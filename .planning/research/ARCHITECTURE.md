# Architecture Patterns

**Domain:** Cultural Agenda / Event Discovery API
**Project:** exkuala-api
**Stack:** NestJS 11 (TypeScript) + PostgreSQL + Auth0 JWT
**Researched:** 2026-04-18
**Confidence:** HIGH (NestJS + Auth0 patterns are well-established; verified against current NestJS 11 docs and Auth0 Management API practices)

---

## Recommended Architecture

### High-Level System Diagram

```
                          ┌─────────────────────────────────────────────┐
                          │               NestJS Application             │
                          │                                              │
HTTP Request              │  ┌─────────┐   ┌──────────┐   ┌─────────┐  │
─────────────────────────►│  │Middleware│──►│  Guards  │──►│ Router  │  │
(JWT Bearer token         │  │(Logger, │   │(JwtAuth, │   │(Module  │  │
 or no token)             │  │ Helmet) │   │ Roles)   │   │ Routes) │  │
                          │  └─────────┘   └──────────┘   └────┬────┘  │
                          │                                     │       │
                          │                          ┌──────────▼──────┐│
                          │                          │   Controllers   ││
                          │                          │ (validate DTOs) ││
                          │                          └──────────┬──────┘│
                          │                                     │       │
                          │                          ┌──────────▼──────┐│
                          │                          │    Services     ││
                          │                          │ (business logic)││
                          │                          └──────────┬──────┘│
                          │                                     │       │
                          │                          ┌──────────▼──────┐│
                          │                          │  Repositories   ││
                          │                          │ (TypeORM/Prisma)││
                          │                          └──────────┬──────┘│
                          └─────────────────────────────────────┼───────┘
                                                                │
                                                    ┌───────────▼──────────┐
                                                    │      PostgreSQL       │
                                                    └──────────────────────┘

External: Auth0 JWKS endpoint (JWT verification, no runtime API calls needed)
```

---

## Module Structure

NestJS organizes around feature modules. Each domain concern gets its own module. The `AppModule` registers them all. There is no reason to use a monolith `AppModule` with inline logic.

### Recommended Module Layout

```
src/
├── app.module.ts              ← Root module: imports all feature modules
├── main.ts                    ← Bootstrap: global pipes, versioning, Swagger
│
├── auth/                      ← Cross-cutting: JWT validation + RBAC machinery
│   ├── auth.module.ts
│   ├── guards/
│   │   ├── jwt-auth.guard.ts        ← Validates Auth0 JWT signature + expiry
│   │   └── roles.guard.ts           ← Reads @Roles() decorator, checks JWT claims
│   ├── decorators/
│   │   ├── roles.decorator.ts       ← @Roles('admin', 'organizer')
│   │   └── current-user.decorator.ts ← @CurrentUser() param decorator
│   ├── strategies/
│   │   └── jwt.strategy.ts          ← PassportJS JWT strategy (JWKS-RSA)
│   └── auth.module.ts
│
├── users/                     ← Registered user profiles (synced from Auth0)
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── users.repository.ts
│   ├── entities/
│   │   └── user.entity.ts
│   └── dto/
│       └── update-profile.dto.ts
│
├── organizers/                ← Organizer application + approval workflow
│   ├── organizers.module.ts
│   ├── organizers.controller.ts
│   ├── organizers.service.ts
│   ├── entities/
│   │   └── organizer.entity.ts
│   └── dto/
│       ├── apply-organizer.dto.ts
│       └── review-application.dto.ts
│
├── events/                    ← Core event CRUD + publication + moderation
│   ├── events.module.ts
│   ├── events.controller.ts
│   ├── events.service.ts
│   ├── entities/
│   │   └── event.entity.ts
│   └── dto/
│       ├── create-event.dto.ts
│       ├── update-event.dto.ts
│       └── event-filters.dto.ts
│
├── categories/                ← Managed list of cultural categories
│   ├── categories.module.ts
│   ├── categories.controller.ts
│   ├── categories.service.ts
│   └── entities/
│       └── category.entity.ts
│
├── rsvp/                      ← User interest/RSVP on events (auth required)
│   ├── rsvp.module.ts
│   ├── rsvp.controller.ts
│   ├── rsvp.service.ts
│   └── entities/
│       └── rsvp.entity.ts
│
├── admin/                     ← Admin-scoped operations (approve orgs, moderate)
│   ├── admin.module.ts
│   └── admin.controller.ts    ← Thin controller delegating to Organizer/Event services
│
└── common/                    ← Shared utilities
    ├── filters/
    │   └── http-exception.filter.ts
    ├── interceptors/
    │   └── response-transform.interceptor.ts  (optional, consistent shape)
    ├── pipes/
    │   └── validation.pipe.ts  (or use global ValidationPipe)
    └── types/
        └── jwt-payload.interface.ts
```

**Rule:** Modules communicate only through their exported services. No module imports another module's repository directly. `AdminModule` is a thin orchestrator — it delegates to `OrganizersService` and `EventsService` rather than owning persistence.

---

## Data Model / Schema Design

### Entities and Relationships

```
User
├── id: uuid (PK)
├── auth0Id: string (unique) ← sub claim from JWT; used as join key
├── email: string (unique)
├── displayName: string
├── role: enum('user','organizer','admin')
├── createdAt, updatedAt: timestamp

Organizer
├── id: uuid (PK)
├── userId: uuid (FK → User.id, unique 1:1)
├── name: string
├── description: text
├── contactEmail: string
├── website: string (nullable)
├── status: enum('pending','approved','rejected')
├── reviewedBy: uuid (FK → User.id, nullable) ← admin who reviewed
├── reviewedAt: timestamp (nullable)
├── createdAt, updatedAt: timestamp

Category
├── id: uuid (PK)
├── name: string (unique)         ← e.g. 'Music', 'Theatre', 'Cinema'
├── slug: string (unique)         ← url-safe: 'music', 'theatre'
├── description: string (nullable)

Event
├── id: uuid (PK)
├── organizerId: uuid (FK → Organizer.id)
├── title: string
├── description: text
├── startsAt: timestamp
├── endsAt: timestamp (nullable)
├── venueName: string
├── venueAddress: string
├── city: string                  ← scoped to single city for MVP
├── latitude: decimal (nullable)  ← optional geodata for future geo-search
├── longitude: decimal (nullable)
├── ticketPrice: decimal (nullable)  ← null = free
├── ticketUrl: string (nullable)     ← link to external ticketing
├── coverImageUrl: string (nullable)
├── status: enum('draft','published','cancelled','removed')
├── createdAt, updatedAt: timestamp

EventCategory (join table, many-to-many)
├── eventId: uuid (FK → Event.id)
├── categoryId: uuid (FK → Category.id)
├── PRIMARY KEY (eventId, categoryId)

Rsvp
├── id: uuid (PK)
├── userId: uuid (FK → User.id)
├── eventId: uuid (FK → Event.id)
├── createdAt: timestamp
├── UNIQUE (userId, eventId)      ← one RSVP per user per event
```

### Key Design Decisions

- **`auth0Id` as the User sync key.** On first authenticated request, the API upserts a User row using the `sub` claim from the JWT. No Auth0 Management API calls at runtime — JWT is self-contained.
- **`role` on User, not on Auth0.** Auth0 stores the role claim in the JWT (via a custom action/rule), but the database is the source of truth for role changes. RBAC guard reads the JWT claim; role changes require both Auth0 and DB update (admin operation).
- **`status` on Organizer, not User.** An organizer is a profile layer on top of a user — this separates identity from business role cleanly.
- **`status` on Event.** Organizers create in `draft`, publish explicitly. Admins can flip to `removed`. This state machine is simple enough for MVP with no separate moderation queue table.
- **MVP: no geodata query.** `city` as string for MVP filtering. `latitude`/`longitude` stored but unused until v2 geo-search.

---

## Role-Based Access Control (RBAC) with Auth0 + NestJS

### Auth0 Side

Auth0 issues JWTs. A post-login Action adds the role claim to the token:

```javascript
// Auth0 Action (post-login)
exports.onExecutePostLogin = async (event, api) => {
  const namespace = 'https://exkuala.app';
  api.idToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles ?? []);
  api.accessToken.setCustomClaim(`${namespace}/roles`, event.authorization?.roles ?? []);
};
```

### NestJS Side: Guard Chain

Two guards are applied in sequence:

1. **JwtAuthGuard** — Validates the token signature against Auth0's JWKS endpoint. Uses `passport-jwt` + `jwks-rsa`. Puts decoded payload in `request.user`. Decorating a controller/route with `@Public()` skips this guard.

2. **RolesGuard** — Reads the `@Roles(...roles)` decorator on the route handler. Checks `request.user` claims. Applied globally; does nothing if no `@Roles()` decorator is present.

```typescript
// Pattern: guard chain applied globally in AppModule
// JwtAuthGuard runs first, always
// RolesGuard runs second, skips routes with no @Roles()

// Public routes use @Public() decorator to skip JwtAuthGuard
// Authenticated-but-any-role routes: @UseGuards(JwtAuthGuard) alone
// Role-restricted routes: @UseGuards(JwtAuthGuard) + @Roles('admin')
```

### Access Matrix

| Endpoint | Public | User | Organizer | Admin |
|----------|--------|------|-----------|-------|
| GET /events | READ | READ | READ | READ |
| GET /events/:id | READ | READ | READ | READ |
| POST /events | - | - | OWN | ALL |
| PATCH /events/:id | - | - | OWN | ALL |
| DELETE /events/:id | - | - | OWN | ALL |
| POST /organizers/apply | - | SELF | - | - |
| GET /organizers/applications | - | - | - | ALL |
| PATCH /organizers/:id/approve | - | - | - | ALL |
| PATCH /organizers/:id/reject | - | - | - | ALL |
| POST /rsvp | - | SELF | - | - |
| DELETE /rsvp/:eventId | - | SELF | - | - |
| GET /rsvp/my | - | SELF | - | - |
| PATCH /admin/events/:id/remove | - | - | - | ALL |
| GET /categories | READ | READ | READ | READ |
| POST /categories | - | - | - | ALL |

"OWN" means the guard also checks the authenticated user owns that resource (organizer owns the event).

### Ownership Guard Pattern

For organizer-owned resources, a second check is needed inside the service:

```typescript
// In EventsService.update():
const event = await this.eventsRepo.findOneOrFail({ where: { id } });
if (currentUser.role !== 'admin' && event.organizer.userId !== currentUser.userId) {
  throw new ForbiddenException();
}
```

This is a service-layer ownership check, not a separate guard — keeps guard logic stateless and fast.

---

## API Versioning

Use **URI versioning** via NestJS's built-in versioning: `app.enableVersioning({ type: VersioningType.URI })`.

All routes are prefixed `/api/v1/...`. When breaking changes arrive, `/api/v2/...` controllers can coexist without touching v1 code.

```typescript
// main.ts
app.setGlobalPrefix('api');
app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
```

This means route declarations in controllers use `@Version('1')` or the default applies. No custom header negotiation needed for MVP — URI versioning is simpler to consume and cache.

---

## Component Boundaries

### What Each Component Owns

| Component | Owns | Communicates With |
|-----------|------|-------------------|
| **AuthModule** | JWT validation, RBAC guards, role + user decorators | Used by all modules (imported globally) |
| **UsersModule** | User profile persistence, Auth0 sub→User upsert | AuthModule (reads JWT sub to upsert user) |
| **OrganizersModule** | Organizer application, approval state machine | UsersModule (1:1 relation), EventsModule (organizer → events) |
| **EventsModule** | Event CRUD, publication lifecycle, filtering | OrganizersModule (ownership), CategoriesModule (M:M), RsvpModule (count) |
| **CategoriesModule** | Managed category list, slugs | EventsModule (join table), AdminModule (create/delete) |
| **RsvpModule** | User event interest, RSVP count aggregation | UsersModule, EventsModule |
| **AdminModule** | Thin orchestration of admin operations | OrganizersModule, EventsModule (delegates to their services) |
| **CommonModule** | Global pipes, filters, interceptors | Registered in AppModule globally |

### Communication Rules

- Feature modules export their Service; other modules import the module and inject the Service.
- No direct cross-module repository access.
- AdminModule has no own entities — it delegates entirely to Organizer/EventsService.
- AuthModule is global (`@Global()`) — imported once in AppModule, guards/decorators available everywhere.

---

## Data Flow

### Public Event Discovery (no auth)

```
Client GET /api/v1/events?category=music&date=2026-05-01
  → JwtAuthGuard: skipped (@Public())
  → EventsController.findAll(filters)
  → EventsService.findAll(filters)
      → EventsRepository.findWithFilters()
          → SELECT events JOIN categories WHERE status='published' AND city=... AND ...
  → Response: paginated EventDto[]
```

### Authenticated RSVP

```
Client POST /api/v1/rsvp/:eventId
  → JwtAuthGuard: decode JWT → req.user = { sub, role, email }
  → RolesGuard: no @Roles() — passes (any authenticated user)
  → RsvpController.create(eventId, @CurrentUser() user)
  → RsvpService.create(userId, eventId)
      → UsersService.findOrCreate(user.sub)  ← upsert user on first interaction
      → RsvpRepository: INSERT rsvp (userId, eventId) ON CONFLICT DO NOTHING
  → Response: 201 Created
```

### Organizer Submits Event

```
Client POST /api/v1/events  (JWT: role=organizer)
  → JwtAuthGuard: validates JWT
  → RolesGuard: @Roles('organizer','admin') — passes
  → EventsController.create(@CurrentUser() user, @Body() dto)
  → EventsService.create(user, dto)
      → OrganizersService.findByUserId(user.sub) → get organizer record
      → verify organizer.status === 'approved' (else 403)
      → EventsRepository.save(event, status='draft')
  → Response: 201 Created with event id
```

### Admin Approves Organizer

```
Client PATCH /api/v1/admin/organizers/:id/approve  (JWT: role=admin)
  → JwtAuthGuard: validates JWT
  → RolesGuard: @Roles('admin') — passes
  → AdminController.approveOrganizer(id, @CurrentUser() admin)
  → OrganizersService.approve(id, adminUserId)
      → OrganizersRepository: UPDATE organizer SET status='approved', reviewedBy=adminId
      → UsersRepository: UPDATE user SET role='organizer' (sync role)
  → Response: 200 OK
```

---

## Build Order

Dependencies between components create a natural build sequence. Each phase unblocks the next.

### Phase 1: Foundation (unblocks everything)

**Build:** Database config, ORM setup (Prisma or TypeORM), global pipes + filters, API versioning, Swagger setup.

Why first: Every subsequent module needs the ORM and the global infrastructure.

### Phase 2: Auth Infrastructure (unblocks all protected endpoints)

**Build:** `AuthModule` — JWT strategy (JWKS-RSA from Auth0), `JwtAuthGuard`, `RolesGuard`, `@Roles()` + `@Public()` + `@CurrentUser()` decorators. No business logic — pure plumbing.

Why second: No business feature can enforce access control without this. Build it in isolation, test with mock JWTs, then wire into feature modules.

### Phase 3: Users Module (unblocks ownership checks)

**Build:** `User` entity, Auth0 sub → User upsert logic, user profile endpoints. This creates the User rows that every other module references.

Why third: Organizers, RSVPs, and admin audit trails all FK to User.

### Phase 4: Categories Module (unblocks event creation)

**Build:** `Category` entity, admin-only category management endpoints, seed data migration.

Why fourth: Events reference categories. Categories are simple (no complex business logic) and must exist before event creation.

### Phase 5: Organizers Module (unblocks event publishing)

**Build:** Organizer application flow, `OrganizersController` (apply, list applications), Admin approval endpoints, status state machine.

Why fifth: Events need a valid approved Organizer FK. The application/approval flow is also a product-visible feature reviewable in isolation.

### Phase 6: Events Module (core product)

**Build:** Event CRUD (organizers), publication lifecycle (`draft` → `published`), public listing + filtering endpoints, admin moderation (remove/unpublish).

Why sixth: This is the largest module. All dependencies (auth, users, organizers, categories) are in place. Public browsing and organizer management both live here.

### Phase 7: RSVP Module (closes the user loop)

**Build:** RSVP create/delete, user's RSVP list, RSVP count on event responses.

Why seventh: Depends on stable Users + Events modules. Standalone feature with no downstream dependencies.

---

## Public vs Authenticated Endpoint Patterns

### Public (unauthenticated) Endpoints

Mark with `@Public()` custom decorator. JwtAuthGuard skips validation entirely — no token required, no 401 if no token present.

```
GET  /api/v1/events               ← paginated, filtered listing
GET  /api/v1/events/:id           ← event detail (includes RSVP count)
GET  /api/v1/categories           ← category list for filter UI
```

### Authenticated, Any Role

JwtAuthGuard validates token. No `@Roles()` decorator. Token must be present and valid.

```
POST   /api/v1/rsvp/:eventId      ← registered user
DELETE /api/v1/rsvp/:eventId      ← registered user
GET    /api/v1/rsvp/my            ← registered user's events
GET    /api/v1/users/me           ← own profile
PATCH  /api/v1/users/me           ← own profile update
POST   /api/v1/organizers/apply   ← any user can apply to be organizer
```

### Authenticated, Role-Restricted

JwtAuthGuard + `@Roles('organizer')` or `@Roles('admin')`.

```
POST   /api/v1/events                         @Roles('organizer','admin')
PATCH  /api/v1/events/:id                     @Roles('organizer','admin') + ownership check
DELETE /api/v1/events/:id                     @Roles('organizer','admin') + ownership check
PATCH  /api/v1/events/:id/publish             @Roles('organizer','admin') + ownership check

GET    /api/v1/admin/organizers/applications  @Roles('admin')
PATCH  /api/v1/admin/organizers/:id/approve  @Roles('admin')
PATCH  /api/v1/admin/organizers/:id/reject   @Roles('admin')
PATCH  /api/v1/admin/events/:id/remove       @Roles('admin')

POST   /api/v1/categories                     @Roles('admin')
DELETE /api/v1/categories/:id                 @Roles('admin')
```

### Pattern: Soft Public with Optional Auth

For event detail: if the client sends a JWT, include whether the user has RSVPed. If no JWT, omit that field. Implement via `@OptionalJwtAuthGuard` — a variant that resolves `req.user` if a token is present but does not reject requests without one.

```typescript
// EventsController.findOne()
@Get(':id')
@UseGuards(OptionalJwtAuthGuard)  // custom guard: validates if token present, doesn't fail if absent
findOne(@Param('id') id: string, @CurrentUser() user?: JwtPayload) {
  return this.eventsService.findOne(id, user?.sub);
}
```

---

## Scalability Considerations (MVP vs Future)

| Concern | MVP (single city) | V2+ |
|---------|------------------|-----|
| Event filtering | SQL WHERE clauses on indexed city + category + date | PostGIS geo-queries on lat/lng |
| Search | PostgreSQL full-text on title + description | Elasticsearch / Typesense sidecar |
| Image storage | External URL reference only | S3 + CDN upload flow |
| Auth0 role sync | Manual admin API call to update role | Auth0 Machine-to-Machine webhook |
| Caching | None needed at MVP scale | Redis for public event listing |
| Pagination | Offset-based (simple, adequate) | Cursor-based when records exceed 10K |

---

## Sources

- NestJS v11 Documentation — Modules, Guards, Custom Decorators, Versioning: https://docs.nestjs.com
- Auth0 Actions (post-login custom claims): https://auth0.com/docs/customize/actions/flows-and-triggers/login-flow
- Auth0 + NestJS integration pattern using `jwks-rsa` + `passport-jwt`: established pattern, HIGH confidence from official Auth0 NestJS quickstart
- PostgreSQL event schema patterns: based on established event platform conventions (Eventbrite, Sympla API designs), HIGH confidence
