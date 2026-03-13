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

## Windows-Packaging-Matrix

- `python3 tools/control.py --build-win`
  - Installer-Bundles (`nsis` / `msi`, je nach `WIN_BUNDLES`)
  - Typische Outputs: `.../target/release/bundle/nsis` und `.../target/release/bundle/msi`
- `python3 tools/control.py --build-win -p`
  - Portable-ZIP-Flow auf einem Windows-Build-Host
  - Typischer Output: `.../target/release/bundle/portable/<exe>-portable.zip`
- `python3 tools/control.py --build --winlinux`
  - Linux-only Windows-Cross-Compile-Flow (`cargo-xwin`)
  - Typischer Output: `.../target/<target>/release/bundle/portable`

Wichtige Env-Toggles:
- `WIN_BUNDLES` (Installer-Auswahl fuer `--build-win`)
- `CLEAN_PORTABLE` (Cleanup-Verhalten fuer portable Artefakte)
- `WIN_LINUX_TARGET`, `WIN_LINUX_RUNNER`, `WIN_LINUX_BUNDLES`, `WIN_LINUX_ZIP` (Cross-Compile-Flow)

Hinweis zu Inno/Portable:
- Im aktuellen Repo gibt es keinen separaten Inno-Portable-Build-Flow.
- Portable-Artefakte werden ueber die vorhandenen ZIP-basierten Flows erzeugt.

## Empfehlung fuer Releases

- CI-getriebene Releases (Tag-basiert)
- Artefakte pro Betriebssystem automatisiert erzeugen
- Release Notes aus `CHANGELOG.md`
