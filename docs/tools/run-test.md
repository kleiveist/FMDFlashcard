<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Run and test

## Start the desktop app

After setup, start Tauri in the foreground so the terminal owns the process:

```bash
python3 tools/control.py tauri run --foreground
```

The direct project command is:

```bash
pnpm --dir frontend tauri dev --no-watch
```

## Product checks

Run the same deterministic checks used by the Product Baseline CI job:

```bash
pnpm --dir frontend install --frozen-lockfile
pnpm --dir frontend lint
pnpm --dir frontend typecheck
pnpm --dir frontend test:run
pnpm --dir frontend build
cargo check --locked --manifest-path src-tauri/Cargo.toml
cargo test --locked --manifest-path src-tauri/Cargo.toml
```

## Tooling checks

The installed Tooling state must be a read-only no-op:

```bash
python3 tools/control.py integrate --check --json
python3 tools/control.py tooling verify --json
python3 tools/control.py test --suite tools
```

FMDFlashcard's isolated migration cases are documented in
[`project-tools/fmdflashcard/README.md`](../../project-tools/fmdflashcard/README.md).
The CI workflow runs each case as its own required job.
