# Changelog

All notable changes to this project are documented here. The format follows Keep a Changelog, and versions follow Semantic Versioning.

## [Unreleased]

### Fixed

- Isolated version-tooling tests from ambient GitHub tag variables during release workflows.
- Made the pre-publication existence check tolerate the expected absence of a new GitHub Release under PowerShell.

## [1.0.0] - 2026-09-02

FMDFlashcard 1.0.0 is the first stable release of the local-first desktop application for Markdown flashcards, exams, and spaced-repetition study.

### Added

- Production-grade lifecycle, quality, test, documentation, native packaging, and release commands for the FMDFlashcard desktop application.
- Verified native package contracts for Linux x86_64, Windows x86_64, macOS Apple Silicon, and macOS Intel.
- Deterministic release manifests, SHA-256 checksums, an SPDX SBOM, GitHub provenance support, and platform-specific signing evidence.
- Automated frontend coverage, Rust and Python tooling gates, strict documentation builds, nightly integration, and safe release validation workflows.

### Changed

- Promoted the synchronized application version contract to `1.0.0` across frontend, Cargo, Tauri, release metadata, and documentation.
- Consolidated legacy launch and build helpers behind the cross-platform `control` command while retaining explicit compatibility mappings.
- Standardized repository formatting, generated-file locations, native artifact names, and immutable release-source verification.
- Distributed the project under the MIT License with matching package and native-bundle metadata.
- Resolved Windows package-manager shim execution in captured release audit steps and release toolchain manifests.

### Security

- Removed committed user/runtime data and added release-input denylists for local profiles and state.
- Remediated known RustSec vulnerabilities in the locked Rust dependency graph and made yanked packages release-blocking.
- Added fail-closed archive, symlink, traversal, signature, notarization, checksum, action-pinning, and exact-inventory checks.

### Downloads

| Platform | Architecture | Assets |
|---|---|---|
| Windows | x86_64 | MSI installer, setup executable, portable ZIP |
| Linux | x86_64 | DEB, RPM, AppImage |
| macOS | Apple Silicon (`aarch64`) | DMG, compressed app bundle |
| macOS | Intel (`x86_64`) | DMG, compressed app bundle |

The release also includes a documentation PDF, `SHA256SUMS`, `release-manifest.json`, and `SBOM.spdx.json`—14 assets in total.

### Verification and signing notice

Download all assets into one directory and verify them before installation:

```bash
sha256sum --check SHA256SUMS
```

The native binaries in this release are unsigned, and the macOS applications are not notarized. Windows and macOS may therefore display security warnings. Review `release-manifest.json`, verify `SHA256SUMS`, and install only if you accept this signing state.

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
