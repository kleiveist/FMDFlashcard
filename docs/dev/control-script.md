[← Back to Docs Home](../index.md)

# Control script (`tools/control.py`)

The repository contains a Python control script intended to standardize common development tasks.

## Why it exists

- Reduce setup friction across OSes
- Provide a single entry point for “doctor”, installation, and local runs
- Keep command sequences consistent across contributors

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

### Build release bundles

```bash
python3 tools/control.py --build
```

Builds the desktop app release bundles by running `pnpm tauri build`.
Produces platform-specific bundles/installers.

Notes:
- Working directory: `apps/fmd-desktop`.
- Requires Node + pnpm dependencies and Tauri build prerequisites for the OS.
- Outputs are produced by Tauri under the desktop app's release bundle directory (typically `apps/fmd-desktop/src-tauri/target/release/bundle`).

## Suggested workflow

1. `--doctor` to verify dependencies
2. `--install` to install dependencies / bootstrap
3. `--tauri` to prepare Tauri prerequisites
4. `--start` to run the app

For packaging, run `--build` after `--tauri`.

## When to use

- Use `--start` for day-to-day development and local testing.
- Use `--build` when you need release bundles or installers for distribution.

## Extending the control script

If you add new flags, keep them:

- Deterministic (same inputs -> same result)
- Safe by default (no destructive behavior without explicit confirmation)
- Documented here and in `docs/dev/setup.md` if it affects onboarding
