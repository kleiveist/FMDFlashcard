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

## 7) Build-Varianten (Windows-Artefakte)

### 7.1 Installer-Bundles (NSIS/MSI)

```powershell
py -3 .\tools\control.py --build-win
```

Optional:

```powershell
$env:WIN_BUNDLES = "nsis,msi"
py -3 .\tools\control.py --build-win
```

### 7.2 Portable ZIP (Windows-Host)

```powershell
py -3 .\tools\control.py --build-win -p
```

Typischer Output:
- `apps/fmd-desktop/src-tauri/target/release/bundle/portable/<exe>-portable.zip`

### 7.3 Windows-Cross-Compile auf Linux (cargo-xwin)

Diesen Befehl auf einem Linux-Host ausfuehren (nicht in Windows PowerShell):

```bash
python3 tools/control.py --build --winlinux
```

Typischer Output:
- `apps/fmd-desktop/src-tauri/target/<target>/release/bundle/portable`

Hinweis zu Inno/Portable:
- Im aktuellen Repo gibt es keinen separaten Inno-Portable-Build-Flow.
- Portable-Artefakte werden ueber ZIP-basierte Portable-Workflows erzeugt.
