---
phase: 3
phase_name: "Users"
project: "exkuala-api"
generated: "2026-05-10"
counts:
  decisions: 10
  lessons: 5
  patterns: 6
  surprises: 3
missing_artifacts:
  - VERIFICATION.md
  - UAT.md
---

# Phase 3 Learnings: Users

## Decisions

### Flat Merge for req.user Shape
`req.user` is a flat merge of `UserEntity` fields (`id`, `auth0Id`, `createdAt`, `updatedAt`) plus a transient `roles` field from the JWT namespace claim. No wrapper object or nesting.

**Rationale:** Clean access at call sites (`req.user.id`, `req.user.roles`) without traversal. Alternatives considered were a wrapper object (`req.user.user.id`) and returning `UserEntity` only (dropping roles) — both rejected for ergonomics.
**Source:** 03-CONTEXT.md, 03-DISCUSSION-LOG.md

---

### AuthenticatedUser as a Plain Interface, Not a Class
`AuthenticatedUser` is a plain TypeScript interface in `src/types/auth.ts`, not a class and not extending `UserEntity`.

**Rationale:** Avoids coupling the business-layer type to TypeORM decorators. `UserEntity` carries ORM metadata; merging that into the auth type would bleed infrastructure concerns into application code.
**Source:** 03-02-SUMMARY.md, 03-CONTEXT.md (D-02)

---

### Two-File Type Augmentation Pattern
The `AuthenticatedUser` interface lives in `src/types/auth.ts` (a `.ts` file with named exports), and the Express namespace augmentation lives in `src/types/express.d.ts` (a `.d.ts` file, side-effect only).

**Rationale:** Separating the interface definition from the ambient augmentation keeps each file's responsibility singular. Other modules can import `AuthenticatedUser` from `auth.ts` without pulling in the augmentation file.
**Source:** 03-RESEARCH.md (RQ-4), 03-02-PLAN.md

---

### findOrCreate() Error Propagation — Caller Owns the Conversion
`UsersService.findOrCreate()` does not catch errors. It lets TypeORM exceptions propagate up to `JwtStrategy.validate()`, which wraps the call in a try/catch and converts any error to `UnauthorizedException`.

**Rationale:** Keeping the error-to-401 conversion at the Passport boundary (D-03) avoids `findOrCreate()` needing to know about HTTP concepts. The original DB error is logged before it is swallowed, preserving observability.
**Source:** 03-CONTEXT.md (D-03, D-04), 03-02-PLAN.md, 03-RESEARCH.md (RQ-3)

---

### AuthModule Imports UsersModule, Not UsersService Directly
`AuthModule` adds `UsersModule` to its `imports[]` array rather than registering `UsersService` directly in `providers[]`.

**Rationale:** `TypeOrmModule.forFeature([UserEntity])` registers the `Repository<UserEntity>` provider scoped to `UsersModule`. Importing the service class directly bypasses that registration and causes a runtime injection error. `UsersModule` already exports `UsersService`, so importing the module is the correct NestJS module composition pattern.
**Source:** 03-CONTEXT.md (D-05), 03-RESEARCH.md (RQ-1, Pitfall 5)

---

### validate() Throws UnauthorizedException, Not Returns Null
On DB failure, `JwtStrategy.validate()` explicitly throws `UnauthorizedException` rather than returning `null`.

**Rationale:** Both `null` and `throw` produce a 401 via `@nestjs/passport`'s `handleRequest`, but throwing makes the failure explicit in stack traces and logs. The codebase already throws and logs on DB failures (`upsertFromAuth0`), so this is consistent. Returning `null` silently delegates error creation to `handleRequest` with no context.
**Source:** 03-CONTEXT.md (D-03), 03-RESEARCH.md (RQ-6)

---

### @CurrentUser() Decorator Implemented in Phase 3
The `@CurrentUser()` param decorator was created in Phase 3 alongside the `AuthenticatedUser` type, not deferred to a later phase.

**Rationale:** The decorator's shape is determined entirely by the `AuthenticatedUser` interface being defined in this phase. Implementing it immediately lets Phase 4+ controllers use it with full type safety from day one.
**Source:** 03-CONTEXT.md (D-07), 03-DISCUSSION-LOG.md

---

### No @OptionalCurrentUser() Decorator in Phase 3
The optional variant of the `@CurrentUser()` decorator was explicitly deferred.

**Rationale:** No public routes requiring optional user context exist in Phase 3. Adding infrastructure ahead of a concrete need was rejected in favour of YAGNI.
**Source:** 03-CONTEXT.md (D-08), 03-DISCUSSION-LOG.md

---

### Roles Sourced from JWT Only, Not Stored in DB
The `roles` field on `AuthenticatedUser` is derived from the JWT namespace claim on every request and is not persisted in `UserEntity`.

