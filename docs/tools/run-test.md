# Run and Test

## Run and stop

Foreground development:

```bash
./control run --foreground
```

Without `--foreground`, `run` starts a detached Tauri process and records a fail-closed identity under `.tooling-state/runtime/`. `stop` verifies the repository, PID, process start token, process group, and command line before sending a signal:

```bash
./control run --no-follow
./control stop
```

It never kills an untracked listener or a reused PID.

## Test suites

A bare `test` prints the suite guide. Select one of the exact FMD suites:

| Suite | Gate |
|---|---|
| `frontend` | Vitest unit/component tests; optional V8 coverage |
| `rust` | `cargo test --locked --all-targets` |
| `tooling` | pytest for the Python CLI, artifacts, and workflow contracts |
| `tauri` | project structure, build plans, and locked Cargo check |
| `all` | every suite above in deterministic order |

Examples:

```bash
./control test --suite frontend
./control test --suite frontend --coverage
./control test --suite tooling --report --ci
./control test --suite all --report --ci
```

`--ci` forces non-interactive output. `--report` writes machine-readable evidence below `.reports/`. A child-process failure is returned unchanged and makes `all` fail.

## Quality gate

```bash
./control quality
./control quality lint
./control quality format
./control quality --format json
```

The default gate is read-only and covers frontend lint/format/typecheck/tests, Rust fmt/Clippy/check, Python Ruff/pytest, version and lock consistency, documentation indexes, and workflow/static contracts. `--fix` is the only mutating quality mode.
