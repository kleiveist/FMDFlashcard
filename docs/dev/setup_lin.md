<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Developer setup (run from source)

This guide describes a “fast start” flow for running the desktop app locally.

Note: Example commands for Linux/macOS (Terminal).
On Windows, use PowerShell or Git Bash; the steps are the same, only the directory path may differ.

## 1) Install Python + Git & check versions

```bash
# --- Check Python (or install if missing) ---
python3 --version || true

# Linux (Debian/Ubuntu)
sudo apt update
sudo apt install -y python3 python3-pip git

# macOS (Homebrew, if available)
# brew install python git

# Verify versions
python3 --version
git --version
```

## 2) Clone the repo & switch to a standard project directory

```bash
# Standard project directory (works on all systems):
# Linux/macOS: ~/Projects
mkdir -p ~/Projects
cd ~/Projects

# Clone repository (replace URL if needed)
git clone https://github.com/kleiveist/FMDFlashcard.git
cd FMDFlashcard
```

## 3) Control script (doctor / health check)

```bash
cd ~/Projects/FMDFlashcard

# optional: health check / doctor
python3 tools/control.py --doctor
```

## 4) Install & start

```bash
cd ~/Projects/FMDFlashcard

# installation / setup
python3 tools/control.py --install
```

## 5) Tauri

```bash
python3 tools/control.py --tauri
```

## 6) Start

```bash
python3 tools/control.py --start
```

## 7) Build (release bundles / native packaging)
```bash
cd ~/Projects/FMDFlashcard
# build desktop app bundles (runs: pnpm tauri build)
python3 tools/control.py --build
```

## 8) Install latest local AppImage (Linux desktop integration)

```bash
cd ~/Projects/FMDFlashcard
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```

This installs a stable local launcher target:
- `~/Applications/FMDFlashcard.AppImage`
- `~/.local/share/applications/fmdflashcard.desktop`

## If something fails

- Re-run `--doctor` and review the printed checks.
- Confirm you have a supported Node.js/pnpm toolchain if the desktop app uses them.
- Open an issue and paste the relevant terminal output.
