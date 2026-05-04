# Phase 4: Categories - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-04
**Phase:** 04-categories
**Areas discussed:** Slug strategy, Supported locales, i18n response shape, Seed data

---

## Slug Strategy

### Q1: How is a category slug created?

| Option | Description | Selected |
|--------|-------------|----------|
| Auto from English name | Derived from name on creation; admin cannot set manually | |
| Admin sets manually | Admin provides slug explicitly in payload | |
| Auto, but overridable | Auto-derived on creation; admin can override in same payload; immutable after | ✓ |

**User's choice:** Auto, but overridable
**Notes:** Slug auto-derives from name but admin can supply an explicit override at creation time. Once set, never changes.

### Q2: When admin renames a category (PATCH), should slug update?

| Option | Description | Selected |
|--------|-------------|----------|
| Immutable after creation | Slug never changes; PATCH to slug field required to change | ✓ |
| Mutable — re-derived on name change | Slug regenerates if admin doesn't provide explicit slug | |
| You decide | Pick safer default — immutable | |

**User's choice:** Immutable after creation

### Q3: Slug uniqueness conflict on creation?

| Option | Description | Selected |
|--------|-------------|----------|
| 409 Conflict | HTTP 409 with message including conflicting slug | ✓ |
| Auto-suffix | Append number: "live-music" → "live-music-2" | |
| You decide | 409 Conflict — explicit error is safer | |

**User's choice:** 409 Conflict

### Q4: Can slug be edited after creation via explicit PATCH field?

| Option | Description | Selected |
|--------|-------------|----------|
| No — write-once | Set at creation, never changed | ✓ |
| Yes — admin can explicitly PATCH slug | Admin can send { slug: "new-slug" } in PATCH | |

**User's choice:** No — write-once

---

## Supported Locales

### Q1: Which locales to support?

| Option | Description | Selected |
|--------|-------------|----------|
| en + pt fixed | Only English and Portuguese; varchar column, convention not enum | |
| Open set (any BCP-47 tag) | No restriction; admins add any locale | ✓ |
| en + pt-PT + pt-BR | Distinguish European and Brazilian Portuguese | |

**User's choice:** Open set (any BCP-47 tag)

### Q2: Default/fallback locale?

| Option | Description | Selected |
|--------|-------------|----------|
| English (en) | Category.name is English; translations table adds others | ✓ |
| No default on entity | All names in translations table including English | |

**User's choice:** English (en) — `Category.name` = default/primary name; `CategoryTranslation` table for other locales.
**Notes:** User phrased as "title field with default/primary title, and other field with all the other translations" — maps to `Category.name` (default) + `CategoryTranslation` rows.

### Q3: What should the default name field be called?

| Option | Description | Selected |
|--------|-------------|----------|
| name | Category.name = default name | ✓ |
| title | Category.title = default | |

**User's choice:** `name`

---

## i18n Response Shape

### Q1: What does GET /categories return per category?

| Option | Description | Selected |
|--------|-------------|----------|
| Single resolved name | Only resolved name for requested locale (or fallback) | |
| Name + translations map | Default name + translations object with all available locales | ✓ |

**User's choice:** Name + translations map

### Q2: What role does Accept-Language play?

| Option | Description | Selected |
|--------|-------------|----------|
| Accept-Language sets resolved name | name = resolved for requested locale; translations map also included | |
| No Accept-Language — always return all | Ignore Accept-Language; always return default name + full translations map | ✓ |

**User's choice:** No Accept-Language — always return all translations; client resolves locale.
**Notes:** Diverges from ROADMAP success criterion #3. User's decision supersedes roadmap. CONTEXT.md notes the divergence.

---

## Seed Data

### Q1: Should Phase 4 ship with initial category data?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — seed common categories | ~10 cultural categories with TypeORM seeder | ✓ |
| No — empty list | Start empty; admins populate manually | |
| Seed in tests only | No production seed; test fixtures only | |

**User's choice:** Yes — seed common categories

### Q2: Should seed data include Portuguese translations?

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — both en + pt translations | Seed CategoryTranslation rows for pt alongside each category | ✓ |
| English only | Portuguese added manually by admin later | |

**User's choice:** Yes — both en + pt translations

---

## Claude's Discretion

- Whether `PATCH` with a slug field returns 400 or silently ignores it
- Exact `VarChar` lengths for `name` and `locale` columns
- Whether `GET /categories/:slug` single-lookup endpoint is included
- Exact seeder script command name

## Deferred Ideas

- Accept-Language server-side resolution for categories — using full translations map instead; server-side resolution deferred to Phase 7 events (I18N-01, I18N-03)
- Category soft delete
- Category display ordering / priority field
