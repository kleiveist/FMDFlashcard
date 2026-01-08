<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Releases / Packaging

This project is packaged as a desktop app (commonly via Tauri).

## Local release builds (conceptual)

- Ensure `--doctor` passes
- Run install/bootstrap (`--install`)
- Use the standard packaging command for the desktop app (Tauri bundler)

Because packaging commands vary by OS and CI environment, keep the authoritative steps in CI
and update this document whenever the release pipeline changes.

## Recommended local packaging workflow

Use the control script as the standard entry point for local packaging:

```bash
python3 tools/control.py --build
```

Builds the desktop app release bundles by running `pnpm tauri build`.
Produces platform-specific bundles/installers.

Notes:
- Packaging is OS-specific; build Windows artifacts on Windows, macOS artifacts on macOS, and Linux artifacts on Linux.
- Requires Node + pnpm dependencies and Tauri build prerequisites for the OS.
- Outputs are produced by Tauri under the desktop app's release bundle directory (typically `apps/fmd-desktop/src-tauri/target/release/bundle`).

## Recommended: CI-driven releases

- Tag-based releases
- Automated build artifacts per OS
- Release notes sourced from `CHANGELOG.md`
