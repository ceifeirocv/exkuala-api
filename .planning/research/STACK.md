# Technology Stack

**Project:** Exkuala API — Cultural Agenda / Events Discovery Platform
**Researched:** 2026-04-18
**Base context:** NestJS 11.0.1 + TypeScript 5.7 already installed (confirmed from package.json)

---

## Recommended Stack

### Core Framework (already installed)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| NestJS | ^11.0.1 | HTTP framework, DI container, module system | Already chosen; v11 is current stable with full ESM support |
| TypeScript | ^5.7.3 | Type safety | Already installed; 5.7 is current stable |
| @nestjs/platform-express | ^11.0.1 | HTTP adapter | Express ecosystem compatibility; broader middleware support than Fastify for this domain |

### ORM: Prisma (recommended over TypeORM and Drizzle)

**Recommendation: Prisma 6.x**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| prisma | ^6.0.0 | CLI, schema management, migrations | Schema-first with declarative migrations |
| @prisma/client | ^6.0.0 | Generated type-safe query client | Auto-generated from schema; full TypeScript inference |

**Why Prisma over TypeORM:**

TypeORM is the historic NestJS default but has accumulated significant debt: inconsistent TypeScript types, decorator-heavy API that fights with strict TypeScript, slow migration generation, and maintenance that has lagged behind. In 2024-2025 the NestJS community has shifted decisively toward Prisma. Prisma's schema-first approach means the database schema is the single source of truth, migrations are deterministic, and the query client is fully type-safe with no decorator magic.

**Why Prisma over Drizzle:**

Drizzle is excellent for performance-critical, query-heavy workloads where you want SQL-adjacent syntax. For a cultural events platform with a moderate query load, Prisma's superior DX, studio GUI (useful during organizer data debugging), and richer NestJS integration guides tip the balance. Drizzle also lacks Prisma's built-in migration history management, which matters when you have a schema evolving across organizer approval flows and event status transitions.

**NestJS integration pattern:**

```typescript
// prisma.module.ts — singleton PrismaClient as a NestJS provider
import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }
}
```

Use `PrismaService` injected into repository/service classes. Do NOT use the unofficial `nestjs-prisma` package — it adds indirection without value; the manual pattern above is idiomatic NestJS.

**Confidence: MEDIUM** — Prisma v6 released late 2024. Version pin `^6.0.0` should be verified against `https://www.npmjs.com/package/prisma` before installation to confirm latest patch.

---

### Database: PostgreSQL with city-scoped location filtering

**Recommendation: PostgreSQL 16+ with lat/lng columns + city string — NO PostGIS for MVP**

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| PostgreSQL | 16+ | Primary database | Already chosen |
| Haversine formula (SQL) | — | Proximity radius queries | Pure SQL, no extension needed for MVP |

**Location strategy decision — city-based + optional proximity radius:**

The PROJECT.md explicitly scopes MVP to a single city/region. Given this constraint:

- Store `latitude FLOAT`, `longitude FLOAT`, `city VARCHAR`, `venue_address TEXT` on events
- Filter by city string for the common case (fastest, indexable)
- For "events near me" radius queries, use Haversine formula in a Prisma raw query
- PostGIS adds operational complexity (extension install, spatial indexes, geometry types) that is not justified until the platform is multi-city and needs true geospatial routing

**When to add PostGIS (v2+):** Multi-city expansion, polygon-based neighborhood filtering, or distance sorting across large datasets. Flag this as a deferred decision.

**Haversine raw query example (via Prisma):**

```typescript
// Filter events within N km of a lat/lng
const events = await this.prisma.$queryRaw<Event[]>`
  SELECT *, (
    6371 * acos(
      cos(radians(${lat})) * cos(radians(latitude)) *
      cos(radians(longitude) - radians(${lng})) +
      sin(radians(${lat})) * sin(radians(latitude))
    )
  ) AS distance_km
  FROM events
  WHERE status = 'published'
  HAVING distance_km < ${radiusKm}
  ORDER BY distance_km
