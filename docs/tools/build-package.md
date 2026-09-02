# Build and Packaging

## Build map

A bare `build` prints the map and performs no build.

```bash
./control build
./control build web
./control build desktop --dry-run
```

The web build creates a clean Vite build and deterministic archive under `.dist/web/`. It is CI evidence and is not an end-user release asset because the frontend has not been certified for standalone non-Tauri use.

## Native local commands

```bash
./control build desktop --target linux --bundles deb,rpm,appimage
./control build desktop --target windows
./control build desktop --target windows-portable
./control build desktop --target windows-cross-linux
./control build desktop --target macos
```

Use `--dry-run` to validate any plan on any host. Real supported packages require the matching native host. The Windows cross-build remains experimental and produces neither the native MSI nor the complete production installer set.

## Production matrix

| Matrix ID | Native runner | Rust target | Required formats |
|---|---|---|---|
| `linux-x86_64` | Ubuntu 22.04 x86_64 | `x86_64-unknown-linux-gnu` | DEB, RPM, AppImage |
| `windows-x86_64` | Windows Server 2022 | `x86_64-pc-windows-msvc` | MSI, NSIS setup, portable ZIP |
| `macos-aarch64` | macOS 14 Apple Silicon | `aarch64-apple-darwin` | DMG, app tarball |
| `macos-x86_64` | macOS 15 Intel | `x86_64-apple-darwin` | DMG, app tarball |

`tools/release-matrix.json` is the machine-readable source shared by local validation and GitHub Actions. Linux ARM64, Windows ARM64, and universal macOS are not in the required contract because complete native installer sets have not been proven for this repository.

## Tauri artifact commands

```bash
./control tauri build --target linux --dry-run
./control tauri verify-artifacts --matrix-id linux-x86_64
./control tauri copy --dry-run
./control tauri copy --target-dir .dist/export
```

An external copy destination requires `--allow-outside-repo`. Release collection rejects missing, duplicate, empty, stale, symlinked, or unexpected artifacts.
