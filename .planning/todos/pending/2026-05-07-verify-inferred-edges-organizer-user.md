---
created: 2026-05-07T00:00:00.000Z
title: Verify inferred graph edges OrganizerEntity and AuthenticatedUser to UserEntity
area: auth
files:
  - src/organizers/organizer.entity.ts
  - src/users/user.entity.ts
  - src/auth/decorators/authenticated-user.decorator.ts
---

## Problem

Two edges flagged as inferred (not explicit in code) by graph analysis:
- `OrganizerEntity → UserEntity`
- `AuthenticatedUser → UserEntity`

Need to confirm these reflect real runtime dependencies or are graph artifacts from indirect usage.

## Solution

Check source files for direct field references vs. join-only / type-only coupling. Update graph annotations if edges are spurious.
