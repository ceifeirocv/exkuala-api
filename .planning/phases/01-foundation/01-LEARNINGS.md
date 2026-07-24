---
phase: 1
phase_name: "Foundation"
project: "Cultural Agenda — API"
generated: "2026-06-13"
counts:
  decisions: 9
  lessons: 5
  patterns: 6
  surprises: 2
missing_artifacts: []
---

# Phase 1 Learnings: Foundation

> **Supersession note:** Phase 1 stood the project up on **Prisma 7** (driver adapter, generated client, `prisma migrate`). Phase 1.1 ("Migrate from Prisma to TypeORM", flagged URGENT) replaced the entire ORM layer one phase later. Below, ORM-specific items are marked **[SUPERSEDED by 1.1]**; the cross-cutting NestJS bootstrap (config, versioning, validation, Swagger, shutdown hooks) **survived intact**.

## Decisions

### Soft delete `deletedAt` on Event from the day-one migration
The `events` table carried a nullable `deletedAt` from the very first migration.

**Rationale:** Retrofitting soft delete onto an existing table is costly; adding the column up front is cheap (STATE.md constraint). Survived the TypeORM migration.
**Source:** 01-01-SUMMARY.md, 01-VERIFICATION.md

### `ConfigModule.forRoot` placed first in the imports array
ConfigModule is imported before the ORM module so env validation runs before any module reads `DATABASE_URL`.

**Rationale:** Validation must fail before the DB module's constructor touches `process.env.DATABASE_URL`; ordering enforces it.
**Source:** 01-02-SUMMARY.md

### Fail-fast env validation
`validate()` uses `plainToInstance` with `enableImplicitConversion: true` and `validateSync({ skipMissingProperties: false })`, so missing/invalid vars crash the process before the HTTP listener binds.

**Rationale:** A misconfigured app should never bind a port and serve 500s; crash at boot instead. `skipMissingProperties: false` also means Phase 2 adding Auth0 vars auto-enforces them.
**Source:** 01-02-SUMMARY.md, 01-VERIFICATION.md

### URI versioning at `/api/v1`
`setGlobalPrefix('api')` + `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`.

**Rationale:** Bare-root paths 404; every route is versioned from day one, avoiding a later breaking re-prefix.
**Source:** 01-02-SUMMARY.md

### Global `ValidationPipe` (whitelist + transform), no `forbidNonWhitelisted`, no custom ExceptionFilter
Unknown props are silently stripped (D-08); the default NestJS 400 shape is preserved (D-09).

**Rationale:** Deliberate product choices — adding `forbidNonWhitelisted` or a custom error shape later would break clients sending extra fields or parsing the default error body.
**Source:** 01-02-SUMMARY.md

### Swagger guarded by `NODE_ENV !== 'production'`, `addBearerAuth()` with no args
Swagger mounts at `api/docs` only outside production; bearer scheme uses the default name `'bearer'`.

**Rationale:** No API surface map in production; the no-arg scheme name is a contract Phase 2's `@ApiBearerAuth()` must match exactly or "Try it out" silently breaks.
**Source:** 01-02-SUMMARY.md

### `app.enableShutdownHooks()` for ORM lifecycle on SIGTERM
Shutdown hooks enabled so the ORM's `OnModuleDestroy` fires on SIGTERM.

**Rationale:** Graceful connection teardown; conceptually survived the move to TypeORM.
**Source:** 01-02-SUMMARY.md

### Prisma 7 driver-adapter architecture **[SUPERSEDED by 1.1]**
`PrismaService` extended `PrismaClient` via the `PrismaPg` adapter (no Rust engine), imported from the generated path `src/generated/prisma/client` (not `@prisma/client`), with the client output inside `src/` so `nest build` includes it.

**Rationale at the time:** Prisma 7's breaking `provider = "prisma-client"` generator and driver-adapter model. Entirely replaced by TypeORM in Phase 1.1.
**Source:** 01-01-SUMMARY.md, 01-VERIFICATION.md

### Soft-delete filtering left manual (not automatic)
No global `$extends`/filter was applied; all queries must include `where: { deletedAt: null }` themselves (T-01-01-06 accepted, deferred to Phase 6).

**Rationale:** Automatic filtering was deferred; the carry-forward warned every later phase to filter manually. The concern carried into the TypeORM era.
**Source:** 01-01-SUMMARY.md

---

## Lessons

### `postinstall: prisma generate` breaks a fresh install before the schema exists **[Prisma-specific]**
Installing deps triggered `postinstall` → `prisma generate` before `schema.prisma` existed, failing the install. Worked around with `npm install --ignore-scripts`, then a manual generate.

**Context:** A chicken-and-egg between the postinstall hook and the not-yet-authored schema; now moot post-TypeORM but a real bootstrap trap.
**Source:** 01-01-SUMMARY.md

