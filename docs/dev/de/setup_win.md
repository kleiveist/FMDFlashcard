<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Developer setup (Windows, PowerShell)

Schnellstart fuer die lokale Entwicklung unter Windows.

## 1) Python + Git installieren

```powershell
winget install -e --id Git.Git --source winget
winget install -e --id Python.Python.3.12 --source winget
```

## 2) Repository klonen

```powershell
$Projects = Join-Path $HOME "Projects"
New-Item -ItemType Directory -Force -Path $Projects | Out-Null
Set-Location $Projects
git clone https://github.com/kleiveist/FMDFlashcard.git
Set-Location .\FMDFlashcard
```

## 3) Doctor

```powershell
py -3 .\tools\control.py --doctor
```

## 4) Install

```powershell
py -3 .\tools\control.py --install
```

## 5) Tauri

```powershell
py -3 .\tools\control.py --tauri
```

## 6) Start

```powershell
py -3 .\tools\control.py --start
```

## 7) Build

```powershell
py -3 .\tools\control.py --build-win
```

## Hinweis zu `--install-appimage`

`--install-appimage` ist Linux-only. Fuer Linux-Entwicklung:

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```
