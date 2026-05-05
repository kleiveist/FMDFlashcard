<!-- AUTO-GENERATED:backlink START -->
[← Back](python-code.md)
<!-- AUTO-GENERATED:backlink END -->
# Python Tooling Extension Guide

Use this guide when changing Python tooling behavior. The goal is to keep `tools/control.py` as the stable user-facing entrypoint while individual modules stay small, testable, and dry-run friendly.

## Add A New Control Flag

| Step | Required change |
| --- | --- |
| 1 | Add the flag in `parse_args(argv)` inside [`tools/control.py`](../../../tools/control.py). Use clear help text because this becomes `python3 tools/control.py --help`. |
| 2 | Add a loader function if the command lives in another module. Follow existing `_load_*_runner()` patterns and return `Callable[..., int] | None`. |
| 3 | Add a branch in `main(argv)`. Set `handled = True`, load the runner, print a useful section title for long-running work, and update `exit_code` with the returned code. |
| 4 | Pass `args.dry_run` when the runner accepts it. If the runner has legacy zero-argument support, keep the current `inspect.signature(...)` compatibility pattern. |
| 5 | Add or update documentation in `docs/tools/`, including `control-reference.md` if the CLI surface changes. |

Prefer a dedicated module when the command does real work. Keep `control.py` focused on argument parsing, module loading, and dispatch.

## Add A Runner Module

| Rule | Why it matters |
| --- | --- |
| Expose `run_install(dry_run: bool = False) -> int` for runner-backed commands. | `control.py` can call all runners consistently. |
| Return integer exit codes instead of calling `sys.exit()` inside the runner. | `control.py` can combine results when multiple flags are used. |
| Keep direct execution under `if __name__ == "__main__": raise SystemExit(...)`. | The module remains usable both directly and through `control.py`. |
| Resolve paths from `Path(__file__).resolve()`. | Commands keep working from the repository root and from direct script execution. |
| Use [`tools/inst/console.py`](../../../tools/inst/console.py) for shared output in build/test/install flows. | Terminal output stays consistent for users and CI logs. |

Typical runner shape:

```python
from __future__ import annotations

from pathlib import Path


def _repo_root_from_here() -> Path:
    return Path(__file__).resolve().parents[2]


def run_install(dry_run: bool = False) -> int:
    repo_root = _repo_root_from_here()
    if dry_run:
        print("Dry run mode enabled: commands will not execute.")
    # inspect state, print commands, perform work only when not dry_run
    return 0


if __name__ == "__main__":
    raise SystemExit(run_install(False))
```

Adjust the `parents[...]` depth to the module location. For example, files in `tools/inst/build/` use `parents[3]` to reach the repository root.

## Preserve Dry-Run Behavior

| Operation type | Dry-run expectation |
| --- | --- |
| System inspection | Allowed. It is fine to check `PATH`, read package metadata, inspect existing artifacts, or print settings. |
| Package installation | Do not install. Print the exact command that would run. |
| Build/test/run commands | Do not execute external commands unless the command is explicitly a harmless inspection. |
| Cleanup | Do not delete bundles, portable folders, icons, desktop files, or copied artifacts. |
| File writes/copies | Do not create, overwrite, or chmod files. Print source and destination instead. |

If a runner supports direct CLI usage, add a direct `--dry-run` flag there too. Through `control.py`, the shared `--dry-run` flag should be enough.

## Keep Imports Compatible

`tools/control.py` imports modules by short names after adding tooling folders to `sys.path`.

| Practice | Requirement |
| --- | --- |
| Module names | Keep names unique across `tools/inst`, platform folders, optional `tools/build`, and `tools/inst/build`. |
| Shared imports | Existing modules use imports such as `from console import info` and `from doctor import collect_checks`. Keep that style unless the whole tooling package is refactored together. |
| New folders | If a new folder contains importable runner modules, add it to the `extra_dirs` list in `control.py` before importing the module. |
| Import failures | Loader functions should catch import errors, print the expected file/module, and return `None`. |

Do not convert one runner to package-relative imports in isolation; that can break the current `control.py` loading model.

## Update Documentation

| Change type | Docs to update |
| --- | --- |
| New or changed CLI flag | [`control-reference.md`](../control-reference.md), [`tools.md`](../tools.md), and this folder if implementation details matter. |
| Build command behavior | [`build-package.md`](../build-package.md) and [`module-reference.md`](module-reference.md). |
| Run/test behavior | [`run-test.md`](../run-test.md) and [`module-reference.md`](module-reference.md). |
| Setup/install behavior | [`setup-bootstrap.md`](../setup-bootstrap.md) and [`module-reference.md`](module-reference.md). |
| New Python source file under `tools/` | [`module-reference.md`](module-reference.md) and the active coverage count. |

The docs should explain behavior and extension points, not copy full Python source. Link to source files when exact implementation details matter.

## Validation Checklist

Run the checks that match the change:

```bash
python3 tools/control.py --help
python3 tools/control.py --build --dry-run
rg --files tools -g '*.py'
```

For target-specific runners, also run the safest available dry-run command, such as:

```bash
python3 tools/control.py --install --dry-run
python3 tools/control.py --test --dry-run
python3 tools/control.py --build-lin --dry-run
```

Before finishing, verify that:

| Check | Expected result |
| --- | --- |
| Help output | New flags and aliases are listed with accurate help text. |
| Dry run | No packages are installed, no bundles are removed, and no files are copied or written. |
| Module reference | Every active `tools/**/*.py` file is represented exactly once. |
| Command docs | User-facing command pages match the actual CLI behavior. |

