---
created: 2026-05-07T00:00:00.000Z
title: Audit graph community edges and cohesion for UserEntity / AuthenticatedUser
area: auth
files:
  - src/users/user.entity.ts
  - src/auth/decorators/authenticated-user.decorator.ts
  - src/auth/strategies/jwt.strategy.ts
  - src/organizers/dto/
---

## Problem

Graph analysis surfaced structural questions about how `UserEntity` and `AuthenticatedUser` connect modules:

1. **Bridge role of UserEntity** — why does it link three distinct communities:
   - Users & Webhook Processing → JWT Strategy & Decorators → Organizer Admin DTOs
   - Is this appropriate coupling or a sign of leaking domain concerns?

2. **Inferred edges accuracy** — two edges flagged as inferred (not explicit in code):
   - `OrganizerEntity → UserEntity`
   - `AuthenticatedUser → UserEntity`
   - Need to verify these reflect real runtime dependencies or are graph artifacts.

3. **Organizer Access Control cohesion = 0.08** — very low; may indicate:
   - Module has unrelated responsibilities bundled together
   - Should split into smaller focused modules (e.g. separate ownership check from role guard)

4. **AuthenticatedUser bridges 3 communities** — JWT Strategy, Organizer Access Control, Users & Webhook.
   - Unusual for a decorator/type to act as a community bridge.
   - Trace whether it carries too many concerns or is just a shared value object used everywhere.

## Solution

- Run `/graphify` query tracing `AuthenticatedUser` callers across communities
- Check `OrganizerEntity` and `UserEntity` for direct field references vs. join-only coupling
- Review `Organizer Access Control` files for responsibility split opportunity
- Decide: refactor or accept current structure before Phase 6 (Events) adds more edges
