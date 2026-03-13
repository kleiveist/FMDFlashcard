<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Releases / Packaging

Das Projekt wird als Desktop-App paketiert (typischerweise via Tauri).

## Lokaler Packaging-Workflow

Nutze das Control-Script als Standard-Einstiegspunkt:

```bash
python3 tools/control.py --build
```

Fuer Linux-Bundles explizit:

```bash
python3 tools/control.py --build-lin
```

## Linux: neueste AppImage lokal installieren

Nach dem Linux-Build:

```bash
python3 tools/control.py --install-appimage
```

Ziele:
- `~/Applications/FMDFlashcard.AppImage`
- `~/.local/share/applications/fmdflashcard.desktop`
- `~/.local/share/icons/fmdflashcard.*`

Typischer Ablauf:

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage
```

## Empfehlung fuer Releases

- CI-getriebene Releases (Tag-basiert)
- Artefakte pro Betriebssystem automatisiert erzeugen
- Release Notes aus `CHANGELOG.md`
