# Domain Pitfalls

**Domain:** Cultural Agenda / Events Discovery Platform API
**Stack:** NestJS + PostgreSQL + Auth0
**Researched:** 2026-04-18
**Confidence:** HIGH (well-documented technology intersection; specific to this domain)

---

## Critical Pitfalls

Mistakes that cause rewrites, security holes, or data corruption.

---

### Pitfall C1: Auth0 Roles Not in JWT — Guard Always Denies or Always Permits

**What goes wrong:** NestJS guards read roles from the JWT payload. Auth0 does NOT include custom roles/permissions in the access token by default. Teams write `@Roles('organizer')` guards, find them always fail, then temporarily bypass auth to "debug", or worse — hardcode a workaround that bypasses the check entirely.

**Why it happens:** Auth0 access tokens contain `sub`, `iss`, `aud`, and standard claims. Custom roles live in Auth0's management layer. They only appear in the token if you add an Auth0 Action (post-login Action) that injects them as a custom namespace claim (e.g., `https://exkuala.com/roles`).

**Consequences:**
- If roles are absent and guard is permissive → any authenticated user can act as organizer/admin
- If guard throws on missing claim → all role-protected routes 403 for everyone
- Namespace mismatch between Action and guard code causes silent failures

**Prevention:**
1. Create an Auth0 post-login Action that injects roles into the token under a namespaced claim:
   ```
   event.accessToken.setCustomClaim('https://exkuala.com/roles', event.authorization.roles);
   ```