### `prisma generate` requires `DATABASE_URL` even though the client never embeds it **[Prisma-specific]**
Generate failed because `prisma.config.ts` evaluates `env('DATABASE_URL')` at CLI time. Fixed by passing a dummy URL for the generate invocation.

**Context:** The connection string is needed only at CLI invocation; the generated client is connection-string-free. Recurred in 01-02's worktree.
**Source:** 01-01-SUMMARY.md, 01-02-SUMMARY.md

### Standalone class-validator specs need an explicit `import 'reflect-metadata'`
A pure-function spec testing `validate()` without `Test.createTestingModule` threw `Reflect.getMetadata is not a function`.

**Context:** NestJS TestingModule loads `reflect-metadata` transitively; a standalone spec does not. Decorator-driven validation needs it imported first. **Survives** — general lesson for any non-Nest unit test using decorators.
**Source:** 01-02-SUMMARY.md

### Grep-based verification scripts match their own explanatory comments
A check for `forbidNonWhitelisted` absence false-positived on the comment `// forbidNonWhitelisted intentionally OMITTED`.

**Context:** Reword comments so they don't contain the literal token a verification script greps for — the proof-of-absence must not be defeated by prose.
**Source:** 01-02-SUMMARY.md

### A gitignored generated client breaks `tsc` in a fresh worktree **[Prisma-specific]**
`/src/generated` is gitignored, so a freshly-branched worktree failed `tsc` with "Cannot find module '../generated/prisma/client'" until regenerated.

**Context:** Build artifacts excluded from VCS must be regenerated per worktree/clone; the dummy-`DATABASE_URL` generate is the recovery.
**Source:** 01-02-SUMMARY.md

---

## Patterns

### `@Global()` module exporting a single service
A global module (`PrismaModule`) exports its service so any module injects it without re-importing.

**When to use:** Cross-cutting singletons (DB access) that nearly every feature module needs. Reused across the project.
**Source:** 01-01-SUMMARY.md

### Validation class + `validate()` fed to `ConfigModule.forRoot`
An `EnvironmentVariables` class with class-validator decorators plus a `validate()` function passed to `ConfigModule.forRoot({ validate })`.

**When to use:** Typed, fail-fast env validation; extend the class per phase to enforce new required vars at boot.
**Source:** 01-02-SUMMARY.md

### Deterministic bootstrap pipeline in `main.ts`
Fixed order: global prefix → URI versioning → ValidationPipe → Swagger (prod-guarded) → `enableShutdownHooks()` → `listen()`.

**When to use:** Any NestJS bootstrap; the ordering encodes dependencies (validation before listen, shutdown hooks before listen).
**Source:** 01-02-SUMMARY.md

### Module-import ordering as a correctness lever
Placing `ConfigModule` before the DB module so validation runs before the DB constructor reads env.

**When to use:** Whenever one module's side effects must precede another's construction.
**Source:** 01-02-SUMMARY.md

### TDD RED→GREEN with explicit per-phase commits for pure functions
`validate()` got a RED spec commit then a GREEN implementation commit.

**When to use:** Pure, decorator-driven functions where the contract is fully expressible as unit tests before implementation.
**Source:** 01-02-SUMMARY.md

### Carry-forward notes section in SUMMARY.md
Summaries end with explicit "Carry-Forward Notes for Phase N" blocks handing constraints (bearer scheme name, Auth0 vars, manual soft-delete filtering) to future phases.

**When to use:** Any phase that establishes contracts later phases must honor; makes cross-phase coupling explicit rather than tribal.
**Source:** 01-01-SUMMARY.md, 01-02-SUMMARY.md

---

## Surprises

### The entire ORM foundation was replaced one phase later
Phase 1 invested in Prisma 7 (service, schema, migrations, generated client, driver adapter) and Phase 1.1 — flagged URGENT — migrated everything to TypeORM immediately after. Most of Phase 1's database work was throwaway; only the framework-agnostic bootstrap (config, versioning, validation, Swagger, shutdown hooks) survived.

**Impact:** The biggest architectural decision of the foundation phase (ORM choice) was reversed almost immediately, after a fully-green phase. Reinforces resolving foundational tech choices before building on them — and that the cross-cutting NestJS wiring was the durable value, not the ORM-specific code.
**Source:** 01-01-SUMMARY.md, ROADMAP.md (Phase 1.1), .planning/STATE.md (Roadmap Evolution)

### A 13/13 verified, 7/7 UAT-passed phase still had its core reversed
Phase 1 passed verification (13/13 truths) and UAT (7/7) with zero gaps, yet its primary technology was scrapped in 1.1.

**Impact:** Green gates verify "does what the plan said", not "was the plan's foundational choice right". Verification/UAT pass is orthogonal to architectural durability.
**Source:** 01-VERIFICATION.md, 01-UAT.md
