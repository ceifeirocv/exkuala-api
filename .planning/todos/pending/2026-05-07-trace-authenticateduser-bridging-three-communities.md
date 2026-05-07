---
created: 2026-05-07T00:00:00.000Z
title: Trace AuthenticatedUser bridging JWT Strategy, Organizer Access Control, and Users communities
area: auth
files:
  - src/auth/decorators/authenticated-user.decorator.ts
  - src/auth/strategies/jwt.strategy.ts
---

## Problem

`AuthenticatedUser` (a decorator/type) bridges three separate communities:
- JWT Strategy & Decorators
- Organizer Access Control
- Users & Webhook Processing

Unusual for a shared value object/decorator to serve as a community bridge — may carry too many concerns.

## Solution

Run `/graphify` query tracing all `AuthenticatedUser` callers. Determine if it should be split (e.g. separate auth identity type from request context decorator) or if current shape is acceptable.
