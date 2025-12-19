# Fast start setup

> Note: Example commands for **Linux/macOS** (Terminal).  
> On **Windows**, use PowerShell or Git Bash; the steps are the same, only the directory path may differ.

### 1) Install Python + Git & check versions (single block)

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

# Clone repository (replace URL)
git clone https://github.com/kleiveist/FMDFlashcard.git
cd FMDFlashcard
```

## 3) Control-Skript ausführen (ein Block)
```bash
# optional: health check / doctor
python3 tools/control.py --doctor
```

### 4) Install & start (single block)

```bash
# installation / setup
python3 tools/control.py --install

# start (dev)
# python3 tools/control.py --run
```