`;
```

**Confidence: HIGH** — City-string + lat/lng is the established pattern for single-region MVP. PostGIS deferral is architecturally sound.

---

### Authentication: Auth0 JWT Validation

**Recommendation: @nestjs/passport + passport-jwt + jwks-rsa**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @nestjs/passport | ^11.0.0 | Passport integration for NestJS | Official NestJS module; strategy-based auth |
| passport | ^0.7.0 | Strategy runner | Peer dep of passport-jwt |
| passport-jwt | ^4.0.1 | JWT Bearer extraction and validation | Industry standard for JWT strategies |
| jwks-rsa | ^3.1.0 | Fetches Auth0 public keys from JWKS endpoint | Auth0 uses RS256 with rotating keys — JWKS is mandatory |
| @nestjs/jwt | ^11.0.0 | JWT utilities for token generation | Optional; only needed if API ever issues its own tokens (not for Auth0-only) |

**Why this combination:**

Auth0 issues RS256-signed JWTs. You cannot validate these with a static shared secret — you must fetch the public key from Auth0's JWKS endpoint (`https://<your-tenant>.auth0.com/.well-known/jwks.json`). The `jwks-rsa` library handles key fetching and caching automatically. Combined with `passport-jwt`, you register a `JwtStrategy` that validates every incoming Bearer token against Auth0's public keys.

**Do NOT use:** `@auth0/nextjs-auth0` (frontend SDK), or raw `jsonwebtoken` without JWKS support (breaks with key rotation), or the deprecated `express-jwt` middleware.

**JwtStrategy pattern:**

```typescript
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      audience: process.env.AUTH0_AUDIENCE,
      issuer: `https://${process.env.AUTH0_DOMAIN}/`,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, roles: payload['https://exkuala.com/roles'] };
  }
}
```

**Public endpoints:** Use `@Public()` decorator pattern with a `JwtAuthGuard` that skips if decorated. This allows unauthenticated event browsing without per-route bypass gymnastics.

**Role extraction:** Auth0 custom claims (namespaced, e.g. `https://exkuala.com/roles`) inject roles into the JWT payload. Extract in `validate()` and attach to the request user object. Build a `RolesGuard` that reads `req.user.roles` for organizer/admin endpoints.

**Confidence: HIGH** — This is the canonical Auth0 + NestJS pattern. `jwks-rsa` + `passport-jwt` is the production-proven combination. Verify `@nestjs/passport` v11 compatibility since the project is on NestJS 11.

---

### Caching: NestJS Cache Manager + Redis

**Recommendation: @nestjs/cache-manager + cache-manager-redis-yet (Redis adapter)**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @nestjs/cache-manager | ^3.0.0 | NestJS cache module | Official NestJS caching integration |
| cache-manager | ^6.0.0 | Core cache abstraction | Required peer dep of @nestjs/cache-manager |
| cache-manager-redis-yet | ^5.0.0 | Redis store adapter | Most actively maintained Redis adapter for cache-manager v6 |
| ioredis | ^5.3.0 | Redis client (peer dep) | Industry standard Redis client |

**Why Redis and not in-memory:**

Public event listing endpoints (GET /events with filters) are the highest-traffic, lowest-change endpoints. In-memory caching works per-process and evaporates on restart. Redis gives you persistent, process-independent cache that survives deploys and scales horizontally. For a cultural events platform, event listings change infrequently (organizers publish, admins approve) relative to how often they are read.

**Caching strategy:**

- Cache public `GET /events` responses by query fingerprint (city + category + date range + page) with TTL of 5 minutes
- Cache individual `GET /events/:id` with TTL of 10 minutes
- Invalidate on event publish, update, or admin moderation action
- Do NOT cache authenticated endpoints (RSVP state is user-specific)

