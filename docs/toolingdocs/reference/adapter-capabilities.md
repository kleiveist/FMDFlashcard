# Adapter capabilities reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

Invoke one live, profile-selected capability with:

```sh
python tools/control.py tooling action frontend test
python tools/control.py tooling action frontend test --json
```

The adapter must be selected by the active profile and must declare the requested
capability. Commands and arguments are fixed in the built-in policy; callers cannot
inject a command or shell fragment.

| Adapter | Capability | Fixed delegated control command |
| --- | --- | --- |
| `frontend` | `install` | `install --skip-backend --skip-tooling --skip-playwright` |
| `frontend` | `test` | `test --suite frontend` |
| `frontend` | `build` | `build web` |
| `backend` | `install` | `install --skip-frontend --skip-tooling --skip-playwright` |
| `backend` | `test` | `test --suite api` |
| `tauri` | `install` | `tauri install` |
| `tauri` | `run` | `tauri run --no-follow` |
| `tauri` | `stop` | `tauri stop` |
| `tauri` | `test` | `tauri test` |
| `tauri` | `build` | `tauri build` |
| `database` | `test` | `test --suite database` |
| `container` | `test` | `container validate` |
| `container` | `build` | `build container` |
| `quality` | `test` | `quality` |
| `testing` | `test` | `test --suite tools` |
| `documentation` | `test` | `docs check` |
| `release` | `test` | `release check` |

`ci` declares no live capability. Core adapters are always selected; feature adapters
are selected only when their mapped feature is active. For example, `container` requires
the `cloud` feature and `database` requires `database` or `postgres`.

The dispatcher validates that `tools/control.py` is a regular file directly inside the
project's copied `tools/` root, runs without a shell, bounds execution to 900 seconds and
sanitizes/truncates diagnostic output. It supplies temporary home/cache/config/data
locations and disables user Python/Pip configuration, but the command's working
directory is the live project root. These are deliberate live operations: installs,
builds and service actions can change the project or create processes and are not
rolled back by Full-Fix.

Capability execution does not create a missing frontend, backend or Tauri application.
It delegates to the existing control command and returns its real success or failure.
The distinction from transaction-only staged checks is described in
[Full-Fix and actions](../integration/full-fix-and-actions.md).
