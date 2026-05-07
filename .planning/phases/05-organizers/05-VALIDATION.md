# Phase 05: Organizers - Validation Architecture

**Generated:** 2026-05-05
**Phase:** 05-organizers
**Requirements:** ORG-01, ORG-02, ORG-03

---

## Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 30 + ts-jest |
| Config file | `package.json` (jest key) |
| Quick run command | `pnpm test -- --testPathPattern=organizers` |
| Full suite command | `pnpm test` |

---

## Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Wave |
|--------|----------|-----------|-------------------|------|
| ORG-01 | Submit application creates pending organizer | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-01 | Duplicate userId returns 409 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-01 | Rejected organizer can reapply (rejected → pending) | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-01 | Approved organizer cannot reapply (409) | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-02 | Admin approve transitions pending → approved | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-02 | Admin reject transitions pending → rejected with note | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-02 | Audit log row inserted on approve/reject | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-02 | Invalid transition returns 409 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-03 | GET /organizers/:id returns public profile (no email) | unit | `pnpm test -- --testPathPattern=organizers.controller.spec` | 0 |
| ORG-03 | GET /organizers/:id for pending/rejected organizer returns 404 | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |
| ORG-03 | GET /organizers/me returns all fields + latestRejectionNote | unit | `pnpm test -- --testPathPattern=organizers.service.spec` | 0 |

---

## Sampling Rate

| Gate | Command |
|------|---------|
| Per task commit | `pnpm test -- --testPathPattern=organizers` |
| Per wave merge | `pnpm test` |
| Phase gate | Full suite green before `/gsd-verify-work` |

---

## Wave 0 Gaps (TDD RED stubs to create)

- [ ] `src/organizers/organizers.service.spec.ts` — covers ORG-01, ORG-02, ORG-03 service layer
- [ ] `src/organizers/organizers.controller.spec.ts` — covers public routes (GET /organizers/:id, /organizers/me, POST /organizers)
- [ ] `src/organizers/admin-organizers.controller.spec.ts` — covers admin routes (PATCH approve/reject, GET list, GET history)

---

## Success Criteria (Phase-level)

1. `pnpm test` exits 0 — full suite green after Wave 1–3 implementation
2. `pnpm migration:run` applies without error — organizers + organizer_audit_log tables created
3. `GET /api/v1/organizers/:id` for approved organizer returns name, description, website, socialLinks — no email field
4. `POST /api/v1/organizers` with valid JWT creates organizer row with status `pending`
5. `PATCH /api/v1/admin/organizers/:id/approve` transitions pending → approved; `PATCH .../reject` transitions pending → rejected
6. Approved organizer attempting to resubmit receives 409 Conflict
7. State machine enforced: approved is terminal; rejected → pending allowed; any other invalid transition → 409

---

## Security Validation

| Threat | Mitigation | Verify |
|--------|-----------|--------|
| Unauthenticated POST /organizers | JwtAuthGuard global | Test: request without token → 401 |
| User spoofs userId in application | userId derived from JWT, not body | Test: POST body with userId field → ignored (whitelist validation) |
| Admin endpoints without admin role | @Roles('admin') + RolesGuard | Test: user-role token → 403 |
| Email in public profile | toPublicResponse() omits email | Test: GET /organizers/:id response has no email key |
| State machine bypass | DTOs have no status field; service methods enforce transitions | Test: invalid transition → 409 |
| Oversized input | @MaxLength on all string DTOs | Test: name >200 chars → 400 |

---

*Phase: 05-organizers*
*Source: 05-RESEARCH.md Validation Architecture section*
