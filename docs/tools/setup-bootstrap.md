# Setup and Bootstrap

## Supported toolchains

The hosted contract is pinned in `.github/toolchains.json`. The frontend also pins pnpm through `packageManager`, and Rust uses `rust-toolchain.toml`. At minimum, install Git, Python, Node.js, pnpm/Corepack, Rust/Cargo, and the native Tauri prerequisites for your OS.

## Inspect first

`doctor` is read-only and returns nonzero when a required prerequisite is missing:

```bash
./control doctor
./control doctor --json
./control doctor --watch --interval 10
```

JSON mode writes only the stable JSON document to stdout.

## Install

Preview the exact host-specific plan before allowing package installation:

```bash
./control install --dry-run
./control install
```

Stages can be disabled explicitly:

```bash
./control install --skip-system-deps
./control install --skip-rust
./control install --skip-node
./control install --skip-frontend
```

Frontend dependencies use `pnpm install --frozen-lockfile`. Dry-run starts no child process and changes no file. System-package installation can require host administrator privileges; review the dry-run first.

## Direct development dependencies

For Python tooling checks, use an isolated environment:

```bash
python -m venv .venv
.venv/bin/python -m pip install --requirement tools/requirements-dev.txt
```

On Windows, the environment interpreter is `.venv\Scripts\python.exe`.
