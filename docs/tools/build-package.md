<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Build and packaging

Inspect a native build without changing files:

```bash
python3 tools/control.py build desktop --dry-run
```

Build Linux bundles through the pinned Tooling:

```bash
python3 tools/control.py build desktop --target linux --bundles deb,rpm
```

The Product Baseline CI job uses this explicit debug-package command after
all frontend and Rust tests pass:

```bash
pnpm --dir frontend tauri build --debug --bundles deb --ci
```

Desktop outputs are generated below `src-tauri/target/` and remain ignored.
CI requires a real Debian package and uploads it as a build artifact. Use the
target-specific help before Windows, portable Windows, macOS, or AppImage
builds:

```bash
python3 tools/control.py build desktop --help
python3 tools/control.py tauri build --help
```

Build on the native target host whenever possible. Packaging must not copy
artifacts to personal or undocumented external directories.
