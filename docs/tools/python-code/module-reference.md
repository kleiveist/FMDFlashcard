<!-- AUTO-GENERATED:backlink START -->
[← Back](python-code.md)
<!-- AUTO-GENERATED:backlink END -->
# Python Tooling Module Reference

This page documents every active Python source file returned by:

```bash
rg --files tools -g '*.py'
```

Generated cache files and `.BAK` files are intentionally excluded from this reference.

## Entrypoint And Shared Modules

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/control.py`](../../../tools/control.py) | `main(argv)`, `parse_args(argv)` | User runs `python3 tools/control.py ...` | CLI flags, current OS, `PATH`, repository layout. | Loads modules, dispatches commands, returns aggregate exit code. | Add or change top-level toolbox commands. |
| [`tools/inst/console.py`](../../../tools/inst/console.py) | `section`, `info`, `ok`, `warn`, `err`, `cmd`, `kv` | Build/test/install runners import these helpers. | Message strings and command arguments. | Prints consistent terminal output. | Change shared console formatting or add a reusable output helper. |
| [`tools/inst/doctor.py`](../../../tools/inst/doctor.py) | `run(want_json=False)`, `collect_checks()` | `control.py --doctor`, installer modules. | `PATH`, `CARGO_HOME`, Windows `ProgramFiles(x86)`, available commands, platform package tools. | Prints check report; optional JSON; exposes missing-check helpers. | Add/remove required tools or change dependency categories. |

## Run And Test Modules

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/inst/run.py`](../../../tools/inst/run.py) | `run_install(dry_run=False)` | `control.py --run` and `--start` | `DISPLAY`, `WAYLAND_DISPLAY`, `apps/fmd-desktop/package.json`, `node_modules`, `pnpm`, Rust tools. | May run `pnpm install`; starts `pnpm tauri dev`; may try `xvfb-run` on headless Linux. | Local desktop startup behavior changes. |
| [`tools/inst/run_test.py`](../../../tools/inst/run_test.py) | `run_install(dry_run=False)` | `control.py --test` | `FMD_TEST_TIMEOUT_SECONDS`, `FMD_TEST_FILE_TIMEOUT_SECONDS`, `FMD_TEST_ISOLATE_ON_TIMEOUT`, `FMD_TEST_ISOLATE_ON_FAILURE`, `FMD_TEST_ISOLATE_ONLY`. | May run `pnpm install`; runs Vitest; logs/terminates timed-out processes; can isolate by file. | Test orchestration, timeout, or failure-isolation policy changes. |

## Linux Install Modules

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/inst/linux/installuix.py`](../../../tools/inst/linux/installuix.py) | `run_install(dry_run=False)` | `control.py --install` on Linux. | `/etc/os-release`, available package managers. | Selects and calls the Arch, Ubuntu, or Debian installer module. | Linux distro detection or installer routing changes. |
| [`tools/inst/linux/installuixarc.py`](../../../tools/inst/linux/installuixarc.py) | `run_install(dry_run=False)` | `installuix.py` on Arch/pacman systems. | Doctor missing checks, `FMD_PACMAN_NOCONFIRM`, `FMD_PACMAN_UPGRADE`, `pacman`. | Runs optional system upgrade, installs pacman packages, may invoke the pacman keyring fix. | Arch package mappings or pacman recovery behavior changes. |
| [`tools/inst/linux/installuixdeb.py`](../../../tools/inst/linux/installuixdeb.py) | Re-exported `run_install` from `installuixubu.py` | `installuix.py` on Debian-like systems. | Same as Ubuntu installer. | Delegates to the apt installer. | Debian should diverge from Ubuntu behavior. |
| [`tools/inst/linux/installuixubu.py`](../../../tools/inst/linux/installuixubu.py) | `run_install(dry_run=False)` | `installuix.py` on Ubuntu/apt systems and `installuixdeb.py`. | Doctor missing checks, `apt-get`, `apt-cache`, Rust tool availability. | Runs `apt-get update/install`; installs Rust with rustup when needed. | Apt package mappings or Rust bootstrap behavior changes. |
| [`tools/inst/linux/installuixtauri.py`](../../../tools/inst/linux/installuixtauri.py) | `run_install(dry_run=False)`, `main(argv)` | `control.py --tauri`; direct script usage. | Linux distro family, `DISPLAY`, `WAYLAND_DISPLAY`, direct flags such as `--target`, `--template`, `--identifier`, `--skip-system-deps`, `--skip-install`, `--dev`, `--force`. | Installs GUI/build/Node dependencies, ensures pnpm and Rust, can scaffold/install/run the Tauri app. | Linux Tauri bootstrap flow changes. |
| [`tools/inst/linux/installuixvs.py`](../../../tools/inst/linux/installuixvs.py) | `run_install()` | `control.py --vscode` | `/etc/os-release`, package managers, `VSCODE_VARIANT`. | Installs VS Code or Code - OSS using pacman/AUR or a downloaded deb package. | VS Code install strategy changes. |
| [`tools/inst/linux/installappimage.py`](../../../tools/inst/linux/installappimage.py) | `run_install(dry_run=False, project_root=None)` | `control.py --install-appimage`; direct script usage. | Built AppImages under `apps/fmd-desktop/src-tauri/target/release/bundle/appimage`, icons under `apps/fmd-desktop/src-tauri/icons`. | Copies AppImage to `~/Applications`, writes desktop entry, installs icon, sets executable bit. | Local AppImage launcher install behavior changes. |

## macOS And Windows Install Modules

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/inst/mac/installmac.py`](../../../tools/inst/mac/installmac.py) | `run_install(dry_run=False)` | `control.py --install` on macOS. | Doctor missing checks, Homebrew, Rust tool availability. | Runs `brew install`; installs Rust via rustup when needed; prints Xcode Command Line Tools hints. | macOS dependency mappings or bootstrap behavior changes. |
| [`tools/inst/win/installwin.py`](../../../tools/inst/win/installwin.py) | `run_install(dry_run=False)` | `control.py --install` on Windows. | Doctor missing checks, `winget`, `WINGET_SOURCE`, `SKIP_MSVC_BUILDTOOLS`, Corepack. | Installs supported packages with winget; activates pnpm through Corepack. | Windows package IDs, winget policy, or pnpm activation changes. |

