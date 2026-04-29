---
phase: 2
slug: auth-infrastructure
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-28
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | jest 29.x |
| **Config file** | jest.config.js or package.json jest field |
| **Quick run command** | `pnpm test --testPathPattern=auth` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --testPathPattern=auth`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | AUTH-01 | — | N/A | install | `pnpm install` | ✅ | ⬜ pending |
| 02-01-02 | 01 | 1 | AUTH-01 | T-2-01 | Valid JWT passes; missing JWT returns 401 | integration | `pnpm test --testPathPattern=auth` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 1 | AUTH-02 | T-2-02 | admin role returns 200; user role returns 403 | integration | `pnpm test --testPathPattern=auth` | ❌ W0 | ⬜ pending |
| 02-01-04 | 01 | 1 | AUTH-01 | T-2-01 | JWKS endpoint not called on every request (cache) | integration | `pnpm test --testPathPattern=auth` | ❌ W0 | ⬜ pending |
| 02-02-01 | 02 | 2 | AUTH-04 | — | @Public() route returns 200 without Authorization header | integration | `pnpm test --testPathPattern=auth` | ❌ W0 | ⬜ pending |
| 02-02-02 | 02 | 2 | AUTH-04 | T-2-03 | OptionalJwtAuthGuard: absent token passes; invalid token returns 401 | integration | `pnpm test --testPathPattern=auth` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/auth/__tests__/auth.guard.spec.ts` — stubs for AUTH-01, AUTH-02, AUTH-04 guard integration tests
- [ ] Auth packages installed: `@nestjs/passport`, `passport`, `passport-jwt`, `jwks-rsa`, `@nestjs/jwt`
- [ ] Type packages installed: `@types/passport-jwt`

*None of the auth packages are currently installed — Wave 0 must install them before any guard code is written.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| JWKS endpoint only called on cold start and cache expiry (600s) | AUTH-01 | Requires live Auth0 tenant or real JWKS server | Enable verbose jwks-rsa logging, make 10 rapid requests, confirm single JWKS fetch in logs |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
