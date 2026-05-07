---
created: 2026-05-07T00:00:00.000Z
title: Trace why UserEntity bridges three graph communities
area: auth
files:
  - src/users/user.entity.ts
---

## Problem

Graph shows `UserEntity` as a bridge node connecting three communities:
- Users & Webhook Processing
- JWT Strategy & Decorators
- Organizer Admin DTOs

Unclear whether this coupling is intentional domain design or a sign of leaking concerns across module boundaries.

## Solution

Trace all `UserEntity` references across those three communities. Decide: correct design or needs bounded context split.
