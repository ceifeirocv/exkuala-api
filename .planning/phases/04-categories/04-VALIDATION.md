---
phase: 4
slug: categories
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-04
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 30.x + ts-jest |
| **Config file** | `package.json` → `"jest"` key |
| **Quick run command** | `pnpm test -- --testPathPattern=categories` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test -- --testPathPattern=categories`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 0 | CAT-01, CAT-02, CAT-03, I18N-02 | — | N/A | unit (stubs) | `pnpm test -- --testPathPattern=categories` | ❌ W0 | ⬜ pending |
| 04-01-02 | 01 | 1 | CAT-01 | — | N/A | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ W0 | ⬜ pending |
| 04-01-03 | 01 | 1 | CAT-02 | T-input-validation | `@MaxLength(100)` + `@Matches(/^[a-z0-9-]+$/)` on slug DTO | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ W0 | ⬜ pending |
| 04-01-04 | 01 | 1 | CAT-02 | T-slug-collision | 409 on duplicate slug (DB unique constraint) | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ W0 | ⬜ pending |
| 04-01-05 | 01 | 1 | CAT-03, I18N-02 | — | N/A | unit | `pnpm test -- --testPathPattern=categories.service` | ❌ W0 | ⬜ pending |
| 04-01-06 | 01 | 1 | CAT-01 | — | N/A | unit | `pnpm test -- --testPathPattern=categories.controller` | ❌ W0 | ⬜ pending |
| 04-01-07 | 01 | 2 | CAT-01 | — | migration:run succeeds | manual | `pnpm migration:run` exits 0 | ❌ W1 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/categories/categories.service.spec.ts` — RED stubs for CAT-01, CAT-02, CAT-03, I18N-02
- [ ] `src/categories/categories.controller.spec.ts` — RED stubs for CAT-01, CAT-02 controller layer
- [ ] `pnpm add slugify` — install before Wave 1 implementation begins

*Existing test infrastructure (jest + ts-jest) is already in place — no framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| TypeORM migration runs without error | CAT-01 | Requires live PostgreSQL connection | Run `pnpm migration:run`; verify exit 0 and tables `categories` + `category_translations` created |
| Seeder populates 10 categories with translations | CAT-03, I18N-02 | Requires live DB | Run `pnpm seed:categories`; verify `SELECT count(*) FROM categories` = 10 and `SELECT * FROM category_translations WHERE locale='pt'` returns 10 rows |
| `GET /api/v1/categories` returns translations map | CAT-03, I18N-02 | E2E smoke test | `curl /api/v1/categories` — response items have `translations: { "pt": "..." }` shape |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
