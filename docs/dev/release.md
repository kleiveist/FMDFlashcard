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

## Linux: install latest built AppImage locally

After building Linux bundles, install the latest local AppImage with a stable filename:

```bash
python3 tools/control.py --install-appimage
```

This command installs to:
- `~/Applications/FMDFlashcard.AppImage`
- `~/.local/share/applications/fmdflashcard.desktop`
- `~/.local/share/icons/fmdflashcard.*`

Typical flow:

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```

## Windows packaging matrix

- `python3 tools/control.py --build-win`
  - Installer bundles (`nsis` / `msi`, depending on `WIN_BUNDLES`)
  - Typical outputs: `.../target/release/bundle/nsis` and `.../target/release/bundle/msi`
- `python3 tools/control.py --build-win -p`
  - Portable ZIP flow on a Windows build host
  - Typical output: `.../target/release/bundle/portable/<exe>-portable.zip`
- `python3 tools/control.py --build --winlinux`
  - Linux-only Windows cross-compile flow (`cargo-xwin`)
  - Typical output: `.../target/<target>/release/bundle/portable`

Common env toggles:
- `WIN_BUNDLES` (installer bundle selection for `--build-win`)
- `CLEAN_PORTABLE` (portable cleanup behavior)
- `WIN_LINUX_TARGET`, `WIN_LINUX_RUNNER`, `WIN_LINUX_BUNDLES`, `WIN_LINUX_ZIP` (cross-compile flow)

Inno note:
- The current repository does not include a dedicated Inno portable build flow.
- Portable artifacts are produced by the existing ZIP-based portable workflows.

## Recommended: CI-driven releases

- Tag-based releases
- Automated build artifacts per OS
- Release notes sourced from `CHANGELOG.md`
