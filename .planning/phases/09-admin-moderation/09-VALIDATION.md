---
phase: 9
slug: admin-moderation
status: planned
nyquist_compliant: true
wave_0_complete: false
created: 2026-06-13
---

# Phase 9 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30 (ts-jest) |
| **Config file** | `package.json` → `"jest"` key (testRegex `.*\.spec\.ts$`) |
| **Quick run command** | `npm test -- --testPathPatterns=<spec>` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~30–60 seconds full suite |

Note: Jest 30 renamed `--testPathPattern` → `--testPathPatterns` (project memory `jest30-testpathpattern-rename`). The old flag silently matches 0 files and exits 0.

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPatterns=<spec-file>`
- **After every plan wave:** Run `npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 09-01-01 | 01 | 1 | ADMIN-01, ADMIN-03 | T-09-01-02/03 | RED: paginated list + adminUserId audit asserted before impl | unit | `npm test -- --testPathPatterns=organizers` | ❌ W0 (extend) | ⬜ pending |
| 09-01-02 | 01 | 1 | ADMIN-01, ADMIN-03 | T-09-01-04 | findByStatusPaginated clamps limit; approve/reject persist adminUserId | unit | `npm test -- --testPathPatterns=organizers.service` | ✅ (extend) | ⬜ pending |
| 09-01-03 | 01 | 1 | ADMIN-01, ADMIN-03 | T-09-01-01/03 | @Roles('admin') routes; user.id (not sub) forwarded | unit | `npm test -- --testPathPatterns=admin-organizers.controller` | ✅ (extend) | ⬜ pending |
| 09-02-01 | 02 | 1 | EVT-03, ADMIN-02, ADMIN-04 | T-09-02-02 | Entities compile; explicit name: on new columns | build | `npm run build` | N/A (compile) | ⬜ pending |
| 09-02-02 | 02 | 1 | ADMIN-02, ADMIN-04 | T-09-02-03 | DTOs compile; note @MaxLength(2000); full-entity response type | build | `npm run build` | N/A (compile) | ⬜ pending |
| 09-02-03 | 02 | 1 | EVT-03, ADMIN-04 | T-09-02-01/04 | enum migration transaction=false; audit table + FK + adminUserId | build | `npm run build` + grep `transaction = false` | N/A (compile) | ⬜ pending |
| 09-03-01 | 03 | 2 | EVT-03, ADMIN-02, ADMIN-04 | T-09-03-* | RED: list raw-entity passthrough, suspend/restore/remove, frozen-SUSPENDED | unit | `npm test -- --testPathPatterns=admin-events` | ❌ W0 | ⬜ pending |
| 09-03-02 | 03 | 2 | EVT-03, ADMIN-02, ADMIN-04 | T-09-03-02/04/05 | admin state machine separate from ALLOWED_TRANSITIONS; withDeleted gated; SUSPENDED 409 | unit | `npm test -- --testPathPatterns="admin-events.service\|events.service"` | ❌ W0 / ✅ extend | ⬜ pending |
| 09-03-03 | 03 | 2 | ADMIN-02, ADMIN-04 | T-09-03-01/03/06 | @Roles('admin') per route; user.id as adminUserId | unit | `npm test -- --testPathPatterns=admin-events.controller` | ❌ W0 | ⬜ pending |
| 09-04-01 | 04 | 3 | all | T-09-04-01 | migrations apply to Neon; no transaction-block error | integration | `pnpm run migration:run` | N/A (live) | ⬜ pending |
| 09-04-02 | 04 | 3 | all | — | full suite green against migrated schema | unit | `npm test` | ✅ | ⬜ pending |
| 09-04-03 | 04 | 3 | all | T-09-04-02/03 | 403 for non-admin; audit rows populated; 409 organizer-on-SUSPENDED | manual | human-verify (Swagger + JWTs) | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

TDD RED stubs are co-located with their GREEN plans (two-wave RED→GREEN contract within each plan), not a separate Wave 0 plan. RED tasks that must exist before implementation:

- [ ] `src/organizers/organizers.service.spec.ts` — extend: findByStatusPaginated + adminUserId audit (09-01 Task 1)
- [ ] `src/organizers/admin-organizers.controller.spec.ts` — extend: paginated list + user.id forwarding (09-01 Task 1)
- [ ] `src/events/admin-events.service.spec.ts` — new: findAllForAdmin + suspend/restore/remove (09-03 Task 1)
- [ ] `src/events/admin-events.controller.spec.ts` — new: @Roles + user.id forwarding (09-03 Task 1)
- [ ] `src/events/events.service.spec.ts` — extend: SUSPENDED-frozen update 409 (09-03 Task 1)

RED stubs import the not-yet-existing source (DTOs / AdminEventsService / AdminEventsController) at import level so the suite is RED until GREEN tasks land (project convention, STATE.md).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| 403 for non-admin tokens on /admin/* | ADMIN-01–04 | End-to-end role enforcement needs a real JWT through the running guard chain | 09-04 Task 3 step 3 — call each /admin route with user/organizer JWT |
| Audit rows carry adminUserId in live DB | ADMIN-03, ADMIN-04 | Confirms server-side adminUserId resolution against real users.id FK | 09-04 Task 3 steps 2c–2f — inspect audit tables after actions |
| Migration applies cleanly to Neon | EVT-03 | Build/type checks pass without the live DB — false-positive risk | 09-04 Task 1 — pnpm run migration:run + schema inspection |

Unit-level coverage exists for all moderation behaviors; the manual checks confirm the live wiring the unit tests mock.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or documented manual/Wave-0 dependency
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 (RED stubs) covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-06-13
