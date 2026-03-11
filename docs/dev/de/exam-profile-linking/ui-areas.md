<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# UI-Bereichszuordnung

## Markdown-Dokumenteigenschaften

- Der Eigenschaftenblock in Markdown ist die Quelle fuer die `Task`-Zuordnung.
- Diese Zuordnung verknuepft Exam-Dateien mit Points-Profilen ueber den Profilnamen.

## Points-Profil-Erstellung

- Der Points Profile Editor Popup verwaltet Profilname, Task-Anzahl, Punkte und Dauer.
- Der Exam Editor Bereich fuer Points nutzt denselben Profil-Domainbereich.

## Standard-Defaults

- Settings → Exam Settings → Task Type Points definiert Standard-Punkte/-Zeit je Task-Typ.
- Diese Defaults gelten im Standard-Modus und als Overflow-Fallback fuer Task-Order-Profile.

## Exam-Laufzeitbereiche

- Exam Panel und Exam Files Sidebar sind die Hauptflaechen zur Laufzeit.
- Das Exam Files Popup muss denselben State und dieselben Handler wie die Sidebar nutzen.
- Run Summary (`.exam-mix-info`) und Popup-KPI-Chips muessen aus denselben berechneten Werten kommen:
- geplante Maximalpunkte
- berechnete Vorschau-Dauer
- Selection-/Task-Kontext der einbezogenen Dateien
