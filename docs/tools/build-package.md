<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Build and Packaging

This page documents packaging flows provided by `tools/control.py`.

## Build helper overview

List available build targets:

```bash
python3 tools/control.py --build --dry-run
```

## Linux bundles

```bash
python3 tools/control.py --build-lin
```

Typical output root:
- `frontend/src-tauri/target/release/bundle`

Common toggles:
- `NO_STRIP=true|false`
- `CLEAN_BUNDLE=1|0`

## Windows installer bundles

```bash
python3 tools/control.py --build-win
```

Common toggles:
- `WIN_BUNDLES=nsis,msi`
- `ALLOW_CROSS=1`
- `CLEAN_BUNDLE=1|0`

Typical output locations:
- `.../bundle/nsis`
- `.../bundle/msi`

## Windows portable ZIP (Windows host)

```bash
python3 tools/control.py --build-win -p
```

Common toggles:
- `CLEAN_PORTABLE=0`
- `ALLOW_CROSS=1`

Typical output:
- `frontend/src-tauri/target/release/bundle/portable`

## Windows cross-compile on Linux

```bash
python3 tools/control.py --build --winlinux
```

Common toggles:
- `WIN_LINUX_TARGET`
- `WIN_LINUX_RUNNER`
- `WIN_LINUX_BUNDLES`
- `WIN_LINUX_ZIP=0`
- `CLEAN_PORTABLE=0`

Typical output:
- `frontend/src-tauri/target/<target>/release/bundle/portable`

## macOS bundles

```bash
python3 tools/control.py --build-mac
```

Common toggles:
- `MAC_BUNDLES=app,dmg`
- `ALLOW_CROSS=1`
- `CLEAN_BUNDLE=1|0`

## Linux AppImage local installation

Install latest local AppImage into a stable launcher target:

```bash
python3 tools/control.py --install-appimage
```

Installs/updates:
- `~/Applications/FMDFlashcard.AppImage`
- `~/.local/share/applications/fmdflashcard.desktop`
- `~/.local/share/icons/fmdflashcard.*`

## Artifact copy helper

Project-specific external copy flow:

```bash
python3 tools/control.py --build --copy
```

This copies built artifacts into configured external `AppInsall` destination folders.

## Recommended packaging practice

- Use OS-native hosts whenever possible.
- Prefer CI-driven release packaging and artifact publication.
