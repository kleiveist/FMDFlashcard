<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Setup and Bootstrap

This page covers environment checks and bootstrap commands handled by `tools/control.py`.

## 1) Health checks

```bash
python3 tools/control.py --doctor
```

Alias:

```bash
python3 tools/control.py --check
```

Optional JSON output:

```bash
python3 tools/control.py --doctor --json
```

## 2) Install base dependencies

```bash
python3 tools/control.py --install
```

Dry-run:

```bash
python3 tools/control.py --install --dry-run
```

## 3) Optional Linux bootstrap helpers

Install VS Code helper (Linux only):

```bash
python3 tools/control.py --vscode
```

Install Tauri prerequisites (Linux only):

```bash
python3 tools/control.py --tauri
```

Dry-run for Tauri bootstrap:

```bash
python3 tools/control.py --tauri --dry-run
```

## Recommended bootstrap order

1. `--doctor`
2. `--install`
3. `--tauri` (Linux)
4. continue with [Run and test](run-test.md)

## Notes

- `--install`, `--tauri`, and most runner-backed commands support `--dry-run`.
- If `pnpm` is missing, follow the hint from the tooling output (corepack/pnpm installation).
- If rust toolchain checks fail, re-run `--tauri` on Linux or install Rust/Tauri prerequisites for your host OS.
