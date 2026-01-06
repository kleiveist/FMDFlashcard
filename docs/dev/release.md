# Releases / Packaging

This project is packaged as a desktop app (commonly via Tauri).

## Local release builds (conceptual)

- Ensure `--doctor` passes
- Run install/bootstrap (`--install`)
- Use the standard packaging command for the desktop app (Tauri bundler)

Because packaging commands vary by OS and CI environment, keep the authoritative steps in CI
and update this document whenever the release pipeline changes.

## Recommended: CI-driven releases

- Tag-based releases
- Automated build artifacts per OS
- Release notes sourced from `CHANGELOG.md`
