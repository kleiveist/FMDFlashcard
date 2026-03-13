<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Developer setup (Linux, run from source)

Diese Anleitung beschreibt einen schnellen lokalen Start unter Linux.

## 1) Python + Git installieren und pruefen

```bash
python3 --version || true
sudo apt update
sudo apt install -y python3 python3-pip git
python3 --version
git --version
```

## 2) Repository klonen

```bash
mkdir -p ~/Projects
cd ~/Projects
git clone https://github.com/kleiveist/FMDFlashcard.git
cd FMDFlashcard
```

## 3) Doctor

```bash
python3 tools/control.py --doctor
```

## 4) Install

```bash
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

## 7) Build

```bash
python3 tools/control.py --build-lin
```

## 8) Lokale AppImage-Installation

```bash
python3 tools/control.py --install-appimage
```

Das erzeugt einen stabilen lokalen Launcher:
- `~/Applications/FMDFlashcard.AppImage`
- `~/.local/share/applications/fmdflashcard.desktop`

## Wenn etwas fehlschlaegt

- `python3 tools/control.py --doctor` erneut ausfuehren
- Node/pnpm/Tauri-Voraussetzungen pruefen
- relevante Terminal-Ausgabe beim Issue anhaengen
