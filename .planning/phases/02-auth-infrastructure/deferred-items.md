# Phase 02 Deferred Items

## Pre-existing test failures (out of scope for 02-02)

Discovered during `pnpm test` full-suite run in Plan 02-02. These failures existed before any 02-02
changes (verified via git stash).

### 1. env.validation.spec.ts — missing Auth0 env vars in test fixture

- **Files:** `src/config/env.validation.spec.ts`
- **Cause:** Plan 01 added 4 required Auth0 env vars (`AUTH0_JWKS_URI`, `AUTH0_AUDIENCE`,
  `AUTH0_ISSUER`, `AUTH0_NAMESPACE`) to `EnvironmentVariables`. The existing spec does not supply
  them in its test input, so `validate()` throws validation errors.
- **Fix needed:** Update `env.validation.spec.ts` to include the 4 Auth0 env vars in any test
  fixture that calls `validate()` with a fully-valid config.
- **Owner:** Phase 02 cleanup or Phase 03 setup task.

### 2. event.entity.spec.ts and user.entity.spec.ts — ESM-only @paralleldrive/cuid2

- **Files:** `src/events/event.entity.spec.ts`, `src/users/user.entity.spec.ts`
- **Cause:** `@paralleldrive/cuid2@3.3.0` uses ES module syntax (`import` at the top level). Under
  ts-jest, `node_modules` are not transformed by default, so the spec fails with
  `SyntaxError: Cannot use import statement outside a module`.
- **Fix needed:** Add `@paralleldrive/cuid2` to `transformIgnorePatterns` in `package.json`
  (same pattern used for `jwks-rsa` and `jose` in Plan 01). Or mock `@paralleldrive/cuid2` in the
  entity spec files.
- **Owner:** Phase 03 (Users) since that phase owns the entity specs.