**Rationale:** Keeps role management in Auth0 as the single source of truth. Avoids a synchronisation problem between the JWT and the database. Storing roles in DB is deferred to v2 if needed.
**Source:** 03-CONTEXT.md (D-01), 03-DISCUSSION-LOG.md

---

### Wave 0 / Wave 1 Two-Wave TDD Contract
The three existing `jwt.strategy` tests were intentionally kept asserting the OLD return shape (`{ sub, roles }`) in Wave 0 rather than pre-emptively updated to the `AuthenticatedUser` shape.

**Rationale:** Demonstrates that the TDD gate is a two-wave contract. Wave 0 writes tests that are RED for the right reason (missing implementation). When Wave 1 changes the implementation, the old assertions go RED again, proving the test is actually exercising the new code path and not passing vacuously.
**Source:** 03-01-SUMMARY.md, 03-01-PLAN.md

---

## Lessons

### Sync Tests Pass Vacuously When an Async validate() Is Not Awaited
When `validate()` was made async, the three existing spec tests continued to "pass" because they called `strategy.validate(payload)` without `await`. Jest does not fail a synchronous test callback that returns an un-awaited promise.

**Context:** This pitfall was identified in research (RQ-5 / Pitfall 4) before implementation. The fix is to mark all existing test callbacks `async` and add `await` to every `strategy.validate()` call. Without this, tests pass even when the implementation is broken.
**Source:** 03-RESEARCH.md (Pitfall 4), 03-02-PLAN.md

---

### emitDecoratorMetadata + isolatedModules Forbids Interface Types as Decorated Parameter Types
In `current-user.decorator.spec.ts`, the dummy controller method parameter had to be typed as `unknown` rather than `AuthenticatedUser`. Using an interface from a value import as a decorated parameter type triggers TS1272 under the `emitDecoratorMetadata` + `isolatedModules` combination.

**Context:** This error only surfaced during `npx tsc --noEmit`, after Jest tests passed. The fix was to change the dummy method parameter type from `AuthenticatedUser` to `unknown`; the factory return type was still asserted via Reflect metadata.
**Source:** 03-02-SUMMARY.md (Deviations, Issue 2)

---

### Wrong Relative Import Path Only Fails at TypeScript Compile Time, Not Jest Runtime
The original Wave 0 spec used `'../../../users/users.service'` (three levels up from `src/auth/strategies/`), which resolves outside `src/`. Jest passed because the mock for `UsersService` prevented the actual module from being loaded. The error only appeared in `npx tsc --noEmit`.

**Context:** The import path error was a pre-existing issue in the Wave 0 spec that only surfaced in Wave 1 once `UsersService` became importable. The correct path is `'../../users/users.service'`.
**Source:** 03-02-SUMMARY.md (Deviations, Issue 1)

---

### declare global Is Required in Any .d.ts File That Has an Import Statement
When `src/types/express.d.ts` includes an `import` statement (for `AuthenticatedUser`), TypeScript treats the file as a module rather than an ambient script. Writing `declare namespace Express` at the top level of a module silently fails — the namespace is scoped to the module and does not extend the global `Express.User`.

**Context:** The `declare global { namespace Express { ... } }` wrapper is mandatory in this case. The symptom is that `req.user` remains typed as the empty `Express.User` interface despite the augmentation file existing.
**Source:** 03-RESEARCH.md (RQ-4, Pitfall 2), 03-02-PLAN.md

---

### TypeORM findOneOrFail Throws EntityNotFoundError, Not NotFoundException
`findOneOrFail` throws `typeorm.EntityNotFoundError` (which extends `TypeORMError`), not a NestJS `NotFoundException`. If `validate()` did not catch all errors generically, a missing user row after an upsert would produce a 500, not a 401.

**Context:** Verified directly from `node_modules/typeorm/error/EntityNotFoundError.js`. The catch-all in `validate()` (D-03) covers this case, making the exact error type from `findOrCreate()` irrelevant to the HTTP response.
**Source:** 03-RESEARCH.md (RQ-3, Pitfall 3)

---

## Patterns

### Wave 0 RED Gate via Import-Level Failure
Wave 0 spec files import non-existent source files at the module level (not inside test assertions). This guarantees a suite-level failure (`Cannot find module`) rather than a single assertion failure, making the RED state unambiguous and impossible to accidentally pass.

**When to use:** Any TDD Wave 0 plan where the target file does not yet exist. Import the to-be-created module at the top of the spec file so the entire suite fails at module resolution — not just specific tests.
**Source:** 03-01-SUMMARY.md, 03-01-PLAN.md, STATE.md

---

