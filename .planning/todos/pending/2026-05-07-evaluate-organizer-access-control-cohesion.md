---
created: 2026-05-07T00:00:00.000Z
title: Evaluate splitting Organizer Access Control module (cohesion 0.08)
area: auth
files:
  - src/organizers/
---

## Problem

Graph reports Organizer Access Control community cohesion = 0.08 (very low). Indicates bundled unrelated responsibilities — likely ownership check mixed with role guard logic.

## Solution

Review files in the community. Identify distinct responsibilities. Propose split into focused modules before Phase 6 adds more edges and compounds the problem.
