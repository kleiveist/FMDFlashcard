# Contributing

Thank you for contributing to FMDFlashcard.

Participation in this project is governed by the [Code of Conduct](CODE_OF_CONDUCT.md). Use the repository's structured bug and feature forms so reports contain the information needed for review.

## Development setup

Use the repository-root command contract:

```bash
./control doctor
./control install --dry-run
./control install
```

The real install creates a repository-local `.venv`; all root wrappers automatically use it on subsequent calls. Direct callers should activate `.venv` or run `.venv/bin/python tools/control.py ...` (Windows: `.venv\Scripts\python.exe`). The supported toolchain versions are declared in `.github/toolchains.json`, `apps/fmd-desktop/package.json`, and `rust-toolchain.toml`. Dependency installs use committed lockfiles.

## Pull requests

- Keep changes focused and preserve the Tauri application identifier.
- Explain what changed, why it changed, and how it was tested.
- Add regression tests for changed behavior.
- Do not commit `.dist/`, `.reports/`, `.tooling-state/`, runtime profiles, vault data, caches, or secrets.
- Do not create tags, publish releases, or weaken Tauri capabilities as part of ordinary changes.

Run these gates before requesting review:

```bash
./control quality
./control test --suite all --report --ci
./control build web
./control docs check
./control tooling verify
./control version check
./control release check
git diff --check
```

Platform-specific native packages must be validated by the matching GitHub Actions runner. Local dry-run plans are required when the host cannot execute a target:

```bash
./control build desktop --target windows --dry-run
./control build desktop --target macos --dry-run
```

## Formatting and fixes

`./control quality` is read-only. Use `./control quality --fix` only when you intend to apply formatter-owned edits, then review every changed file.

## Security reports

Follow [SECURITY.md](SECURITY.md). Do not include credentials, private vault content, signing material, or user data in public issues or test fixtures.
