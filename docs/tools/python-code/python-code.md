<!-- AUTO-GENERATED:backlink START -->
[← Back](../tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Python Tooling Code

<!-- AUTO-GENERATED:docs-index START -->

## Pages
- [Module Reference](module-reference.md)
- [Extension Guide](extension-guide.md)

<!-- AUTO-GENERATED:docs-index END -->

This folder documents the Python tooling under `tools/`. It is a developer reference, not a source mirror: keep source code in the Python files and use these pages to explain responsibilities, routing, extension points, and safe change patterns.

## Architecture

| Layer | Source files | Role | Change here when |
| --- | --- | --- | --- |
| CLI entrypoint | [`tools/control.py`](../../../tools/control.py) | Parses flags, loads runner modules, and combines exit codes. | Adding, renaming, or rerouting top-level `python3 tools/control.py ...` commands. |
| Shared console output | [`tools/inst/console.py`](../../../tools/inst/console.py) | Provides consistent section, status, command, and key/value output helpers. | Output formatting should change across build/test/install runners. |
| Health checks | [`tools/inst/doctor.py`](../../../tools/inst/doctor.py) | Detects required tools, Rust, Node, and Linux Tauri system libraries. | Required dependencies or diagnostic categories change. |
| Installers | [`tools/inst/linux/`](../../../tools/inst/linux), [`tools/inst/mac/installmac.py`](../../../tools/inst/mac/installmac.py), [`tools/inst/win/installwin.py`](../../../tools/inst/win/installwin.py) | Install missing dependencies on the current OS. | Package mappings, distro selection, or bootstrap behavior changes. |
| Run/test runners | [`tools/inst/run.py`](../../../tools/inst/run.py), [`tools/inst/run_test.py`](../../../tools/inst/run_test.py) | Start the Tauri app and run the Vitest suite through `pnpm`. | Local dev startup or test orchestration changes. |
| Build runners | [`tools/inst/build/`](../../../tools/inst/build) | Build Linux, Windows, macOS, cross-compile, portable, and copy artifacts. | Packaging commands, bundle cleanup, artifact selection, or copy targets change. |
| Fix helpers | [`tools/fixes/pacman_keyring_fix.py`](../../../tools/fixes/pacman_keyring_fix.py) | Provides a targeted recovery helper for Arch pacman keyring/signature failures. | A package-manager repair routine needs to be added or adjusted. |

## Import And Dispatch Model

`tools/control.py` is the only supported top-level entrypoint. It adds the tooling folders to `sys.path`, imports modules by short module name, then calls their exported entry functions.

| Mechanism | Current behavior | Developer note |
| --- | --- | --- |
| Repository root | `tools/control.py` treats the repo root as one level above `tools/`. | Run commands from the repository root unless a direct script explicitly supports another root. |
| Module lookup | Adds `tools/inst`, platform installer folders, optional `tools/build`, and `tools/inst/build` to `sys.path`. | Keep module filenames unique because imports use names like `build_lin`, not package-qualified paths. |
| Runner contract | Most modules expose `run_install(dry_run: bool = False) -> int`. | Return process-style exit codes; reserve `raise SystemExit(...)` for direct script execution blocks. |
| Dry-run handling | `--dry-run` is passed to most runner-backed commands. | A dry run may inspect the system, but it must not install packages, remove bundles, copy artifacts, or scaffold files. |
| Exit code handling | `control.py` tracks whether a command was handled and keeps the maximum non-zero exit code. | Multi-flag invocations may run more than one branch; avoid hidden exits inside runners. |

## Command Routing

| CLI flag or combination | Loaded module/function | Main behavior |
| --- | --- | --- |
| `--doctor`, `--check` | [`doctor.run(want_json)`](../../../tools/inst/doctor.py) | Prints environment checks and summary. |
| `--doctor --json` | [`doctor.run(True)`](../../../tools/inst/doctor.py) | Adds JSON output after the human-readable report. |
| `--install` | OS-selected `run_install(dry_run)` | Windows uses [`installwin.py`](../../../tools/inst/win/installwin.py), macOS uses [`installmac.py`](../../../tools/inst/mac/installmac.py), Linux uses [`installuix.py`](../../../tools/inst/linux/installuix.py). |
| `--vscode` | [`installuixvs.run_install()`](../../../tools/inst/linux/installuixvs.py) | Installs Visual Studio Code helper on Linux. |
| `--tauri` | [`installuixtauri.run_install(dry_run)`](../../../tools/inst/linux/installuixtauri.py) | Installs Linux Tauri prerequisites and ensures the app dependencies. |
| `--run`, `--start` | [`run.run_install(dry_run)`](../../../tools/inst/run.py) | Starts the desktop app with `pnpm tauri dev`. |
| `--test` | [`run_test.run_install(dry_run)`](../../../tools/inst/run_test.py) | Runs Vitest with non-watch settings and isolation fallback. |
| `--build` | Internal helper in [`control.py`](../../../tools/control.py) | Prints available build targets when not combined with `--winlinux` or `--copy`. |
| `--build-lin` | [`build_lin.run_install(dry_run)`](../../../tools/inst/build/build_lin.py) | Builds Linux desktop bundles. |
| `--build-win` | [`build_win.run_install(dry_run)`](../../../tools/inst/build/build_win.py) | Builds Windows installer bundles. |
| `--build-win -p` | [`build_win_p.run_install(dry_run)`](../../../tools/inst/build/build_win_p.py) | Builds a Windows portable executable and ZIP. |
| `--build-mac` | [`build_mac.run_install(dry_run)`](../../../tools/inst/build/build_mac.py) | Builds macOS app/DMG bundles. |
| `--build --winlinux` | [`buildwin_linux.run_install(dry_run)`](../../../tools/inst/build/buildwin_linux.py) | Cross-compiles a Windows target from Linux. |
| `--build --copy` | [`build_copy.run_install(dry_run)`](../../../tools/inst/build/build_copy.py) | Copies build artifacts into configured external `AppInsall` destinations. |
| `--install-appimage`, `--appimage` | [`installappimage.run_install(...)`](../../../tools/inst/linux/installappimage.py) | Installs the latest local Linux AppImage into stable user launcher paths. |

## Lifecycle Flows

| Flow | Command | What happens | Primary files |
| --- | --- | --- | --- |
| Health check | `python3 tools/control.py --doctor` | Collects shell/PATH, core tools, Rust, Node, and platform-specific Tauri dependency checks. | [`control.py`](../../../tools/control.py), [`doctor.py`](../../../tools/inst/doctor.py) |
| Bootstrap install | `python3 tools/control.py --install` | Runs doctor checks, maps missing tools to OS packages, and installs supported dependencies. | [`installuix.py`](../../../tools/inst/linux/installuix.py), [`installmac.py`](../../../tools/inst/mac/installmac.py), [`installwin.py`](../../../tools/inst/win/installwin.py) |
| Tauri setup | `python3 tools/control.py --tauri` | Linux-only helper for GUI/system build libraries, Node/pnpm, Rust, and project dependency install. | [`installuixtauri.py`](../../../tools/inst/linux/installuixtauri.py) |
| Local run | `python3 tools/control.py --start` | Verifies `pnpm` and Rust, refreshes stale or incomplete `node_modules`, then runs `pnpm tauri dev`. | [`run.py`](../../../tools/inst/run.py) |
| Tests | `python3 tools/control.py --test` | Ensures JS dependencies, forces `CI=1`, runs Vitest, and can retry per test file after a timeout or failure. | [`run_test.py`](../../../tools/inst/run_test.py) |
| Build/package | `python3 tools/control.py --build-lin` and related build flags | Cleans previous bundles if enabled, runs `pnpm install`, runs `pnpm tauri build`, and lists artifacts. | [`tools/inst/build/`](../../../tools/inst/build) |
| Local AppImage install | `python3 tools/control.py --install-appimage` | Selects a local AppImage and icon, then writes stable user-level launcher files. | [`installappimage.py`](../../../tools/inst/linux/installappimage.py) |

## Newcomer Change Map

| Goal | Start here | Validation |
| --- | --- | --- |
| Add a new top-level command | [Extension Guide](extension-guide.md) and [`tools/control.py`](../../../tools/control.py) | `python3 tools/control.py --help` |
| Change dependency detection | [`tools/inst/doctor.py`](../../../tools/inst/doctor.py) and the matching installer module | `python3 tools/control.py --doctor` |
| Change Linux package mappings | [`installuixarc.py`](../../../tools/inst/linux/installuixarc.py) or [`installuixubu.py`](../../../tools/inst/linux/installuixubu.py) | `python3 tools/control.py --install --dry-run` |
| Change build output or bundle cleanup | Matching file in [`tools/inst/build/`](../../../tools/inst/build) | `python3 tools/control.py --build --dry-run` and the target-specific dry run |
| Change test timeout behavior | [`tools/inst/run_test.py`](../../../tools/inst/run_test.py) | `python3 tools/control.py --test --dry-run` |

