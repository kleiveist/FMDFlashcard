<!-- AUTO-GENERATED:backlink START -->
[← Back](README.md)
<!-- AUTO-GENERATED:backlink END -->
# Contributing

Thanks for your interest in contributing.

## Development quickstart

Follow [Setup and bootstrap](docs/tools/setup-bootstrap.md), then use the
locked dependencies already committed to `frontend/` and `src-tauri/`.

## Branch / PR workflow

- Create a feature branch from the default branch.
- Keep PRs focused (one feature/fix per PR).
- Merge into `main` only through a pull request after all required CI jobs pass
  and an independent reviewer approves it.
- Describe:
  - what changed,
  - why it changed,
  - how you tested it.

## Quality guidelines

- If you change evaluation/scoring logic, add tests.
- Avoid UI regressions: keep layout changes intentional and minimal.
- Update documentation when behavior changes (especially parsing and review rules).
- Never commit real vaults, profiles, settings, or learning history. Use
  anonymous deterministic fixtures.

## Reporting issues

When reporting a bug, include:

- OS and version
- steps to reproduce
- expected vs. actual behavior
- a minimal example `#card` block if the issue is related to parsing/review