**@nestjs/cache-manager v3 breaking note:** NestJS cache-manager v3 requires `cache-manager` v6 which changed its API significantly from v4/v5. Use `cache-manager-redis-yet` NOT the older `cache-manager-ioredis` package which targets cache-manager v4.

**Confidence: MEDIUM** — The cache-manager v5/v6 ecosystem had churn in 2023-2024. Version numbers should be cross-checked against npm before installation. The pattern is correct; exact versions may need pinning.

---

### File/Image Storage: Cloudinary or S3-compatible (deferred to feature phase)

**Recommendation: Cloudinary SDK for MVP, S3 for scale**

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| cloudinary | ^2.0.0 | Image upload, transformation, CDN delivery | Free tier sufficient for MVP; built-in image optimization and resizing |
| multer | ^1.4.5-lts.1 | Multipart form handling | Already available via @nestjs/platform-express |
| @types/multer | ^1.4.x | Type definitions | Dev dep |

**Why Cloudinary for MVP:**

Event images need resize/crop for thumbnails (event card), medium (event detail), and og-image variants. Cloudinary handles transformation via URL params without any server-side processing. The free tier (25 credits/month) is sufficient for an early-stage cultural platform. Upload flow: client POSTs image to API → API uploads to Cloudinary → stores returned `public_id` + `secure_url` in the event record.

**When to switch to S3:** When Cloudinary costs exceed budget or you need full control over storage. At that point, add `@aws-sdk/client-s3` and a pre-signed URL upload strategy.

**What NOT to do:** Store images as blobs in PostgreSQL. Store raw files on the API server filesystem (not portable across deployments).

**Confidence: MEDIUM** — Cloudinary SDK v2.x is current. Pattern is well-established.

---

### Validation & Serialization

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| class-validator | ^0.14.1 | DTO validation decorators | Official NestJS recommendation; integrates with ValidationPipe |
| class-transformer | ^0.5.1 | Serialization, @Exclude(), @Expose() | Pairs with class-validator; controls what gets returned in responses |

Use `useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }))`. The `whitelist: true` flag strips unknown properties — critical for preventing mass-assignment vulnerabilities on event creation endpoints.

**Confidence: HIGH** — This is the canonical NestJS validation approach, unchanged through v11.

---

### Configuration Management

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @nestjs/config | ^4.0.0 | Environment variable management | Official NestJS config module; dotenv integration + typed config |

Use `ConfigModule.forRoot({ isGlobal: true, validate: ... })` with a Joi or class-validator schema to validate required env vars at startup. Fail fast if `AUTH0_DOMAIN`, `AUTH0_AUDIENCE`, or `DATABASE_URL` are missing.

**Confidence: HIGH** — Stable, official module.

---

### API Documentation

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| @nestjs/swagger | ^11.0.0 | OpenAPI spec generation + Swagger UI | Official NestJS module; decorators on DTOs auto-generate spec |
| swagger-ui-express | ^5.0.0 | Serve Swagger UI | Peer dep |

Swagger is not optional overhead for an events platform API — it is the organizer-facing contract and the integration surface for a future mobile app. Auto-generate from DTO decorators. Disable in production or gate behind basic auth.

**Confidence: HIGH** — Stable, official module aligned with NestJS 11.

---

### Testing (already configured)

| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| jest | ^30.0.0 | Unit/integration testing | Already installed |
| @nestjs/testing | ^11.0.1 | NestJS test module | Already installed |
| supertest | ^7.0.0 | E2E HTTP testing | Already installed |

No changes needed. Jest 30 is very recent (late 2024/2025); verify `ts-jest` compatibility at installation time since ts-jest 29 may have lag before Jest 30 support stabilizes.

**Confidence: MEDIUM** — Jest 30 + ts-jest 29 version alignment needs checking. The project may need to pin jest to ^29 or upgrade ts-jest to a v30-compatible release.

---

## Alternatives Considered and Rejected

