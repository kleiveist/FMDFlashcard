# Tree-View-Auswahl mit File-Preview vereinheitlichen

## Kontext
Die Tree-View verfolgt aktuell die Auswahl (`treeSelection`), lädt aber nicht den Dateiinhalt.
Die File-Liste lädt Inhalte über `handleSelectFile(file)`.

## Ziel
Klick auf eine Datei im Tree soll die gleiche Preview öffnen wie die Liste; State soll konsistent sein.

## Aufgaben
- [ ] File-Nodes im Tree mit Referenz auf `VaultFile` versehen (oder per `fullPath` mappen).
- [ ] Im `renderTreeNodes()`-Click-Handler für Dateien `handleSelectFile(...)` aufrufen.
- [ ] Selection-Highlight zwischen Tree und Liste synchronisieren (`selectedFile` als Single Source of Truth).
- [ ] Optional: Elternordner bei File-Selection automatisch aufklappen.

## Akzeptanzkriterien
- Tree-File-Klick lädt Preview-Inhalt.
- Nur ein Selection-State; Tree und Liste spiegeln ihn identisch wider.

## Hinweise
Implementierung hauptsächlich in `apps/fmd-desktop/src/App.tsx`.
