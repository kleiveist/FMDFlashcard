<!-- AUTO-GENERATED:backlink START -->
[← Back](README.md)
<!-- AUTO-GENERATED:backlink END -->
# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog, and this project aims to follow Semantic Versioning.

## [Unreleased]

### Added
- Initial documentation structure (README + docs/user + docs/dev + ADRs)
- Pinned Template-Tooling `0.4.0` with reproducible integration state.
- CI gates for product builds, clean Tooling integration, updates,
  idempotency, rollback, and retired-path regression.
- Anonymous legacy user-vault fixtures and data-migration failure tests.

### Changed
- Moved the frontend to `frontend/` and the Tauri application to root-level
  `src-tauri/`; the former `apps/` layout is retired.
- Separated profile metadata, settings, spaced-repetition users, and exam-run
  Markdown while preserving compatible legacy sources.
- Isolated FMDFlashcard-specific automation under `project-tools/`.

### Fixed
- Prevented committed runtime profiles and learning history from being treated
  as repository examples.
- Made legacy settings and exam-run migration resumable and rollback-safe.

## [0.1.0] - TBD

- Initial public baseline (placeholder)
