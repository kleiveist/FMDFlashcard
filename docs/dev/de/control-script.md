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
python3 tools/control.py --build-mac
```

## Empfohlener Linux-Packaging-Flow

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```
