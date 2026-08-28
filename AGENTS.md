# FMDFlashcard repository guidance

Work on a topic branch and integrate into `main` only through a pull request
whose required CI jobs have passed and which has an independent approval.
Never let automation push generated changes directly to `main`.

## Ownership boundaries

- `frontend/` and `src-tauri/` are product code.
- `config/`, `fixtures/`, `profiles/`, and `shared/` are project-owned data.
- `project-tools/fmdflashcard/` is the extension point for product-specific
  tooling.
- `tools/` and `docs/toolingdocs/` are the pinned Template-Tooling payload.
  Replace them only as one verified payload pair; do not patch them locally.
- `.tooling-state/state.toml` is versioned integration state. Runtime files,
  reports, and the Tooling virtual environment remain ignored.
- Real profiles, vaults, settings, learning history, and other runtime user
  data must never be added to the repository.

## Required checks

Use pnpm 9.15.9 and the lockfiles already in the repository. Before opening a
pull request, run the applicable product checks and all migration acceptance
cases represented by `.github/workflows/ci.yml`. A read-only Tooling command
must leave both `git diff` and `git status --short` unchanged.

The active source tree must not recreate `apps/` or refer to the retired
desktop and user-data paths. Historical references are allowed only in the
migration report and in pinned central regression fixtures.
