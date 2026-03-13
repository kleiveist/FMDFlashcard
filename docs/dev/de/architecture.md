<!-- AUTO-GENERATED:backlink START -->
[<- Zurueck](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Architektur-Ueberblick

Dieses Dokument beschreibt die grobe Struktur des Projekts fuer Mitwirkende.

## Hauptkomponenten

- **Desktop-App:** plattformuebergreifende UI (React/TypeScript, Packaging mit Tauri).
- **Tooling:** Hilfsskripte fuer Setup, Checks, Run, Build und lokale AppImage-Installation (`tools/control.py`, `tools/inst/linux/installappimage.py`).
- **Features:** Module fuer Flashcards, Fast Review, Spaced Repetition, Einstellungen und Hilfe.

## Designziele

- Local-first Workflow: der Vault ist ein Ordner mit Markdown-Dateien.
- Markdown bleibt lesbar: Karten werden ueber einfache Marker eingebettet.
- Vorhersehbare Review-Logik: gleiche Regeln in allen Modi.

## Als naechstes lesen

- Setup: `setup_lin.md` / `setup_win.md`
- Build + lokales AppImage-Install: `control-script.md`
- Testing: `testing.md`
- User-Verhalten: `../../usr/`
