<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Control-Script (`tools/control.py`)

Das Repository enthaelt ein Python-Control-Script, um typische Developer-Aufgaben zu vereinheitlichen.

> **Hinweis:** Fuehre `python3 tools/control.py ...` aus dem Projekt-Root aus, damit relative Pfade zu `tools/` und `apps/` korrekt aufgeloest werden.

## Wozu das Script dient

- Setup-Reibung reduzieren
- Ein zentraler Einstiegspunkt fuer Doctor, Install, Run und Build
- Konstante Kommandosequenzen fuer alle Mitwirkenden
- Plattformspezifische Build-/Bundle-Spezifika kapseln

## Wichtige Kommandos

### Health check

```bash
python3 tools/control.py --doctor
```

### Install / Setup

```bash
python3 tools/control.py --install
```

### Tauri-Vorbereitung

```bash
python3 tools/control.py --tauri
```

### Starten

```bash
python3 tools/control.py --start
```

### Tests

```bash
python3 tools/control.py --test
```

### Neu: Lokales Linux-AppImage installieren

```bash
python3 tools/control.py --install-appimage
```

Was der Befehl macht:
- waehlt ein passendes AppImage aus `apps/fmd-desktop/src-tauri/target/release/bundle/appimage`
- installiert es stabil als `~/Applications/FMDFlashcard.AppImage`
- schreibt/aktualisiert `~/.local/share/applications/fmdflashcard.desktop`
- installiert ein stabiles lokales Icon unter `~/.local/share/icons/`

Hinweise:
- Linux-only
- `--dry-run` wird unterstuetzt
- keine Paketmanager-Logik, nur lokale Desktop-Integration

## Build-Kommandos

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --build-win
python3 tools/control.py --build-win -p
python3 tools/control.py --build --winlinux
python3 tools/control.py --build-mac
```

## Windows-Build-Varianten

### `--build-win` (Installer-Bundles)

```bash
python3 tools/control.py --build-win
```

Typische Outputs:
- `.../bundle/nsis`
- `.../bundle/msi`

Nuetzliche Env-Toggles:
- `WIN_BUNDLES=nsis,msi`
- `ALLOW_CROSS=1` (nicht empfohlen, kann fehlschlagen)

### `--build-win -p` (Portable ZIP)

```bash
python3 tools/control.py --build-win -p
```

Typischer Output:
- `apps/fmd-desktop/src-tauri/target/release/bundle/portable/<exe>-portable.zip`

Nuetzliche Env-Toggles:
- `CLEAN_PORTABLE=0`
- `ALLOW_CROSS=1`

### `--build --winlinux` (Windows-Cross-Compile auf Linux)

```bash
python3 tools/control.py --build --winlinux
```

Linux-only Flow:
- Runner: standardmaessig `cargo-xwin`
- Target: standardmaessig `x86_64-pc-windows-msvc`
- Ergebnis: portable `.exe` und optional `.zip`

Typischer Output:
- `apps/fmd-desktop/src-tauri/target/<target>/release/bundle/portable`

Nuetzliche Env-Toggles:
- `WIN_LINUX_TARGET`
- `WIN_LINUX_RUNNER`
- `WIN_LINUX_BUNDLES`
- `WIN_LINUX_ZIP=0`
- `CLEAN_PORTABLE=0`

Hinweis zu Inno/Portable:
- Im aktuellen Repo gibt es keinen separaten Inno-Portable-Builder.
- Portable-Ausgaben laufen ueber die vorhandenen ZIP-basierten Flows.

## Empfohlener Linux-Packaging-Flow

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```
