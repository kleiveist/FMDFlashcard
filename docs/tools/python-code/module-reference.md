# Python Tooling Module Reference

| Module | Responsibility |
|---|---|
| `tools/control.py` | bootstrap, legacy notice, top-level error boundary |
| `tools/control_parser.py` | help maps, option validation, legacy normalization |
| `tools/control_dispatch.py` | explicit canonical handler dispatch |
| `tools/paths.py` | canonical repository paths and containment checks |
| `tools/process.py` | shell-free child execution, dry-run, PID identity |
| `tools/project_config.py` | SemVer, target/bundle validation, release matrix |
| `tools/artifacts.py` | stale discovery, native validation, deterministic archives, manifests/checksums |
| `tools/commands/environment.py` | doctor and staged install |
| `tools/commands/lifecycle.py` | tracked Tauri run/stop |
| `tools/commands/testing.py` | exact FMD test-suite orchestration |
| `tools/commands/quality.py` | read-only/fix quality gates |
| `tools/commands/build.py` | web archive and native build plans |
| `tools/commands/docs.py` | links, nav, generated indexes, strict MkDocs |
| `tools/commands/tauri.py` | Tauri-specific facade and safe artifact copy |
| `tools/commands/versioning.py` | version checks and explicit synchronization |
| `tools/commands/release.py` | release gate, native collection, final assembly |
| `tools/commands/tooling.py` | FMD command/wrapper/workflow self-check |

Runtime handlers rely on the Python standard library where practical. Development-only Ruff, pytest, MkDocs, and YAML dependencies are pinned in `tools/requirements-dev.txt`.
