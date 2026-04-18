# Research Summary — Cultural Agenda API

## Recommended Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| ORM | **Prisma** | Schema-first, type-safe, better NestJS patterns than TypeORM; community momentum in 2025 |
| Auth | **passport-jwt + jwks-rsa** | Auth0 uses RS256 rotating keys — JWKS endpoint required, static secrets won't work |
| Caching | **Redis via cache-manager v6 + cache-manager-redis-yet** | For public event listing endpoints; verify adapter versions on npm before install |
| Location | **City string + lat/lng columns (Haversine)** | PostGIS deferred — MVP is single city, no need for spatial extensions yet |
| Images | **External URLs only (v1)** | Skip S3/CDN pipeline; organizers link to their own hosted images |
| Versioning | **URI versioning** (`/api/v1/...`) | `app.enableVersioning({ type: VersioningType.URI })` with global prefix |

## Table Stakes Features

- Public event browsing **without login** (blocking auth kills discovery value)
- Event filtering by category and location (city)
- Event detail page (title, description, date/time, venue, price/ticket link)
- Auth0 JWT authentication for protected routes
- Organizer application + admin approval flow
- Organizer event CRUD (create, edit, delete own events)
- RSVP / express interest (two states: `interested` + `going`)
- Admin moderation (approve/reject organizers, unpublish events)

## Architecture Overview

**7 NestJS modules:** `auth` (global), `users`, `organizers`, `events`, `categories`, `rsvp`, `admin`

**5 core entities:** `User` (auth0Id as identity key), `Organizer` (1:1 with User, status state machine), `Event` (owned by Organizer, status lifecycle), `Category`, `Rsvp` (User × Event join, unique constraint)

**RBAC:** Two-guard chain — `JwtAuthGuard` (JWKS validation) → `RolesGuard` (custom claims). `@Public()` decorator bypasses JWT guard. `OptionalJwtAuthGuard` for soft-public endpoints (event detail shows RSVP status if logged in).

## Build Order (Dependency-Driven)

1. **Foundation** — Prisma setup, schema migrations, ConfigModule, global pipes, Swagger, URI versioning
2. **Auth Infrastructure** — JwtStrategy (jwks-rsa), JwtAuthGuard, RolesGuard, @Public(), @Roles(), OptionalJwtAuthGuard
3. **Users** — User entity, auth0Id upsert on first login (required before RSVP/organizer FK)
4. **Categories** — Seed + manage categories (required before events can be created)
5. **Organizers** — Application + approval state machine, organizer profile
6. **Events** — Public listing + filtering, organizer CRUD, admin moderation, soft delete
7. **RSVP** — Two-state RSVP (interested/going), upsert semantics, capacity guard

## Critical Pitfalls

| # | Pitfall | Prevention |
|---|---------|-----------|
| C1 | Auth0 roles not in JWT | Configure Auth0 post-login Action with namespaced role claim BEFORE writing any guard |
| C2 | JWKS fetched per request | `jwks-rsa` with `cache: true` — one-line fix, commonly missed |
| C3 | No local user sync | Upsert User row in `validate()` on first auth — must exist before RSVP or organizer FK |
| C4 | Organizer state bypassed | Enforce valid transitions in service layer (not just enum column) |
| C5 | Approval race condition | `SELECT ... FOR UPDATE` when admin processes application |
| C6 | RSVP overbooking | Atomic conditional INSERT at DB level, not read-check-write |

## Key Decisions Before Building

1. **Auth0 custom claims namespace** — e.g. `https://exkuala.app/roles` — set in Auth0 Action AND hardcoded in JwtStrategy; must agree before Phase 2
2. **ORM = Prisma** — confirmed; shapes entity definitions in all subsequent modules
3. **Soft delete from day one** — add `deletedAt` to Event in first migration; retrofitting requires updating every query
4. **Cursor-based pagination** — build into first event listing endpoint; changing later breaks API consumers
5. **Image strategy = external URLs** — no S3 pipeline in v1

---
*Synthesized: 2026-04-18*
