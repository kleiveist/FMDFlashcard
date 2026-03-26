<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Run and Test

This page covers local app execution and test execution via `tools/control.py`.

## Start the desktop app

Primary command:

```bash
python3 tools/control.py --start
```

Alias:

```bash
python3 tools/control.py --run
```

Dry-run:

```bash
python3 tools/control.py --start --dry-run
```

Direct fallback command:

```bash
pnpm -C apps/fmd-desktop tauri dev
```

## Run test suite

Primary command:

```bash
python3 tools/control.py --test
```

Dry-run:

```bash
python3 tools/control.py --test --dry-run
```

Direct fallback command (runner-equivalent base):

```bash
pnpm -C apps/fmd-desktop exec vitest run --watch=false
```

Alternative package-script shortcut:

```bash
pnpm -C apps/fmd-desktop test
```

## Optional test environment controls

The test runner supports environment toggles:
- `FMD_TEST_TIMEOUT_SECONDS`
- `FMD_TEST_ISOLATE_ON_TIMEOUT`
- `FMD_TEST_ISOLATE_ON_FAILURE`
- `FMD_TEST_ISOLATE_ONLY`
- `FMD_TEST_FILE_TIMEOUT_SECONDS`

Use these only when debugging hangs/timeouts in CI or local runs.
