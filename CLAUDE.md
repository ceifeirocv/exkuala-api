# CLAUDE.md

## CodeGraph

If `.codegraph/` exists, never call `codegraph_explore` or `codegraph_context` directly. Always spawn an Explore agent instead — these tools flood the main session context.

When spawning Explore agents, tell them: use `codegraph_explore` as the primary tool, don't re-read files it already returned, only fall back to grep/glob/read for files listed under "Additional relevant files".

In the main session, only use lightweight tools: `codegraph_search` to find symbols, `codegraph_callers`/`codegraph_callees` to trace call flow, `codegraph_impact` before editing, `codegraph_node` for a single symbol's details.

If `.codegraph/` does not exist, ask the user at session start if they want to run `codegraph init -i`.

## Code style

- Functions: 4-20 lines. Split if longer.
- Files: under 500 lines. Split by responsibility.
- One thing per function, one responsibility per module (SRP).
- Names: specific and unique. Avoid `data`, `handler`, `Manager`. Prefer names that return <5 grep hits in the codebase.
- Types: explicit. No `any`, no `Dict`, no untyped functions.
- No code duplication. Extract shared logic into a function/module.
- Early returns over nested ifs. Max 2 levels of indentation.
- Exception messages must include the offending value and expected shape.

## Comments

- Keep your own comments. Don't strip them on refactor — they carry intent and provenance.
- Write WHY, not WHAT. Skip `// increment counter` above `i++`.
- Docstrings on public functions: intent + one usage example.
- Reference issue numbers / commit SHAs when a line exists because of a specific bug or upstream constraint.

## Tests

- Tests run with a single command: `<project-specific>`.
- Every new function gets a test. Bug fixes get a regression test.
- Mock external I/O (API, DB, filesystem) with named fake classes, not inline stubs.
- Tests must be F.I.R.S.T: fast, independent, repeatable, self-validating, timely.

## Dependencies

- Inject dependencies through constructor/parameter, not global/import.
- Wrap third-party libs behind a thin interface owned by this project.

## Structure

- Follow the framework's convention (Rails, Django, Next.js, etc.).
- Prefer small focused modules over god files.
- Predictable paths: controller/model/view, src/lib/test, etc.

## Formatting

- Use the language default formatter (`cargo fmt`, `gofmt`, `prettier`, `black`, `rubocop -A`). Don't discuss style beyond that.

## Logging

- Structured JSON when logging for debugging / observability.
- Plain text only for user-facing CLI output.

## Git

- No agent co-authoring. All commits must be authored by a human with a verified email.
