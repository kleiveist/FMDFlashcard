# Repository agent guide

Work from the repository root and preserve the single React/Vite/Tauri application. Do not change the Tauri identifier, add updater keys, publish releases, create tags, or commit user/vault/runtime data.

## Canonical commands

```bash
./control doctor
./control install --dry-run
./control run --foreground
./control stop
./control quality
./control test --suite all --report --ci
./control build web
./control build desktop --target linux --dry-run
./control docs check
./control tooling verify
./control version check
./control release check
```

Use `python tools/control.py` directly when a wrapper is unavailable. Bare command groups print their guide. Legacy flag forms are compatibility-only and should not be added to new automation.

## Change rules

- Keep generated state in ignored `.dist/`, `.reports/`, or `.tooling-state/` directories.
- Use locked/frozen dependency commands and preserve both lockfiles.
- Native production packages come only from their declared native runners in `tools/release-matrix.json`.
- Treat signing and notarization state as untrusted until post-build verification succeeds.
- Keep workflow actions pinned to full commit SHAs and workflow permissions read-only except the final publication job.
- Run `git diff --check` and the strongest applicable canonical gates before committing.
- Never add a license identifier or legal ownership claim without repository-owner verification.
