# Developer ↔ Codex Workflow

## Purpose
A repeatable workflow for turning ideas/bugs into tested changes using Codex, with clear artifacts and quality gates.

## Roles
- **Developer:** defines scope, acceptance criteria, file paths, and approves changes.
- **Codex:** implements changes, adds/updates tests and docs within constraints.

## Core artifacts
1. **Concept note:** problem + desired behavior + risks/edge cases.
2. **Task spec:** DoD + acceptance criteria + test plan + affected modules/files.
3. **Codex prompt:** ordered change list, non-goals, exact paths, tests to run, stop conditions.
4. **Implementation:** small, reviewable changesets.
5. **Testing gate:** build + required checks (parser/UI smoke).
6. **Bugfix loop:** root cause → fix → regression test → doc update.
7. **Release note (optional):** user impact + migration hints.

## End-to-end flow
1) Intake / Triage  
2) Concept (solution sketch)  
3) Task spec (DoD + tests)  
4) Codex prompt (context + constraints)  
5) Codex implements (code + tests + docs)  
6) Testing gate (pass/fail)  
7) Bugfix loop (if fail)  
8) Release / merge (if pass)

## Quality gates (minimum DoD)
- Acceptance criteria met  
- No regression in core paths (manual smoke + automated tests where available)  
- If parser/rendering changed: add/update a reproducible `.md` test file in `docs/dev/test/`  
- Docs updated when behavior/syntax changes

## Where things go
- **Process docs:** `docs/dev/` (this file)
- **User syntax/source of truth:** `docs/user/` and `docs/user/examples/`
- **Repro test markdown (“golden files”):** `docs/dev/test/`
- **Issue tracking notes (if used):** `docs/issus/`

![Workflow diagram](docs/assets/codex-workflow.svg)
