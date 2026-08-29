<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Setup and bootstrap

The reproducible CI environment uses Node.js 22.23.2, pnpm 9.15.9, Python
3.11, and Rust 1.97.1. Keep both committed lockfiles and do not change package
manager as part of ordinary setup.

## Inspect first

The doctor is read-only:

```bash
python3 tools/control.py doctor
python3 tools/control.py tauri doctor
```

Review the desktop installation plan before allowing host changes:

```bash
python3 tools/control.py tauri install --dry-run
```

After reviewing that plan, install or verify OS packages, Rust, Node, and the
frontend dependencies with:

```bash
python3 tools/control.py tauri install
```

For a manually prepared host, install only the locked frontend dependencies:

```bash
corepack enable
corepack prepare pnpm@9.15.9 --activate
pnpm --dir frontend install --frozen-lockfile
```

Template-Tooling keeps its Python test environment below the ignored
`.tooling-state/venv/` directory. Prepare only that environment with:

```bash
python3 tools/control.py install \
  --skip-frontend --skip-backend --skip-playwright
```

Real vaults and profiles are runtime data. Do not copy them into `profiles/`,
`config/`, or `fixtures/`; repository fixtures must be anonymous.