## Build Modules

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/inst/build/build_lin.py`](../../../tools/inst/build/build_lin.py) | `run_install(dry_run=False)` | `control.py --build-lin` | `NO_STRIP`, `CLEAN_BUNDLE`, `BUILD_VERBOSE`, `pnpm`, app directory. | Cleans old Linux bundles if enabled, runs `pnpm install`, runs `pnpm tauri build`, lists bundle artifacts. | Linux packaging command, cleanup, or artifact reporting changes. |
| [`tools/inst/build/build_win.py`](../../../tools/inst/build/build_win.py) | `run_install(dry_run=False)` | `control.py --build-win` without `-p`. | `WIN_BUNDLES`, `ALLOW_CROSS`, `CLEAN_BUNDLE`, `BUILD_VERBOSE`, `pnpm`. | Builds Windows installer bundles and lists bundle artifacts. | Windows installer bundle options or host guard behavior changes. |
| [`tools/inst/build/build_win_p.py`](../../../tools/inst/build/build_win_p.py) | `run_install(dry_run=False)` | `control.py --build-win -p` | `ALLOW_CROSS`, `CLEAN_PORTABLE`, `pnpm`. | Builds without installer bundling, finds the `.exe`, and writes a portable ZIP. | Windows portable packaging changes. |
| [`tools/inst/build/build_mac.py`](../../../tools/inst/build/build_mac.py) | `run_install(dry_run=False)` | `control.py --build-mac` | `MAC_BUNDLES`, `ALLOW_CROSS`, `CLEAN_BUNDLE`, `BUILD_VERBOSE`, `pnpm`. | Builds macOS app/DMG bundles and lists bundle artifacts. | macOS bundle options or host guard behavior changes. |
| [`tools/inst/build/buildwin_linux.py`](../../../tools/inst/build/buildwin_linux.py) | `run_install(dry_run=False)` | `control.py --build --winlinux` | `WIN_LINUX_RUNNER`, `WIN_LINUX_TARGET`, `WIN_LINUX_BUNDLES`, `WIN_LINUX_ZIP`, `CLEAN_PORTABLE`, Rust target, `cargo-xwin`, `pnpm`. | Ensures required cross-build tools, runs Tauri with a Windows target, optionally creates portable ZIP. | Linux-to-Windows cross-compile behavior changes. |
| [`tools/inst/build/build_copy.py`](../../../tools/inst/build/build_copy.py) | `run_install(dry_run=False)` | `control.py --build --copy` | Existing Linux and Windows artifact folders, configured external `AppInsall` destination roots. | Copies AppImage, deb, rpm, and portable ZIP artifacts to available destination roots. | Artifact source patterns or external copy destinations change. |

## Fix Helpers

| Module | Entry point | Caller | Inputs / env | Outputs / side effects | Edit when |
| --- | --- | --- | --- | --- | --- |
| [`tools/fixes/pacman_keyring_fix.py`](../../../tools/fixes/pacman_keyring_fix.py) | `should_apply(pacman_output)`, `apply(dry_run=False)` | `installuixarc.py` after a pacman signature/keyring failure. | pacman stderr/stdout text, `pacman`, `archlinux-keyring`. | Runs `sudo pacman -Syy --noconfirm archlinux-keyring` when needed. | The pacman signature-recovery condition or command changes. |

## Active Module Coverage

| Subsystem | Files covered |
| --- | ---: |
| Entrypoint/shared | 3 |
| Run/test | 2 |
| Linux install | 7 |
| macOS/Windows install | 2 |
| Build | 6 |
| Fix helpers | 1 |
| Total active Python files | 21 |

