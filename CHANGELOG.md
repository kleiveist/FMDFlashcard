# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog, and versions follow Semantic Versioning.

## [Unreleased]

### Changed

- Release publication remains blocked until verified license terms are added.

## [0.2.0]

### Added

- Repository-owned lifecycle, quality, test, documentation, Tauri, version, and release command groups.
- Native release contracts for Windows x86_64, Linux x86_64, macOS Apple Silicon, and macOS Intel.
- Purpose-separated CI, nightly package validation, checksums, manifests, SBOM, and provenance support.

### Changed

- Established `VERSION` as the application version source of truth.
- Replaced scaffold Cargo identity and metadata with FMDFlashcard-owned values.
- Replaced the generated-PDF commit workflow with artifact-only documentation evidence.

### Security

- Removed committed local profile/runtime data from release inputs.
- Added fail-closed artifact, path, archive, workflow, and release-contract validation.

The release date is intentionally not recorded until a real `v0.2.0` tag is created.

## [0.1.0]

Historical initial public baseline. The repository history does not record a verified release date or complete feature inventory, so none is fabricated here.