| Category | Recommended | Alternative | Why Rejected |
|----------|-------------|-------------|--------------|
| ORM | Prisma | TypeORM | Decorator-heavy, poor strict TypeScript compat, slower migration tooling, community momentum has shifted |
| ORM | Prisma | Drizzle | Better for perf-critical SQL-heavy apps; Prisma DX, studio, and NestJS patterns better for this domain |
| Location | lat/lng + city string | PostGIS | Operational overhead unjustified for single-region MVP; revisit at multi-city expansion |
| Auth | passport-jwt + jwks-rsa | Raw jsonwebtoken | No JWKS support = breaks with Auth0 key rotation |
| Auth | passport-jwt + jwks-rsa | @nestjs/jwt alone | @nestjs/jwt is for issuing tokens; Auth0 is the issuer, not the API |
| Cache | Redis (cache-manager) | In-memory | Per-process, evaporates on restart, doesn't scale |
| Cache | cache-manager-redis-yet | cache-manager-ioredis | Targets old cache-manager v4 API, unmaintained |
| Images | Cloudinary | PostgreSQL BLOBs | Performance disaster, no CDN, no transformation |
| Images | Cloudinary | Server filesystem | Not portable, lost on redeploy, no CDN |
| HTTP adapter | Express (platform-express) | Fastify (platform-fastify) | Express has wider middleware compatibility; multer support is simpler; no raw performance need at MVP scale |

---

## Installation Order

```bash
# 1. ORM
npm install prisma @prisma/client
npx prisma init --datasource-provider postgresql

# 2. Authentication
npm install @nestjs/passport passport passport-jwt jwks-rsa
npm install -D @types/passport-jwt

# 3. Validation
npm install class-validator class-transformer

# 4. Configuration
npm install @nestjs/config

# 5. API Documentation
npm install @nestjs/swagger swagger-ui-express

# 6. Caching (when public endpoints are built)
npm install @nestjs/cache-manager cache-manager cache-manager-redis-yet ioredis

# 7. File upload (when event images feature is built)
npm install cloudinary
npm install -D @types/multer
```

---

## Environment Variables Required

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/exkuala"

# Auth0
AUTH0_DOMAIN="your-tenant.auth0.com"
AUTH0_AUDIENCE="https://api.exkuala.com"

# Redis (when caching phase)
REDIS_URL="redis://localhost:6379"

# Cloudinary (when images phase)
CLOUDINARY_CLOUD_NAME=""
CLOUDINARY_API_KEY=""
CLOUDINARY_API_SECRET=""

# App
NODE_ENV="development"
PORT=3000
```

---

## Confidence Summary

| Area | Confidence | Reason |
|------|------------|--------|
| NestJS 11 base | HIGH | Confirmed from package.json |
| Prisma as ORM | MEDIUM | v6 released late 2024; npm version should be verified before install |
| Auth0 JWT pattern (passport-jwt + jwks-rsa) | HIGH | Canonical pattern, unchanged; library versions stable |
| Location: city + lat/lng, defer PostGIS | HIGH | Well-supported by PROJECT.md scope; PostGIS deferral is architecturally sound |
| Redis caching via cache-manager v6 | MEDIUM | cache-manager v5→v6 had breaking changes; adapter package versions need npm verification |
| Cloudinary for images | MEDIUM | SDK v2.x is current; pattern is standard |
| Validation (class-validator/transformer) | HIGH | Stable, official, canonical NestJS pattern |
| Jest 30 + ts-jest compatibility | MEDIUM | Jest 30 is very recent; ts-jest v29 may need upgrade — verify before writing tests |

---

## Sources

- package.json (confirmed NestJS 11.0.1, TypeScript 5.7.3, Jest 30.0.0)
- PROJECT.md (confirmed single-region MVP scope, Auth0, PostgreSQL)
- Training knowledge through August 2025 (library ecosystem patterns, community direction)
- Note: Context7 MCP and WebSearch were unavailable in this agent session. Versions marked MEDIUM confidence should be verified at https://www.npmjs.com before installation.
