# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 01-foundation
**Areas discussed:** Schema baseline scope, Env validation style, Swagger pre-configuration, Global ValidationPipe options

---

## Schema Baseline Scope

| Option | Description | Selected |
|--------|-------------|----------|
| All core models now | User, Event (with deletedAt), Organizer, Category | |
| Event + User only | The two models needed earliest; Organizer and Category added in phases 4–5 | ✓ |
| Placeholder only | Minimal migration to prove Prisma connects | |

**User's choice:** Event + User only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full Event schema now | All known fields including deletedAt, status, organizerId, categoryId | ✓ |
| Skeleton only — expand later | Just structural fields (id, timestamps, deletedAt) | |

**User's choice:** Full Event schema now
**Notes:** Avoids disruptive ALTER TABLE migrations mid-build.

---

| Option | Description | Selected |
|--------|-------------|----------|
| auth0Id + timestamps (minimal) | auth0Id, id, createdAt, updatedAt — rest in Phase 3 | ✓ |
| Full User model now | auth0Id, email, name, role enum, timestamps | |

**User's choice:** auth0Id + timestamps only

---

## Env Validation Style

| Option | Description | Selected |
|--------|-------------|----------|
| class-validator + class-transformer | NestJS-idiomatic, same library as DTOs | ✓ |
| Joi schema | Separate dependency, broader community examples | |

**User's choice:** class-validator + class-transformer

---

| Option | Description | Selected |
|--------|-------------|----------|
| DATABASE_URL + PORT only | Minimum to boot; Auth0 vars added in Phase 2 | ✓ |
| All vars upfront | Includes Auth0 vars — fails boot if missing before Phase 2 | |

**User's choice:** DATABASE_URL + PORT required in Phase 1

---

## Swagger Pre-configuration

| Option | Description | Selected |
|--------|-------------|----------|
| Bearer auth pre-armed | addBearerAuth() included now so Phase 2 testing works immediately | ✓ |
| Basic docs only | Bearer auth added in Phase 2 | |

**User's choice:** Bearer auth pre-armed

---

| Option | Description | Selected |
|--------|-------------|----------|
| Non-production only | Guarded by NODE_ENV !== 'production' | ✓ |
| Always enabled | No environment check | |

**User's choice:** Non-production only

---

## Global ValidationPipe Options

| Option | Description | Selected |
|--------|-------------|----------|
| whitelist + transform | Strips unknown properties; transforms to DTO instances | ✓ |
| whitelist + forbidNonWhitelisted + transform | Extra properties cause 400 | |
| transform only | Minimal strictness | |

**User's choice:** whitelist + transform

---

| Option | Description | Selected |
|--------|-------------|----------|
| Detailed field-level messages | Default NestJS error shape | ✓ |
| Custom error shape | Requires custom ExceptionFilter | |

**User's choice:** Default NestJS error shape (no custom ExceptionFilter)

---

## Claude's Discretion

- URI versioning global prefix and version string
- `.env.example` content and structure
- Prisma client singleton pattern

## Deferred Ideas

None — discussion stayed within phase scope.
