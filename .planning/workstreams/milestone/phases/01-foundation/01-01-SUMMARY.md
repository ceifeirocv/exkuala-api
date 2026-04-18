---
phase: 01-foundation
plan: 01
subsystem: database/infrastructure
tags:
  - phase-1
  - prisma
  - database
  - infrastructure
  - foundation
dependency_graph:
  requires: []
  provides:
    - PrismaService (global NestJS injectable)
    - prisma/schema.prisma (User + Event baseline schema)
    - prisma.config.ts (Prisma 7 CLI datasource config)
    - src/prisma/prisma.module.ts (global PrismaModule)
  affects:
    - src/app.module.ts (PrismaModule added to imports)
tech_stack:
  added:
    - prisma@7.7.0
    - "@prisma/client@7.7.0"
    - "@prisma/adapter-pg@7.7.0"
    - pg@8.20.0
    - "@types/pg@8.20.0"
  patterns:
    - Prisma 7 driver-adapter architecture (PrismaPg, no Rust engine)
    - Generated client output to src/generated/prisma (inside src/ for nest build)
    - PrismaService extends PrismaClient with OnModuleInit/OnModuleDestroy lifecycle
    - Global NestJS module pattern (@Global() PrismaModule)
key_files:
  created:
    - prisma/schema.prisma
    - prisma.config.ts
    - src/prisma/prisma.service.ts
    - src/prisma/prisma.module.ts
    - .env.example
  modified:
    - package.json (Prisma deps + scripts)
    - .gitignore (/src/generated appended)
    - src/app.module.ts (PrismaModule added to imports)
decisions:
  - "prisma generate run with DATABASE_URL env var set (dummy value) — postinstall will regenerate on fresh clone after schema exists"
  - "npm install --ignore-scripts used during Task 1 to avoid postinstall failure before schema exists"
  - "prisma.config.ts (not .mts) accepted by Prisma 7 CLI without issues"
metrics:
  duration: "~15 minutes"
  completed: "2026-04-18"
  tasks_completed: 2
  tasks_total: 3
  files_created: 5
  files_modified: 3
---

# Phase 1 Plan 01: Prisma 7 Database Foundation Summary

**One-liner:** Prisma 7 with PrismaPg driver adapter wired into global NestJS PrismaModule; User + Event schema with soft delete authored and client generated at `src/generated/prisma`.

## What Was Built

Tasks 1 and 2 completed. Task 3 (database migration) is a blocking human-action checkpoint — requires a live PostgreSQL instance.

### Task 1: Prisma 7 dependencies and infrastructure

Installed exact-match versions:

| Package | Version |
|---------|---------|
| `prisma` | 7.7.0 |
| `@prisma/client` | 7.7.0 |
| `@prisma/adapter-pg` | 7.7.0 |
| `pg` | 8.20.0 |
| `@types/pg` | 8.20.0 (devDependency) |

Added to `package.json` scripts: `prisma:generate`, `prisma:migrate`, `prisma:studio`, `postinstall: "prisma generate"`.

Appended `/src/generated` to `.gitignore`. Created `.env.example` with `DATABASE_URL` and `PORT` required vars plus commented Phase 2 Auth0 placeholders.

### Task 2: Schema, config, service, module

**`prisma/schema.prisma`** — User (minimal per D-03) + Event (full per D-02) with `EventStatus` enum (DRAFT/PUBLISHED/CANCELLED), `deletedAt DateTime?` soft delete field present from day one per STATE.md constraint. Generator uses `provider = "prisma-client"` (Prisma 7 breaking change) with `output = "../src/generated/prisma"`.

**`prisma.config.ts`** — at project root; imports `dotenv/config`; uses `env('DATABASE_URL')` helper so the literal URL is never committed (T-01-01-02 mitigated).

**`src/prisma/prisma.service.ts`** — `@Injectable()` class extending `PrismaClient` from `'../generated/prisma/client'` (NOT `@prisma/client`); uses `PrismaPg` adapter; implements `OnModuleInit`/`OnModuleDestroy` for lifecycle management.

**`src/prisma/prisma.module.ts`** — `@Global()` module exporting `PrismaService`; no `controllers` or `imports` needed.

**`src/app.module.ts`** — `PrismaModule` added to `imports` array; existing `AppController`/`AppService` wiring preserved.

`prisma generate` succeeded and produced client at `src/generated/prisma/`. `npx tsc --noEmit` reports zero errors.

## Pending: Task 3 (Blocking Human Action)

Task 3 requires the developer to run the initial Prisma migration against a live local PostgreSQL instance. See checkpoint details below.

