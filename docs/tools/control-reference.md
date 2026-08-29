<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Control script reference

This page records the command groups confirmed against pinned Template-Tooling
`0.4.0`. The executable help remains authoritative:

```bash
python3 tools/control.py --help
python3 tools/control.py <command> --help
```

| Purpose | Command |
| --- | --- |
| Diagnose | `python3 tools/control.py doctor` |
| Prepare dependencies | `python3 tools/control.py install` |
| Run configured services | `python3 tools/control.py run` |
| Run desktop development | `python3 tools/control.py tauri run --foreground` |
| Select a test suite | `python3 tools/control.py test --suite <suite>` |
| Build the web app | `python3 tools/control.py build web` |
| Plan a desktop build | `python3 tools/control.py build desktop --dry-run` |
| Build desktop artifacts | `python3 tools/control.py build desktop` |
| Read-only integration plan | `python3 tools/control.py integrate --check --json` |
| Transactional integration | `python3 tools/control.py integrate --full-fix --json` |
| Verify installed Tooling | `python3 tools/control.py tooling verify --json` |
| Read-only update plan | `python3 tools/control.py tooling migrate --check --json` |
| Apply registered updates | `python3 tools/control.py tooling migrate --json` |
| Export a portable payload | `python3 tools/control.py tooling export --output PATH` |

An integration or update check exits with status `1` when a supported change
is required and `0` for a verified no-op. A check must not modify the working
tree. Writing integration and migration commands are transactional, but still
require a clean branch, reviewed plan, and a Git rollback point.

Supported test suite names are shown by:

```bash
python3 tools/control.py test --help
```

The current map includes `frontend`, `tools`, `tauri`, and `all`; backend and
cloud capabilities are not enabled by FMDFlashcard's `desktop-local` profile.
