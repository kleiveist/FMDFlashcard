[← Back to project documentation](../docs/index.md)

# FMDFlashcard frontend

This directory contains the React 19, TypeScript, and Vite application. The
Tauri crate is a sibling at `../src-tauri/`; build hooks in
`src-tauri/tauri.conf.json` invoke this frontend with an explicit working
directory.

Use pnpm 9.15.9 and the committed lockfile:

```bash
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test:run
pnpm build
```

From this directory, start the desktop application with:

```bash
pnpm tauri dev --no-watch
```

Repository-wide setup, Tooling, and packaging commands are documented under
[`docs/tools/`](../docs/tools/tools.md).
