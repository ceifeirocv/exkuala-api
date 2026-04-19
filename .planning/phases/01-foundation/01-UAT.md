---
status: testing
phase: 01-foundation
source: 01-01-SUMMARY.md, 01-02-SUMMARY.md
started: 2026-04-19T00:00:00Z
updated: 2026-04-19T00:00:00Z
---

## Current Test

number: 1
name: Cold Start Smoke Test
expected: |
  Kill any running server. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch with a valid .env. Server boots without errors and a basic API call returns live data — e.g. GET http://localhost:3000/api/v1/ responds with 200.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server. Clear ephemeral state (temp DBs, caches, lock files). Start the application from scratch with a valid .env. Server boots without errors and a basic API call returns live data — e.g. GET http://localhost:3000/api/v1/ responds with 200.
result: [pending]

### 2. Initial Database Migration
expected: With PostgreSQL running and .env populated, run `npx prisma migrate dev --name init`. The command completes without errors and creates `prisma/migrations/<timestamp>_init/migration.sql` containing CREATE TABLE statements for "users" and "events".
result: [pending]

### 3. GET /api/v1/ returns 200
expected: Sending `GET http://localhost:3000/api/v1/` returns HTTP 200 with the default "Hello World!" response. The URI prefix /api/ and version /v1/ are both applied.
result: [pending]

### 4. GET / returns 404
expected: Sending `GET http://localhost:3000/` returns HTTP 404. The global prefix enforcement means the bare root path is unreachable.
result: [pending]

### 5. Swagger UI at /api/docs
expected: Navigating to `http://localhost:3000/api/docs` in the browser (with NODE_ENV not set to "production") renders the Swagger UI. An "Authorize" button with a bearer scheme is visible.
result: [pending]

### 6. Env validation fail-fast
expected: Remove DATABASE_URL from .env (or provide an invalid value) and start the app. The process exits with a validation error before binding to any HTTP port — no server starts, no 500 errors at runtime.
result: [pending]

### 7. npm test passes
expected: Running `npm test` completes with 7 passing tests (6 from env.validation.spec.ts + 1 from app.controller.spec.ts) and zero failures.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps

[none yet]
