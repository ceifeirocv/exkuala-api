<!-- CLAUDE.md -->

<!-- Context7_START -->

**Always use** Context7 when I need library/API documentation, code generation, setup or configuration steps without me having to explicitly ask.

<!-- Context7_END -->

<!-- CODEGRAPH_START -->

## CodeGraph

CodeGraph builds a semantic knowledge graph of codebases for faster, smarter code exploration.

### If `.codegraph/` exists in the project

**NEVER call `codegraph_explore` or `codegraph_context` directly in the main session.** These tools return large amounts of source code that fills up main session context. Instead, ALWAYS spawn an Explore agent for any exploration question (e.g., "how does X work?", "explain the Y system", "where is Z implemented?").

**When spawning Explore agents**, include this instruction in the prompt:

> This project has CodeGraph initialized (.codegraph/ exists). Use `codegraph_explore` as your PRIMARY tool — it returns full source code sections from all relevant files in one call.
>
> **Rules:**
>
> 1. Follow the explore call budget in the `codegraph_explore` tool description — it scales automatically based on project size.
> 2. Do NOT re-read files that codegraph_explore already returned source code for. The source sections are complete and authoritative.
> 3. Only fall back to grep/glob/read for files listed under "Additional relevant files" if you need more detail, or if codegraph returned no results.

**The main session may only use these lightweight tools directly** (for targeted lookups before making edits, not for exploration):

| Tool                                      | Use For                              |
| ----------------------------------------- | ------------------------------------ |
| `codegraph_search`                        | Find symbols by name                 |
| `codegraph_callers` / `codegraph_callees` | Trace call flow                      |
| `codegraph_impact`                        | Check what's affected before editing |
| `codegraph_node`                          | Get a single symbol's details        |

### If `.codegraph/` does NOT exist

At the start of a session, ask the user if they'd like to initialize CodeGraph:

"I notice this project doesn't have CodeGraph initialized. Would you like me to run `codegraph init -i` to build a code knowledge graph?"

<!-- CODEGRAPH_END -->

<!-- GSD_START -->

## Project: Cultural Agenda API

This is a NestJS REST API for a cultural events discovery platform. See `.planning/` for full context.

**Stack:** NestJS 11 · PostgreSQL · Prisma · Auth0 (JWT/JWKS) · TypeScript

**Current phase:** Phase 1 — Foundation

### GSD Workflow

This project uses GSD for structured, phase-driven development.

**Key commands:**
- `/gsd-discuss-phase [N]` — Gather context before planning a phase
- `/gsd-plan-phase [N]` — Create detailed plan for a phase
- `/gsd-execute-phase [N]` — Execute all plans in a phase
- `/gsd-progress` — Check current project status

**Planning artifacts:**
- `.planning/PROJECT.md` — Project context and requirements
- `.planning/ROADMAP.md` — 9-phase roadmap (33 requirements)
- `.planning/REQUIREMENTS.md` — Full requirement list with traceability
- `.planning/research/` — Domain research (stack, features, architecture, pitfalls)

### Critical Decisions (must respect in every phase)

1. **Auth0 custom claims namespace** — must be set before Phase 2 (e.g. `https://exkuala.app/roles`)
2. **ORM = Prisma** — schema-first, no TypeORM decorators
3. **Soft delete from day one** — `deletedAt` on Event; never physically delete
4. **Cursor-based pagination** — built into first event listing endpoint
5. **Image strategy = external URLs** — no S3/file upload in v1
6. **JWKS caching** — `jwks-rsa` must have `cache: true`; never fetch per-request
7. **Local user sync** — upsert User row in `validate()` before RSVP/organizer FKs are created

<!-- GSD_END -->
