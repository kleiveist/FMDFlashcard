<!-- AUTO-GENERATED:backlink START -->
[← Back](de.md)
<!-- AUTO-GENERATED:backlink END -->
# Architektur-Ueberblick

Dieses Dokument beschreibt die grobe Struktur des Projekts fuer Mitwirkende.

## Hauptkomponenten

- **Desktop-App:** plattformuebergreifende UI (React/TypeScript, Packaging mit Tauri).
- **Tooling:** Runner und Hilfsskripte unter `tools/` (dokumentiert in der Tools-Doku).
- **Features:** Module fuer Flashcards, Fast Review, Spaced Repetition, Einstellungen und Hilfe.

## Designziele

- Local-first Workflow: der Vault ist ein Ordner mit Markdown-Dateien.
- Markdown bleibt lesbar: Karten werden ueber einfache Marker eingebettet.
- Vorhersehbare Review-Logik: gleiche Regeln in allen Modi.

## Als naechstes lesen

- Tools-Doku (Englisch): `../../tools/tools.md`
- User-Verhalten: `../../usr/`
