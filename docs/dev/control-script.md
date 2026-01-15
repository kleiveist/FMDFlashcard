<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Control script (`tools/control.py`)

The repository contains a Python control script intended to standardize common development tasks.

## Why it exists

- Reduce setup friction across OSes
- Provide a single entry point for “doctor”, installation, and local runs
- Keep command sequences consistent across contributors
- Centralize platform-specific build/bundling quirks (e.g., AppImage/linuxdeploy)

## Common commands

### Health check

```bash
python3 tools/control.py --doctor
```

### Install / setup

```bash
python3 tools/control.py --install
```

### Prepare / run Tauri tooling

```bash
python3 tools/control.py --tauri
```

### Start the app

```bash
python3 tools/control.py --start
```

### Run tests — `--test`

```bash
python3 tools/control.py --test
```

Runs `pnpm -C apps/fmd-desktop test` with the same structured logging you see in the other runners.

Notes:
- `--dry-run` prints the command that would run without executing it.
- Requires `pnpm` in PATH and the desktop app dependencies already installed.

## Build helper

The control script provides a build helper entry that prints the available OS targets and the most relevant environment toggles. This is useful for onboarding and quick discovery.

Example:

```bash
python3 tools/control.py --build --dry-run

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ Build helper
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ Available targets:
ℹ   --build-lin  Linux release (NO_STRIP, CLEAN_BUNDLE).
ℹ   --build-win  Windows bundles (WIN_BUNDLES=nsis,msi, ALLOW_CROSS).
ℹ   --build-mac  macOS bundles (MAC_BUNDLES=app,dmg, ALLOW_CROSS).
```

Notes:
- `--build` is intended as a *helper/dispatcher* entry. For actual bundling, use one of the platform-specific targets below.
- `--dry-run` prints intended steps without executing commands.

## Build release bundles

All build commands:
- run `pnpm tauri build` in `apps/fmd-desktop`
- produce platform-specific bundles/installers
- output artifacts under:
  `apps/fmd-desktop/src-tauri/target/release/bundle`

### Build (Linux) — `--build-lin`

```bash
python3 tools/control.py --build-lin
```

Produces Linux bundles, typically:
- `.AppImage`
- `.deb`
- `.rpm`

Notes:
- Working directory: `apps/fmd-desktop`.
- Some distros/toolchains can hit `linuxdeploy` strip issues when building AppImages.
  The Linux runner may default `NO_STRIP=true` to improve reliability.

Useful environment toggles (if supported by the runner):
- `NO_STRIP=true|false` (default may be `true`)
- `CLEAN_BUNDLE=1|0` (delete old `target/release/bundle` before bundling)

Examples:

```bash
# Default Linux build (may default NO_STRIP=true)
python3 tools/control.py --build-lin

# Force strip (only if you know your linuxdeploy/toolchain supports it)
NO_STRIP=false python3 tools/control.py --build-lin

# Keep existing bundle output directory
CLEAN_BUNDLE=0 python3 tools/control.py --build-lin
```

### Build (Windows) — `--build-win`

```bash
python3 tools/control.py --build-win
```

Produces Windows installers, typically:
- `nsis` (`*-setup.exe`)
- `msi` (`*.msi`)

Notes:
- Intended to be run on Windows (or in Windows CI).
- Output typically appears under:
  - `.../bundle/nsis`
  - `.../bundle/msi`

Optional environment toggles (if supported by the runner):
- `WIN_BUNDLES=nsis,msi` (restrict bundle targets)
- `ALLOW_CROSS=1` (attempt to run on non-Windows hosts; may not work depending on toolchain)

Example:

```bash
WIN_BUNDLES=nsis,msi python3 tools/control.py --build-win
```

### Build (macOS) — `--build-mac`

```bash
python3 tools/control.py --build-mac
```

Produces macOS bundles, typically:
- `app`
- `dmg` (depending on your Tauri config)

Notes:
- Intended to be run on macOS (or in macOS CI).
- Code signing/notarization depends on your local environment and CI secrets.
- Output typically appears under `.../bundle/` subfolders depending on targets.

Optional environment toggles (if supported by the runner):
- `MAC_BUNDLES=app,dmg` (restrict bundle targets)
- `ALLOW_CROSS=1` (attempt to run on non-macOS hosts; may not work depending on toolchain)

Example:

```bash
MAC_BUNDLES=app,dmg python3 tools/control.py --build-mac
```

## Suggested workflow

1. `--doctor` to verify dependencies
2. `--install` to install dependencies / bootstrap
3. `--tauri` to prepare Tauri prerequisites
4. `--start` to run the app

For packaging, run the OS-appropriate build command:
- Linux: `--build-lin`
- Windows: `--build-win`
- macOS: `--build-mac`

## When to use

- Use `--start` for day-to-day development and local testing.
- Use `--build-lin` / `--build-win` / `--build-mac` when you need release bundles or installers for distribution.

## Extending the control script

If you add new flags, keep them:

- Deterministic (same inputs -> same result)
- Safe by default (no destructive behavior without explicit confirmation)
- Documented here and in `docs/dev/setup.md` if it affects onboarding
- Consistent with the “runner” pattern under `tools/inst/` (thin control script, logic in dedicated runners)
