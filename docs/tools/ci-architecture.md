# CI Architecture

FMDFlashcard uses purpose-separated GitHub Actions workflows. Every workflow has explicit timeouts, concurrency, read-only default permissions, immutable external action references, frozen/locked dependency installs, and finite evidence retention.

| Workflow | Triggers | Stable jobs/checks | Permissions |
|---|---|---|---|
| `ci-quality.yml` | pull request, push to `main`, manual | tooling/frontend/Rust quality and repository contract | `contents: read` |
| `ci-tests.yml` | pull request, push to `main`, manual | frontend tests/coverage/build, Rust tests, tooling/Tauri tests | `contents: read` |
| `ci-documentation.yml` | pull request, push to `main`, reusable, manual | strict MkDocs, links/indexes, LaTeX PDF | `contents: read` |
| `ci-tauri.yml` | pull request, push to `main`, manual | native Linux/Windows/macOS smoke and command contract | `contents: read` |
| `ci-nightly.yml` | schedule, manual | complete gates, native package matrix, dependency audits | `contents: read` |
| `_build-desktop.yml` | reusable only | one isolated native target and manifest fragment | `contents: read` |
| `release.yml` | existing `v*` tag, safe manual dispatch | immutable gates, four native targets, assembly, optional publication | read-only except final publication job |

## Branch protection

Configure branch protection using the stable job names emitted by the quality, test, documentation, and Tauri smoke workflows. At minimum require their jobs for tooling quality, frontend quality, Rust quality, frontend tests/coverage/build, Rust tests, tooling tests, documentation, and the three native smoke OS families. Confirm the exact names shown by GitHub after the first workflow run before making the rules mandatory; workflow source tests protect those names from accidental drift.

Path filters are intentionally avoided on required gates so a pull request cannot make a required check disappear. Fork pull requests receive no release/signing secrets and cannot enter a publication path.

## Evidence

Reports and logs are uploaded with `if: always()` so a failing gate remains diagnosable. Required package evidence uses `if-no-files-found: error`; failure diagnostics can use warning semantics only when the diagnostic itself is not the gate. No workflow commits generated content to `main`.

The final release job uses `if: always()` and explicitly rejects any failed, cancelled, or skipped prerequisite before it receives publication permissions.
