# Control Script Reference

Use `./control`, `.\control.ps1`, `control.cmd`, or `python tools/control.py`. All forms return the canonical handler's exit code.

## Canonical commands

| Group | Commands and important options | Bare behavior |
|---|---|---|
| Environment | `doctor [--json|--watch --interval N]`, `install [--dry-run] [--skip-*]` | root help |
| Lifecycle | `run [--foreground|--no-follow]`, `stop` | executes selected action |
| Tests | `test --suite frontend|rust|tooling|tauri|all [--coverage] [--report] [--ci]` | suite guide |
| Quality | `quality [check|lint|format] [--format text|json] [--release] [--fix]` | complete read-only gate |
| Build | `build web`, `build desktop --target ... [--bundles ...] [--dry-run]` | build guide |
| Documentation | `docs check`, `docs index [--dry-run]` | docs guide |
| Tauri | `tauri doctor|install|install-appimage|run|stop|build|test|copy|verify-artifacts` | Tauri guide |
| Version | `version check`, `version sync` | version guide |
| Release | `release check` | release guide |
| Self-check | `tooling verify [--json]` | tooling guide |

Release CI also uses `release collect`, `release assemble`, `release verify`, and `release notes`. These commands normalize native evidence but never publish or create a tag.

## Legacy compatibility

Legacy forms are normalized before parsing, emit a deprecation notice on stderr, and then use the canonical handler. `--doctor --json` keeps stdout machine-readable and suppresses the notice.

| Existing invocation | Canonical behavior |
|---|---|
| `--doctor`, `--check` | `doctor` |
| `--doctor --json` | `doctor --json` |
| `--install` | `install` |
| `--run`, `--start` | `run` |
| `--test` | `test --suite frontend` |
| `--tauri` | `tauri install` |
| `--install-appimage`, `--appimage` | `tauri install-appimage` |
| `--build` | bare build guide |
| `--build-lin` | `build desktop --target linux` |
| `--build-win` | `build desktop --target windows` |
| `--build-win -p`, `--portable` | `build desktop --target windows-portable` |
| `--build-mac` | `build desktop --target macos` |
| `--build --winlinux` | `build desktop --target windows-cross-linux` |
| `--build --copy` | `tauri copy` |
| `--VScode`, `--vscode` | explicit legacy Linux VS Code install helper |

`--dry-run` is propagated. Ambiguous combinations and unknown arguments print actionable help and exit `2`; nothing is silently ignored.
