---
phase: 07
slug: public-event-discovery
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-09
---

# Phase 07 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.x |
| **Config file** | `jest.config.ts` |
| **Quick run command** | `pnpm test --testPathPattern="events\|translations"` |
| **Full suite command** | `pnpm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm test --testPathPattern="events\|translations"`
- **After every plan wave:** Run `pnpm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 07-01-01 | 01 | 0 | EVT-06, I18N-01 | — | N/A | unit (RED stub) | `pnpm test -- --testPathPattern="public-events.controller.spec"` | ❌ W0 | ⬜ pending |
| 07-01-02 | 01 | 0 | EVT-06, I18N-01 | — | N/A | unit (RED stub) | `pnpm test -- --testPathPattern="public-events.service.spec"` | ❌ W0 | ⬜ pending |
| 07-01-03 | 01 | 1 | I18N-01 | — | Organizer ownership enforced on translation upsert | unit | `pnpm test -- --testPathPattern="events.controller.spec"` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | I18N-01 | — | N/A | unit | `pnpm test -- --testPathPattern="events.service.spec"` | ✅ | ⬜ pending |
| 07-02-02 | 02 | 1 | DISC-01 | — | Only PUBLISHED events returned to unauthenticated callers | unit | `pnpm test -- --testPathPattern="public-events.service.spec"` | ❌ W0 | ⬜ pending |
| 07-02-03 | 02 | 1 | DISC-02, DISC-03 | — | Category/date/city filters scope correctly | unit | `pnpm test -- --testPathPattern="public-events.service.spec"` | ❌ W0 | ⬜ pending |
| 07-02-04 | 02 | 1 | EVT-04 | — | N/A | unit | `pnpm test -- --testPathPattern="public-events.controller.spec"` | ❌ W0 | ⬜ pending |
| 07-03-01 | 03 | 1 | DISC-04 | — | N/A | unit | `pnpm test -- --testPathPattern="public-events.service.spec"` | ❌ W0 | ⬜ pending |
| 07-04-01 | 04 | 2 | EVT-04, EVT-06, DISC-01-04, I18N-01 | — | Migration runs without error | manual | `pnpm migration:run` exit 0 | ✅ | ⬜ pending |
| 07-04-02 | 04 | 2 | ALL | — | Full test suite green post-migration | automated | `pnpm test` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/events/public-events.controller.spec.ts` — RED stubs for GET /events and GET /events/:id
- [ ] `src/events/public-events.service.spec.ts` — RED stubs for findPublished, findPublishedById, findPublishedWithFilters, searchByFullText

*Note: `events.service.spec.ts` and `events.controller.spec.ts` already exist and will be extended (not created in Wave 0).*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| tsvector GIN index populates correctly via trigger after event INSERT | DISC-04 | Requires live DB + trigger execution | `pnpm migration:run`, insert event, `SELECT search_vector FROM events WHERE id = '<id>'` — must be non-null |
| tsvector updates when event_translations row upserted | I18N-01 | Trigger mutual-update — hard to unit test | Upsert translation via API, verify `search_vector` updated in DB |
| PostgreSQL version >= 14 (tsvector_agg) | DISC-04 | Infrastructure check | `psql -c "SELECT version()"` — must show PG 14+ |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
