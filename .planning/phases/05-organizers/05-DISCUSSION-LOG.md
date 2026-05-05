# Phase 5: Organizers - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-05
**Phase:** 05-organizers
**Areas discussed:** Contact info fields, Re-application policy, User↔Organizer relation, Admin notes & audit trail

---

## Contact Info Fields

| Option | Description | Selected |
|--------|-------------|----------|
| Email + website | Simple minimum viable contact | |
| Email + website + phone | Adds phone for venue-based organizers | |
| Email + website + social links | Covers cultural promoter use case | ✓ |

**User's choice:** Email + website + social links

| Option | Description | Selected |
|--------|-------------|----------|
| Open varchar map (JSONB) | Flexible, no schema change per new platform | ✓ |
| Fixed columns per platform | instagram_url, facebook_url — explicit but rigid | |
| Single freeform text | No validation, messy data | |

**User's choice:** JSONB map

| Option | Description | Selected |
|--------|-------------|----------|
| Manually entered | Business email separate from Auth0 login | ✓ |
| Auto-pulled from Auth0 token | Simpler, one less field | |

**User's choice:** Manually entered

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description required only | Email optional | |
| Name + description + email required | Email minimum contact floor | ✓ |
| All required | Forces complete profile | |

**User's choice:** Name + description + email required; website + social optional

| Option | Description | Selected |
|--------|-------------|----------|
| All public | Full contact visible | |
| Email admin-only | Email hidden from public, rest visible | ✓ |
| Contact fields all admin-only | Only name + description public | |

**User's choice:** Email admin-only

**Notes:** VarChar lengths deferred to planner (Claude's discretion per SEC-01 pattern).

---

## Re-application Policy

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — rejected can resubmit | State: rejected → pending | ✓ |
| No — rejection is final | Terminal rejected state | |
| Yes — with cooldown/limit | Throttled reapplication | |

**User's choice:** Yes — rejected can resubmit

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite in-place | One row per user, reapplication updates existing row | ✓ |
| Create new row, archive old | Full history, complex queries | |
| Keep old row, add revisedAt | Same row, implicit history via updatedAt | |

**User's choice:** Overwrite in-place

| Option | Description | Selected |
|--------|-------------|----------|
| 409 Conflict | approved is terminal | ✓ |
| Allow profile field update only | Different handling | |
| Silently ignore | Bad DX | |

**User's choice:** 409 Conflict for approved organizer resubmit

| Option | Description | Selected |
|--------|-------------|----------|
| No — defer to later phase | Phase 5 is application + approval only | ✓ |
| Yes — PATCH /organizers/me | Add profile update in Phase 5 | |

**User's choice:** Defer PATCH /organizers/me

| Option | Description | Selected |
|--------|-------------|----------|
| pending → approved \| rejected → pending | Three states, approved terminal | ✓ |
| Add suspended state | Admin disable approved organizer | |
| You decide | Planner picks | |

**User's choice:** pending → approved \| rejected → pending. Three states. approved terminal.

---

## User↔Organizer Relation

**Context provided by user:** Asked about expansion cost from 1:1 to M:M. Confirmed migration is additive (remove unique constraint, add join table, seed from existing data). Chose to start simple.

| Option | Description | Selected |
|--------|-------------|----------|
| 1:1 now, expand later | Unique constraint on userId FK | ✓ |
| M:M from start | organizer_members join table | |

**User's choice:** 1:1 now, expand to M:M later

| Option | Description | Selected |
|--------|-------------|----------|
| OrganizerEntity.id | Events belong to organizer profile | ✓ |
| UserEntity.id | Events belong to the user | |

**User's choice:** EventEntity.organizerId → OrganizerEntity.id

| Option | Description | Selected |
|--------|-------------|----------|
| DB lookup via userId FK | Source of truth in DB | ✓ |
| Auth0 role claim | JWT carries organizer role | |
| Hybrid with cache | DB + per-request cache | |

**User's choice:** DB lookup (JWT → UserEntity → OrganizerEntity WHERE status = approved)

| Option | Description | Selected |
|--------|-------------|----------|
| @CurrentOrganizer() decorator | Mirrors @CurrentUser() pattern | ✓ |
| ApprovedOrganizerGuard | Separate guard class | |
| You decide | Planner picks | |

**User's choice:** @CurrentOrganizer() decorator

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — GET /organizers/me | Self-view with status + email + latest rejection note | ✓ |
| No — only GET /organizers/:id | Skip self-view | |

**User's choice:** Include GET /organizers/me

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 5 — include now | Admin needs to see pending applications | |
| Phase 9 — defer | ADMIN-01 full list in Phase 9 | |
| Minimal list in Phase 5 | Status-filter only, no pagination | ✓ |

**User's choice:** Minimal list in Phase 5 (GET /admin/organizers?status=)

**Notes:** Full paginated admin organizer list (ADMIN-01) remains in Phase 9.

---

## Admin Notes & Audit Trail

| Option | Description | Selected |
|--------|-------------|----------|
| Same row on OrganizerEntity | adminNote column, overwritten each action | |
| Separate audit table | Full history, query complexity | ✓ |
| Not stored | Out-of-band only | |

**User's choice:** Separate audit table (organizer_audit_log)

| Option | Description | Selected |
|--------|-------------|----------|
| organizerId + action + note + createdAt | No adminUserId for Phase 5 | ✓ |
| organizerId + adminUserId + action + note + createdAt | Admin accountability | |

**User's choice:** organizerId + action + note + createdAt (no adminUserId for now)

| Option | Description | Selected |
|--------|-------------|----------|
| GET /admin/organizers/:id/history | Separate history endpoint | ✓ |
| Included in GET /admin/organizers/:id | Single endpoint with audit array | |
| Not exposed — DB only | No API endpoint in Phase 5 | |

**User's choice:** GET /admin/organizers/:id/history (admin-only)

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — latest rejection note in GET /organizers/me | Organizer knows why rejected | ✓ |
| No — admin-only | Notes internal only | |

**User's choice:** Latest rejection note visible in GET /organizers/me

---

## Claude's Discretion

- VarChar column lengths (name, description, email, website, note) — follow SEC-01 pattern
- URL validation (@IsUrl) on website and social link values
- Whether GET /admin/organizers requires a status param or returns all if omitted
- Exact 409 error body for invalid state transitions
- @CurrentOrganizer() implementation style (createParamDecorator vs interceptor)

## Deferred Ideas

- PATCH /organizers/me (approved organizer profile self-update) — future phase
- M:M user↔organizer (team members, organizer_members join table) — future phase
- suspended organizer state — Phase 9 candidate
- Full paginated GET /admin/organizers (ADMIN-01) — Phase 9
- adminUserId on audit log for accountability — future enhancement
- Auth0 Management API role sync on approval — rejected in favor of DB lookup