**What to do:**
1. Ensure PostgreSQL is running and `exkuala_dev` database exists
2. Create `.env` from `.env.example` with real credentials
3. Run: `npx prisma migrate dev --name init`
4. Expected: `prisma/migrations/<timestamp>_init/migration.sql` created with `CREATE TABLE "users"` and `CREATE TABLE "events"`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking Issue] npm install --ignore-scripts workaround**
- **Found during:** Task 1
- **Issue:** Running `npm install prisma@7.7.0 ...` triggered the `postinstall: prisma generate` script before `prisma/schema.prisma` existed, causing install to fail with exit code 1.
- **Fix:** Wrote `package.json` directly with all deps and scripts, then ran `npm install --ignore-scripts` to install packages without triggering `postinstall`. Ran `prisma generate` manually after schema was created in Task 2.
- **Files modified:** `package.json` (written directly)
- **Commits:** b8ee02f, 5b9966a

**2. [Rule 3 - Blocking Issue] DATABASE_URL required for prisma generate**
- **Found during:** Task 2
- **Issue:** `npx prisma generate --schema prisma/schema.prisma` failed because `prisma.config.ts` calls `env('DATABASE_URL')` and Prisma 7 evaluates it even during generate.
- **Fix:** Ran `prisma generate` with `DATABASE_URL=postgresql://postgres:postgres@localhost:5432/exkuala_dev` set as an environment variable. The generated client does not contain the connection string — it is only needed at CLI invocation time.
- **Impact:** None on produced artifacts. The `postinstall` script will require `DATABASE_URL` to be present in `.env` on fresh clones before migration — documented in carry-forward notes.
- **Commits:** 5b9966a

## Carry-Forward Notes for Plan 01-02

- **ConfigModule:** `ConfigModule.forRoot({ isGlobal: true, validate })` should be ADDED to `AppModule.imports` alongside `PrismaModule`. Currently `imports` only contains `PrismaModule`.
- **`app.enableShutdownHooks()`:** Must be added to `src/main.ts` for Prisma's `OnModuleDestroy` to fire on SIGTERM. Currently `main.ts` only has the bare NestJS scaffold.
- **`dotenv` package:** `prisma.config.ts` imports `dotenv/config` — ensure `dotenv` is available (it's included transitively via NestJS dependencies, but Plan 01-02 should verify or install explicitly when wiring `ConfigModule`).

## Carry-Forward Notes for Phase 6

- **Soft delete filtering NOT automatic:** `deletedAt` field is present in the `events` table schema from Phase 1, but there is NO global `$extends` filter applied in `PrismaService`. All Event CRUD queries in Phase 6 (and earlier phases) MUST manually include `where: { deletedAt: null }` to exclude soft-deleted records. Automatic filtering via Prisma Client Extensions is deferred to Phase 6 (T-01-01-06 accepted).

## Known Stubs

None — this plan establishes infrastructure only; no UI rendering or data-flow stubs are introduced.

## Threat Flags

None — all new surface matches the threat model defined in the plan frontmatter. `prisma.config.ts` uses `env('DATABASE_URL')` with no literal URL; `.env` is gitignored; `/src/generated` is gitignored.

## Self-Check: PARTIAL (Task 3 pending)

Tasks 1 and 2 self-check:

- [x] `package.json` contains prisma@^7.7.0, @prisma/client@^7.7.0, @prisma/adapter-pg@^7.7.0, pg@^8.20.0 — FOUND
- [x] `package.json` scripts contain prisma:generate, prisma:migrate, prisma:studio, postinstall — FOUND
- [x] `.gitignore` contains `/src/generated` — FOUND (line 67)
- [x] `.env.example` exists with DATABASE_URL and PORT — FOUND
- [x] `prisma/schema.prisma` exists with correct generator provider and output — FOUND
- [x] `prisma.config.ts` at project root with env('DATABASE_URL') — FOUND
- [x] `src/prisma/prisma.service.ts` imports from '../generated/prisma/client' — FOUND
- [x] `src/prisma/prisma.module.ts` has @Global() and exports PrismaService — FOUND
- [x] `src/app.module.ts` has PrismaModule in imports — FOUND (count: 2)
- [x] `src/generated/prisma/client.ts` exists (prisma generate ran successfully) — FOUND
- [x] `npx tsc --noEmit` reports zero errors — PASSED
- [x] Task 1 commit b8ee02f exists — FOUND
- [x] Task 2 commit 5b9966a exists — FOUND
- [ ] `prisma/migrations/<timestamp>_init/migration.sql` — PENDING (Task 3 human action)
