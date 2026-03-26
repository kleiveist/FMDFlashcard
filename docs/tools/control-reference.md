<!-- AUTO-GENERATED:backlink START -->
[← Back](tools.md)
<!-- AUTO-GENERATED:backlink END -->
# Control Script Reference

Source: `python3 tools/control.py --help`

## Usage

```bash
python3 tools/control.py [flags]
```

Windows PowerShell equivalent:

```powershell
py -3 .\tools\control.py [flags]
```

## Flags

- `-h`, `--help`: show help.
- `--doctor`: run system/tooling checks.
- `--check`: alias for `--doctor`.
- `--json`: additional JSON output for `--doctor`.
- `--install`: run OS-matched install routine.
- `--VScode`, `--vscode`: install Visual Studio Code helper (Linux).
- `--tauri`: install Tauri prerequisites (Linux).
- `--run`, `--start`: run desktop app in dev mode.
- `--install-appimage`, `--appimage`: install latest local Linux AppImage.
- `--build`: build helper output (target overview); dispatcher for build subflows.
- `--winlinux`: enable Windows cross-compile on Linux (use with `--build`).
- `--copy`: copy built artifacts to configured external destinations (use with `--build`).
- `--build-lin`: build Linux bundles.
- `--build-win`: build Windows bundles.
- `-p`, `--portable`: portable mode for `--build-win`.
- `--build-mac`: build macOS bundles.
- `--test`: run desktop app tests.
- `--dry-run`: print intended actions without executing.

## Valid combinations and constraints

- `--winlinux` requires `--build`.
- `--copy` requires `--build`.
- `--portable` is intended with `--build-win`.
- `--install-appimage` is Linux-only.
- `--tauri` and `--vscode` routines are Linux-only.

## Examples

```bash
python3 tools/control.py --doctor
python3 tools/control.py --install
python3 tools/control.py --start
python3 tools/control.py --test
python3 tools/control.py --build --dry-run
python3 tools/control.py --build-lin
python3 tools/control.py --build-win -p
python3 tools/control.py --build --winlinux
python3 tools/control.py --build --copy
python3 tools/control.py --install-appimage
```