### Module-Level Mock Object for Service Constructor Injection
When a strategy or service requires another service via constructor injection, define a module-level mock object (`const mockUsersService = { findOrCreate: jest.fn() } as unknown as UsersService`) and pass it as the second constructor argument when instantiating the class under test. Pair with `jest.clearAllMocks()` in a `beforeEach` to prevent state leakage.

**When to use:** Any spec that directly instantiates a class (bypassing `TestingModule`) that has a second-or-later constructor dependency. Avoids re-creating the mock object inside each test.
**Source:** 03-01-SUMMARY.md, 03-RESEARCH.md (RQ-5)

---

### Service Method Spy for Indirect Call Assertions
Use `jest.spyOn(service as unknown as { method: () => void }, 'method')` to assert whether a service method was or was not called, rather than asserting on underlying repository mock calls directly.

**When to use:** When the test wants to assert that a higher-level service method (e.g., `upsertFromAuth0`) was or was not called, without coupling the test to internal repository interactions. Keeps the assertion at the right abstraction level.
**Source:** 03-01-SUMMARY.md, 03-01-PLAN.md (Task 1)

---

### findOrCreate Hot-Path Pattern
Implement `findOrCreate(sub)` as: single `findOne` call on every request (hot path); only call `upsertFromAuth0(sub)` then `findOneOrFail` on first-ever login (fallback path). Do not catch errors — let them propagate to the caller that owns the error-to-HTTP-status conversion.

**When to use:** Any service method that reads a record expected to exist on most calls but must create it on first access. Minimises DB round-trips on the hot path while handling the cold path correctly.
**Source:** 03-CONTEXT.md (D-04), 03-RESEARCH.md (RQ-3), 03-02-PLAN.md

---

### Two-File Type Augmentation for Express Request Extensions
Define the interface in a `.ts` file with a named export (`src/types/auth.ts`). In a separate `.d.ts` file (`src/types/express.d.ts`), import the interface and use `declare global { namespace Express { interface User extends TheInterface {} } }` to augment the request type project-wide.

**When to use:** Any time a project needs to add typed properties to `Express.Request` (or other global ambient types) while keeping the interface definition reusable by other modules.
**Source:** 03-RESEARCH.md (RQ-4), 03-02-PLAN.md, 03-02-SUMMARY.md

---

### @CurrentUser() Decorator Test via Reflect.getMetadataKeys on Dummy Controller
Test `createParamDecorator`-based decorators by applying them to a dummy controller method, reading the `ROUTE_ARGS` metadata via `Reflect.getMetadataKeys`, and invoking the stored factory callback directly. Provide a `toBeDefined()` fallback for environments where the metadata key is not accessible.

**When to use:** Unit testing any NestJS param decorator built with `createParamDecorator` without spinning up a full `TestingModule` or making a real HTTP request.
**Source:** 03-02-SUMMARY.md, 03-02-PLAN.md (Step 4)

---

## Surprises

### Jest Mocks Can Hide Wrong Import Paths Until TypeScript Compilation
The Wave 0 spec for `jwt.strategy.spec.ts` used an incorrect relative import path (`../../../users/users.service` instead of `../../users/users.service`). Jest passed all tests because the jest.mock call intercepted the import before the file system was consulted. The error only became visible when `npx tsc --noEmit` was run in Wave 1.

**Impact:** Import path bugs in mocked spec files can silently persist across an entire wave. Running `npx tsc --noEmit` as part of the Wave 1 done-gate (not just `npx jest`) is necessary to catch this class of error. Added as a standard verification step.
**Source:** 03-02-SUMMARY.md (Deviations, Issue 1)

---

### NestJS createParamDecorator Internal API Not Reliably Accessible via Reflection
The plan described multiple reflection approaches to extract the factory callback from `createParamDecorator` for unit testing. None of the approaches reliably accessed the factory in all NestJS versions. The final implementation uses a `Reflect.getMetadataKeys` path with a `toBeDefined()` fallback.

**Impact:** The decorator unit test is weaker than intended — the full end-to-end extraction assertion depends on a NestJS internal metadata key format that is not part of the public API. Full behaviour coverage deferred to integration tests in later phases. This outcome was accepted in the plan comments.
**Source:** 03-01-PLAN.md (Task 3), 03-02-PLAN.md (Step 4), 03-02-SUMMARY.md

---

### emitDecoratorMetadata + isolatedModules Interaction Caused TS1272 in Decorator Spec
Using `AuthenticatedUser` (an imported interface) as the type of a parameter on a decorated method in the spec file triggered TypeScript error TS1272. This combination of compiler flags is unusual and was not anticipated in the plan.

**Impact:** The dummy method parameter had to be typed as `unknown` instead of the intended `AuthenticatedUser`. The test still validates the decorator's factory behaviour but loses the type-level assertion on the extracted value. Required an unplanned fix during Task 2 of Wave 1.
**Source:** 03-02-SUMMARY.md (Deviations, Issue 2)
