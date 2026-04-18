# Cultural Agenda — API

## What This Is

A REST API powering a Cultural Agenda platform that helps people discover local cultural events (music, theatre, art, cinema, festivals) in their city. Event discovery is driven by proximity + user interests. Organizers are curated — they apply and are approved by admins before publishing events. General public can browse without logging in; authenticated users can RSVP/express interest in events.

## Core Value

**Help people discover local cultural events they'd otherwise miss** — filtered by location and personal interests.

## Who It's For

- **Browsers (unauthenticated):** General public searching/filtering events by location and category
- **Registered users:** Authenticated via Auth0; can RSVP / express interest in events
- **Organizers:** Approved cultural promoters/venues who publish and manage events
- **Admins:** Review organizer applications, moderate events, manage the platform

## Stack

| Layer | Choice |
|-------|--------|
| Framework | NestJS (TypeScript) |
| Database | PostgreSQL |
| Auth | Auth0 (JWT) |
| ORM | TBD (Prisma or TypeORM) |

## Requirements

### Validated

- ✓ NestJS project initialized — existing
- ✓ Basic user, event, organizer structure — existing (early stage)

### Active

**Auth & Identity**
- [ ] Users authenticate via Auth0 (JWT validation)
- [ ] Roles: user, organizer, admin
- [ ] Organizers apply for approval; admins review and approve/reject

**Events**
- [ ] Organizers can create/edit/delete their own events
- [ ] Events have: title, description, date/time, location (venue + address), category/tags, ticket price / external ticket link
- [ ] Events are publicly browsable without authentication
- [ ] Events can be filtered by location (city/area) and category
- [ ] Users can RSVP / express interest in events (requires auth)

**Organizers**
- [ ] Organizer registration/application flow
- [ ] Admin approval/rejection of organizer applications
- [ ] Organizer profile (name, description, contact)

**Discovery**
- [ ] Public event listing with filtering (location, category, date range)
- [ ] Public event detail page

**Admin**
- [ ] Admin can approve/reject organizer applications
- [ ] Admin can moderate (unpublish/remove) events

### Out of Scope (v1)

- Ticketing / payment processing — users link to external ticket platform
- Multi-region / multi-city — MVP is single city/region
- Push notifications — v2
- Social features (comments, sharing) — v2
- Mobile app — API-first, app later

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Auth0 for authentication | Delegated auth, no password management overhead | — Pending implementation |
| Curated organizers (not open) | Quality control over event listings | Admin approval flow required |
| Public browsing, auth for interaction | Lowers friction for discovery | Unauthenticated GET endpoints for events |
| Single region MVP | Focus before scaling | Location scoped to one city initially |

## Context

Greenfield API built on an initialized NestJS scaffold. The existing codebase has skeleton entities for user, event, and organizer but no production features yet. This document represents the full intended scope for the first milestone.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-18 after initialization*
