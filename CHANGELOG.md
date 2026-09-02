# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog, and versions follow Semantic Versioning.

## [Unreleased]

### Changed

- Release publication remains blocked until verified license terms are added.

## [1.0.0]

### Added

- Production-grade lifecycle, quality, test, documentation, native packaging, and release commands for the FMDFlashcard desktop application.
- Verified native package contracts for Linux x86_64, Windows x86_64, macOS Apple Silicon, and macOS Intel.
- Deterministic release manifests, SHA-256 checksums, an SPDX SBOM, GitHub provenance support, and platform-specific signing evidence.
- Automated frontend coverage, Rust and Python tooling gates, strict documentation builds, nightly integration, and safe release validation workflows.

### Changed

- Promoted the synchronized application version contract to `1.0.0` across frontend, Cargo, Tauri, release metadata, and documentation.
- Consolidated legacy launch and build helpers behind the cross-platform `control` command while retaining explicit compatibility mappings.
- Standardized repository formatting, generated-file locations, native artifact names, and immutable release-source verification.

### Security

- Removed committed user/runtime data and added release-input denylists for local profiles and state.
- Remediated known RustSec vulnerabilities in the locked Rust dependency graph and made yanked packages release-blocking.
- Added fail-closed archive, symlink, traversal, signature, notarization, checksum, action-pinning, and exact-inventory checks.

The release date is intentionally not recorded until a real `v1.0.0` tag is created.

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

This was an untagged development milestone, so no release date is recorded.

## [0.1.0]

Historical initial public baseline. The repository history does not record a verified release date or complete feature inventory, so none is fabricated here.