2. In NestJS, read `user['https://exkuala.com/roles']` — never `user.roles` (that claim won't exist)
3. Write an integration test that decodes a real Auth0 test token and asserts the claim path before writing guards
4. Use `@nestjs/passport` `PassportStrategy` with `jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken()` and JWKS endpoint, not a static secret

**Warning signs:**
- Guards work in unit tests (mocked token) but fail in e2e with real Auth0 tokens
- Role guards pass for all users regardless of their Auth0 role
- `user.roles` is `undefined` in logged output

**Phase:** Auth & Identity foundation phase (first implementation phase)

---

### Pitfall C2: JWKS Public Key Fetched on Every Request — Production Latency Spike

**What goes wrong:** `passport-jwt` configured with `secretOrKeyProvider` using `jwks-rsa` without caching. Every authenticated request hits `https://YOUR_DOMAIN.auth0.com/.well-known/jwks.json` to fetch the signing key. Under load this adds 100-400ms per request, and if Auth0 has a brief outage, your entire API becomes unauthenticated.

**Why it happens:** Developers copy quickstart code without reading the `cache: true` and `rateLimit: true` options on `jwks-rsa`.

**Consequences:**
- Production latency doubles under authenticated load
- Auth0 rate-limits your JWKS fetch requests → 429 errors → authentication failures cascade
- Outage coupling: Auth0 blip = your API down for all authenticated users

**Prevention:**
```typescript
// In JwtStrategy constructor
passportJwtSecret({
  cache: true,
  rateLimit: true,
  jwksRequestsPerMinute: 5,
  jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
})
```
Always set `cache: true`. Keys rotate rarely; caching is safe.

**Warning signs:**
- Auth-protected endpoints are consistently 200-400ms slower than public endpoints
- Auth0 dashboard shows high JWKS endpoint traffic
- Flaky auth failures under load testing

**Phase:** Auth & Identity foundation phase

---

### Pitfall C3: `sub` Claim Used as User Identity Without Local User Record Sync

**What goes wrong:** Auth0's `sub` claim (e.g., `auth0|64abc...`) is treated as the sole user identifier, with no local `users` table row. When you need to store RSVP records, organizer associations, or preferences, there's no foreign key target. Teams scramble to retrofit a sync mechanism late in development.

**Why it happens:** "Auth0 manages users" is true for auth, but false for application data. The application needs its own user record the moment it stores anything user-specific.

**Consequences:**
- RSVPs, organizer applications, event ownership — all require a local user row
- Retrofitting user sync after RSVP table exists requires data migration
- Without sync, the `users` table gets populated lazily with gaps — some users have records, some don't, causing null-reference bugs

**Prevention:**
1. On every successful login (JWT validation), upsert a local user record keyed on `sub`:
   ```typescript
   await userRepo.upsert({ auth0Id: payload.sub, email: payload.email }, ['auth0Id']);
   ```
2. Use `auth0Id` as the join key in all relational tables, never use the UUID from Auth0 as your own PK
3. Implement this in the JWT guard's `validate()` method — it runs on every authenticated request, making it the natural sync point
4. Store `email` from the token for display, but treat `sub` as the canonical identity

**Warning signs:**
- RSVP or organizer tables have `userId` columns with no corresponding FK
- "User not found" errors appear in logs for authenticated requests
- E2E tests work but real users get 404s on profile-related endpoints

**Phase:** Auth & Identity foundation phase (before any user-specific data features)

---

### Pitfall C4: Organizer State Machine Bypassed by Direct DB Updates

**What goes wrong:** The organizer approval workflow has states: `PENDING → APPROVED | REJECTED`. Direct repository `.save()` calls allow invalid transitions (e.g., `APPROVED → PENDING`, or `REJECTED → APPROVED` by re-applying). No validation on the transition itself.

**Why it happens:** State is stored as an enum column, but the service layer treats it as a simple field to set, not as a state machine. Any code path can set any value.

**Consequences:**
- Admin approves an organizer, organizer re-submits application, status flips back to `PENDING` — events go unpublished mid-run
- Rejected organizers can be "re-approved" via a bug or direct API call without re-review
- Audit log is meaningless if state can move backwards without a transition record

**Prevention:**
1. Enforce transitions in the service layer — never expose raw state-setting to controllers:
   ```typescript
   // OrganizerService
   async approve(id: string, adminId: string): Promise<void> {
     const organizer = await this.findOrFail(id);
     if (organizer.status !== OrganizerStatus.PENDING) {
       throw new ConflictException('Only pending applications can be approved');
     }
     organizer.status = OrganizerStatus.APPROVED;
     await this.repo.save(organizer);
   }
   ```
2. Valid transitions table (document this):
   - `PENDING → APPROVED` (admin action)
   - `PENDING → REJECTED` (admin action)
   - `REJECTED → PENDING` only if you allow reapplication (make it explicit)
   - `APPROVED` is a terminal state in v1
3. Add a `statusChangedAt` timestamp column and `statusChangedBy` (admin userId) for audit

**Warning signs:**
- Organizer status can be set directly via a `PATCH /organizers/:id` with `{ "status": "approved" }` without admin guard
- No validation on status transitions in service layer
- Status can go `APPROVED → PENDING`

**Phase:** Organizer workflow phase

---

### Pitfall C5: Race Condition on Organizer Approval — Double-Approval by Two Admins

**What goes wrong:** Two admins simultaneously approve/reject the same organizer application. Both read `PENDING`, both write `APPROVED` (or one writes `APPROVED`, one writes `REJECTED`). The last write wins, leaving the audit trail inconsistent.

**Why it happens:** No optimistic locking or database-level serialization on the transition.

**Consequences:**
- Two approval emails sent; organizer confused
- Conflicting audit log entries
- If one admin approved and another rejected concurrently, the final state depends on write order — non-deterministic

**Prevention:**
1. Use PostgreSQL optimistic locking via `@VersionColumn()` (TypeORM) or `version` field (Prisma with `update where version = X`)
2. Alternatively, use a `SELECT ... FOR UPDATE` pattern to serialize the read-check-write:
   ```sql
   BEGIN;
   SELECT * FROM organizers WHERE id = $1 FOR UPDATE;
   -- validate PENDING, then update
   UPDATE organizers SET status = 'APPROVED' WHERE id = $1 AND status = 'PENDING';
   COMMIT;
   ```
3. The `AND status = 'PENDING'` clause in the UPDATE is the safety net — if 0 rows updated, the transition already happened; throw `ConflictException`

**Warning signs:**
- Approval endpoint has no transaction boundary
- Two simultaneous approval requests both return 200
- Duplicate status-change audit log entries for the same organizer

**Phase:** Organizer workflow phase

---

### Pitfall C6: RSVP Capacity Not Enforced Atomically — Overbooking

**What goes wrong:** RSVP logic reads current attendee count, compares to `event.capacity`, and inserts the RSVP if count < capacity. Under concurrent load, multiple requests read the same count (e.g., 99 of 100), all pass the check, all insert — event ends up with 105 RSVPs for a 100-person venue.

**Why it happens:** Read-check-write on capacity is not atomic. Classic TOCTOU (Time Of Check, Time Of Use) race condition.

**Consequences:**
- Events with hard venue capacity limits are overbooked
- Organizers lose trust in the platform
- Compensating for overbooking (cancelling RSVPs) is operationally painful and reputation-damaging

**Prevention:**
1. Use a database-level counter with a constraint — never check in application code alone:
   ```sql
   -- Option A: Conditional INSERT with count subquery
   INSERT INTO rsvps (event_id, user_id)
   SELECT $1, $2
   WHERE (SELECT COUNT(*) FROM rsvps WHERE event_id = $1) < (SELECT capacity FROM events WHERE id = $1);
   -- Check affected rows: 0 = sold out, 1 = success
   ```
2. Or use PostgreSQL `FOR UPDATE` on the event row inside a transaction to serialize capacity checks
3. Add a partial unique index to prevent duplicate RSVPs:
   ```sql
   CREATE UNIQUE INDEX uq_rsvp_event_user ON rsvps(event_id, user_id);
   ```
4. For events without capacity limits (null capacity), skip the check entirely — don't default `capacity` to 0

**Warning signs:**
- RSVP service reads count then inserts in two separate statements without a transaction
- Load test at capacity shows > capacity RSVPs inserted
- No unique constraint on `(event_id, user_id)`

**Phase:** RSVP feature phase

---

## Moderate Pitfalls

Mistakes that cause bugs, performance issues, or poor developer experience — fixable without full rewrites.

---

### Pitfall M1: Event Timestamps Stored Without Timezone — Broken "Upcoming Events" Filtering

**What goes wrong:** `event.startDate` is stored as PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` (or JavaScript `Date` serialized without timezone). Events created by organizers in one timezone appear at the wrong time to users in another — or worse, "upcoming events" queries using `WHERE start_date > NOW()` use the server's local time, not UTC.

**Why it happens:** JavaScript `Date`, TypeORM's `@Column('timestamp')`, and Prisma's `DateTime` all behave differently. Developers assume they're all UTC; they're often not.

**Consequences:**
- An event at "8PM Saturday" shows as "3AM Sunday" for users in a different timezone
- `upcoming events` filter misses events or includes past events depending on server timezone
- Daylight saving time transitions break recurring-seeming patterns

**Prevention:**
1. Always store as `TIMESTAMPTZ` (PostgreSQL `TIMESTAMP WITH TIME ZONE`):
   - TypeORM: `@Column({ type: 'timestamptz' })`
   - Prisma: `DateTime` type maps to `TIMESTAMPTZ` by default — verify in generated SQL
2. PostgreSQL server timezone: set `timezone = 'UTC'` in `postgresql.conf` or verify it's UTC
3. Always accept event times from organizers as ISO 8601 with explicit offset (e.g., `2026-07-15T20:00:00+01:00`), store as UTC, return as UTC
4. For display, let the client handle timezone conversion — the API serves UTC only
5. Test with a NestJS app running in a non-UTC timezone to catch implicit local-time assumptions

**Warning signs:**
- Column type is `timestamp` not `timestamptz` in migration files
- Event dates look correct in development (machine is UTC) but wrong in staging (machine has local tz)
- "Upcoming events" count changes depending on what time of day you query

**Phase:** Events CRUD phase (column type must be correct at creation; changing later requires migration)

---

### Pitfall M2: N+1 Queries on Event Listings with Organizer/Category Data

**What goes wrong:** `GET /events` returns a list of 20 events. For each event, the controller or serializer accesses `event.organizer.name` — triggering 20 additional SELECT queries. With categories/tags as a separate join, it becomes 40+ extra queries per request.

**Why it happens:** Lazy loading is the default in TypeORM. Developers don't notice in development (small datasets, fast local DB) but it hammers production under real data volumes.

**Consequences:**
- A public endpoint that should be < 50ms takes 400-800ms under load
- Database connection pool exhausted under moderate traffic (20 concurrent users = 400+ queries)
- Caching helps but doesn't fix the underlying query count

**Prevention:**
1. Always eager-load relations for list endpoints using explicit joins:
   - TypeORM: `find({ relations: ['organizer', 'categories'] })` or QueryBuilder with `.leftJoinAndSelect()`
   - Prisma: `include: { organizer: true, categories: true }`
2. Write a query counter assertion in integration tests: assert that `GET /events` executes ≤ 3 queries regardless of result count
3. For TypeORM: disable lazy loading globally or at the entity level (`{ lazy: false }`) — opt-in to eager on specific queries
4. For public event listing, consider a single query that returns a flat projection (no ORM magic) for maximum performance

**Warning signs:**
- Test DB logs show N queries for a list endpoint where N scales with result count
- Response time for `GET /events?limit=50` is proportional to 50
- TypeORM `EAGER: true` used inconsistently on relation definitions

**Phase:** Events listing/discovery phase

---

### Pitfall M3: Missing Database Indexes on Event Filtering Columns

**What goes wrong:** `GET /events?category=music&dateFrom=2026-07-01&dateTo=2026-07-31` runs a sequential scan on the `events` table as it grows. With 1,000 events this is invisible. At 10,000+ events it becomes a 200ms+ query.

**Why it happens:** Indexes are added reactively (after performance complaints) rather than proactively at schema design time.

**Consequences:**
- Public discovery endpoint degrades as content grows — the core product feature breaks under scale
- Sequential scans on large tables under concurrent load cause lock contention
- EXPLAIN ANALYZE reveals table scans that should be index scans

**Prevention — index these columns at schema creation:**
```sql
-- Single-column indexes for individual filters
CREATE INDEX idx_events_status ON events(status);           -- only PUBLISHED events served
CREATE INDEX idx_events_start_date ON events(start_date);   -- date range filtering
CREATE INDEX idx_events_organizer_id ON events(organizer_id);

-- Composite for the common query pattern
CREATE INDEX idx_events_status_start_date ON events(status, start_date)
  WHERE status = 'PUBLISHED';  -- partial index: only published events in index

-- For category filtering (if many-to-many junction table)
CREATE INDEX idx_event_categories_category_id ON event_categories(category_id);
CREATE INDEX idx_event_categories_event_id ON event_categories(event_id);
```

**Warning signs:**
- No `CreateIndex` statements in migration files
- EXPLAIN ANALYZE shows `Seq Scan` on events table for filtered queries
- Filter query time scales linearly with table row count

**Phase:** Events schema/database phase (create indexes in the same migration as the table)

---

### Pitfall M4: Organizer Can Edit/Publish Events Without Ownership Check

**What goes wrong:** `PUT /events/:id` and `DELETE /events/:id` check that the request is from an organizer (role guard passes), but do NOT verify that the organizer owns the event. Any approved organizer can edit or delete any other organizer's events.

**Why it happens:** Role guard (`@Roles('organizer')`) is confused with ownership guard. They are different concerns.

**Consequences:**
- Critical data integrity violation — organizers can sabotage each other's events
- This is an IDOR (Insecure Direct Object Reference) vulnerability — a security flaw, not just a bug

**Prevention:**
1. Always fetch the event AND verify `event.organizerId === currentUser.organizerId` before mutation:
   ```typescript
   async updateEvent(eventId: string, dto: UpdateEventDto, requestingOrganizer: Organizer) {
     const event = await this.eventRepo.findOneOrFail({ where: { id: eventId } });
     if (event.organizerId !== requestingOrganizer.id) {
       throw new ForbiddenException('You do not own this event');
     }
     // proceed with update
   }
   ```
2. Never rely on `WHERE id = :eventId` alone for organizer mutations — always add `AND organizer_id = :organizerId`
3. Write an e2e test: organizer A tries to delete organizer B's event — assert 403

**Warning signs:**
- No ownership check in event update/delete service methods
- Guard only checks role, not ownership
- Missing e2e test for cross-organizer access attempts

**Phase:** Events CRUD phase

---

### Pitfall M5: Pagination Implemented with OFFSET — Degrades at Scale

**What goes wrong:** `GET /events?page=1&limit=20` uses `OFFSET (page-1)*limit` SQL. Page 1 is fast. Page 500 requires PostgreSQL to scan and discard 9,980 rows before returning 20. For a discovery platform with thousands of events, deep pagination becomes unusable.

**Why it happens:** OFFSET pagination is the intuitive first implementation and works fine in development.

**Consequences:**
- "Load more" or infinite scroll features break at scale
- Admin tools paginating through all events freeze at large offsets
- Inconsistent results if events are inserted between page requests (items skipped or duplicated)

**Prevention:**
1. Use cursor-based (keyset) pagination for all list endpoints from day one:
   ```
   GET /events?after=<cursor>&limit=20
   -- cursor encodes: { id, start_date } of the last item
   -- Query: WHERE (start_date, id) > (cursor.start_date, cursor.id) ORDER BY start_date, id LIMIT 20
   ```
2. Return a `nextCursor` in the response envelope — never expose raw DB IDs as cursors (encode them)
3. Only use OFFSET for admin endpoints where deep pagination is rare and dataset is bounded

**Warning signs:**
- `SKIP` / `OFFSET` in query builder for public endpoints
- Response time for `?page=50` is measurably slower than `?page=1`
- No `cursor` or `nextCursor` field in event list responses

**Phase:** Events listing/discovery phase (retrofit is painful; design the response envelope correctly from the start)

---

### Pitfall M6: Auth Guard Applied Globally with Wrong Default — Breaks Public Browse

**What goes wrong:** `APP_GUARD` registered globally with `JwtAuthGuard` to "protect everything by default." Public event listing (`GET /events`, `GET /events/:id`) now requires authentication. Unauthenticated browsers can't discover events — the core product proposition is broken.

**Why it happens:** Global guard is a convenient security default, but this domain requires a mixed model: some endpoints are public, some require auth, some require roles.

**Consequences:**
- Public traffic can't browse events without logging in — destroys discovery funnel
- Workaround of adding `@Public()` decorator to every public endpoint is fragile (easy to forget on new endpoints)

**Prevention:**
1. Do NOT use a global auth guard that requires authentication by default
2. Instead, use a global guard that is permissive by default — only enforces auth when `@UseGuards(JwtAuthGuard)` or `@Roles(...)` is explicitly applied
3. Alternatively, use the `@Public()` decorator pattern but document it clearly and add a lint rule or test that verifies all non-decorated routes are intentionally public
4. Design the guard to distinguish: no auth token = anonymous user (allowed for public routes); bad auth token = 401 (reject tampered tokens even on public routes)

**Warning signs:**
- `APP_GUARD` with `JwtAuthGuard` in `AppModule` providers
- `GET /events` returns 401 without a token
- Public Postman/curl requests fail after adding global guard

**Phase:** Auth & Identity foundation phase

---

### Pitfall M7: Events Published Without Validation — Incomplete/Malformed Events Go Live

**What goes wrong:** An organizer creates an event in `DRAFT` status, then calls `POST /events/:id/publish`. The publish endpoint does not re-validate that the event has all required fields (title, start_date, location, at least one category). A published event with null location or past start_date appears in public listings.

**Why it happens:** DTO validation catches bad data on create/update, but publish is a state transition that doesn't re-run those validations.

**Consequences:**
- Malformed events appear in public discovery
- Events with past dates pollute "upcoming events" feed
- Frontend breaks on null fields it doesn't guard against

**Prevention:**
1. Add a `validateForPublishing(event)` method called before the `DRAFT → PUBLISHED` transition:
   - Title is non-empty
   - `startDate` is in the future
   - Location (venue name or address) is set
   - At least one category assigned
2. Return a descriptive 422 Unprocessable Entity with a list of validation failures
3. Consider returning these validation errors during draft saves as warnings (not errors) so organizers see issues before attempting to publish

**Warning signs:**
- Publish endpoint only checks `status === DRAFT`, nothing else
- Events with `start_date` in the past are visible in `GET /events`
- No publish-readiness validation in service layer

**Phase:** Events CRUD + publishing phase

---

## Minor Pitfalls

### Pitfall m1: API Version Not Set — Breaking Changes Are Breaking

**What goes wrong:** No API versioning from the start. When the frontend requires a breaking change (field renamed, response shape changed), there's no way to release incrementally.

**Prevention:** Use NestJS built-in versioning from day one:
```typescript
app.enableVersioning({ type: VersioningType.URI });
// Routes become /v1/events, /v1/organizers, etc.
```
Even if v2 never ships, the pattern communicates stability to API consumers.

**Phase:** Project setup phase (before first endpoint)

---

### Pitfall m2: Organizer Profile Mixed with Organizer Application — Confusing State

**What goes wrong:** The `organizers` table stores both the application (pending/rejected state, application reason) and the ongoing profile (name, description, contact). Rejected applications leave orphaned partial profiles. Re-applications create new rows with old profile data lost.

**Prevention:** Separate concerns:
- `organizer_applications` table: `status`, `applied_at`, `reviewed_by`, `review_notes`
- `organizer_profiles` table: `name`, `description`, `contact`, `created_at` — only exists after approval
- One-to-one relationship between user and organizer_profile (only approved organizers have this)

**Phase:** Schema design phase (hard to separate later)

---

### Pitfall m3: Soft Delete Not Implemented — Deleted Events Break RSVP History

**What goes wrong:** Hard-deleting an event (`DELETE FROM events WHERE id = $1`) removes the row. All RSVP records pointing to that event become orphaned (FK violation if CASCADE is off, silent nulls if CASCADE is on). Users lose their event history.

**Prevention:**
1. Use soft delete: add `deleted_at TIMESTAMPTZ` column; mark deleted rather than remove
2. Add a default scope that excludes soft-deleted events from all queries: `WHERE deleted_at IS NULL`
3. Create a partial index on `deleted_at IS NULL` to keep queries fast
4. TypeORM: use `@DeleteDateColumn()` with `softDelete()`; Prisma: manage manually

**Phase:** Events CRUD phase (add from the start; retrofitting soft delete changes all queries)

---

### Pitfall m4: Missing `status` Filter on Public Event Listing — Draft Events Leak

**What goes wrong:** `GET /events` returns all events including `DRAFT` and organizer-only-visible ones. Unauthenticated users see organizer drafts.

**Prevention:**
- Always apply `WHERE status = 'PUBLISHED' AND deleted_at IS NULL` on public listing queries
- Create a query scope/helper: `EventRepository.publicQuery()` that always applies these filters — never write the filter inline, always use the scope

**Phase:** Events listing phase

---

### Pitfall m5: RSVP Toggle Not Idempotent — Double-RSVP Errors Surfaced to Client

**What goes wrong:** User clicks "RSVP" twice (double-tap, network retry). Second request throws a `UniqueConstraintViolation` from the DB that propagates as a 500 to the client.

**Prevention:**
1. Use `INSERT ... ON CONFLICT DO NOTHING` (or ORM equivalent) for RSVP creation
2. Return 200/201 regardless — RSVP exists either way
3. Same for RSVP cancellation: `DELETE WHERE event_id = X AND user_id = Y` — if 0 rows deleted, still return 200

**Phase:** RSVP feature phase

---

## Phase-Specific Warnings

| Phase | Likely Pitfall | Mitigation |
|-------|---------------|------------|
| Project setup | No API versioning (m1) | `app.enableVersioning()` before first route |
| Auth & Identity | Roles not in JWT (C1) | Auth0 Action for custom claims before writing any guard |
| Auth & Identity | JWKS fetched per request (C2) | `cache: true` in `jwks-rsa` config |
| Auth & Identity | No local user record sync (C3) | Upsert in `validate()` before RSVP/organizer features |
| Auth & Identity | Global guard breaks public browse (M6) | Design guard strategy before applying to any route |
| Schema design | Timestamp without timezone (M1) | Use `timestamptz` in all migrations; verify ORM column type |
| Schema design | Missing indexes (M3) | Add composite/partial indexes in same migration as table |
| Schema design | Organizer profile mixed with application (m2) | Separate tables from the start |
| Schema design | No soft delete (m3) | `deleted_at` column from first migration |
| Events CRUD | Ownership not verified (M4) | Ownership check in every mutation service method |
| Events CRUD | Draft events leak to public (m4) | `EventRepository.publicQuery()` scope |
| Events CRUD | Publish without validation (M7) | `validateForPublishing()` before state transition |
| Events listing | N+1 queries (M2) | Eager load in all list queries; query count assertion in tests |
| Events listing | OFFSET pagination (M5) | Cursor-based pagination from first implementation |
| Organizer workflow | State machine bypassed (C4) | Enforce transitions in service, not controller |
| Organizer workflow | Race condition on approval (C5) | `FOR UPDATE` or optimistic locking in approval transaction |
| RSVP | Overbooking (C6) | Atomic capacity check in DB, not application layer |
| RSVP | Double-RSVP 500 errors (m5) | `ON CONFLICT DO NOTHING`, idempotent endpoints |

---

## Sources

- NestJS official documentation — Authentication, Authorization, Guards (training data, HIGH confidence)
- Auth0 documentation — Custom Claims, Actions, JWKS, Access Tokens (training data, HIGH confidence)
- PostgreSQL documentation — TIMESTAMPTZ, FOR UPDATE, partial indexes (training data, HIGH confidence)
- Known IDOR patterns in REST APIs — OWASP API Security Top 10 (training data, HIGH confidence)
- TypeORM / Prisma relation loading behavior — documented lazy-load default (training data, HIGH confidence)

**Confidence by area:**

| Area | Confidence | Basis |
|------|------------|-------|
| Auth0 + NestJS integration | HIGH | Specific, well-documented integration; custom claims pattern is the canonical Auth0 approach |
| Organizer state machine / race conditions | HIGH | Standard concurrency patterns in PostgreSQL; not domain-specific |
| N+1 queries | HIGH | TypeORM lazy-load default is definitively documented |
| Timezone handling | HIGH | PostgreSQL TIMESTAMPTZ behavior is definitively documented |
| RSVP capacity atomicity | HIGH | Classic TOCTOU pattern; PostgreSQL atomic INSERT with subquery is standard |
| API versioning, pagination | HIGH | NestJS built-in versioning; cursor pagination is well-established pattern |
| Schema design separations | MEDIUM | Opinionated based on common refactor pain points; not a single canonical source |
