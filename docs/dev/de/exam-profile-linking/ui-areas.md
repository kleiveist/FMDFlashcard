<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# UI-Bereichszuordnung

## Tabelle betroffener Bereiche

| Profilbereich | Funktionale Verantwortung | UI-Bereich | Referenz-Selektor / Komponente |
| --- | --- | --- | --- |
| Individuelles Task-Profil-Mapping | Markdown-Frontmatter speichert `Task`-Verknuepfung zum Points-Profilnamen. | Markdown-Dokumenteigenschaften in Editor/Preview. | `div.preview.preview-editor.markdown.md-preview.markdown-hybrid-surface[data-input-scope="editor"]` |
| Individuelle Profilerstellung | Profilname, Task-Anzahl, Punkte, Dauer erstellen/bearbeiten. | Points-Profile-Editor-Popup. | `div.modal-panel.hub-modal-panel.task-profile-editor-modal-panel` |
| Individuelle Profilerstellung | Dieselben Profildaten im Exam-Editor-Points-Bereich. | Exam Editor -> Points-Panels. | `section.panel.exam-editor-panel.points-profile-editor`, `aside.panel.exam-editor-panel.points-profile-nav` |
| Nur Standard-Defaults | Default-Punkte/-Zeit pro Task-Typ definieren (`qa`, `tf`, `m1`, `m2`, `cl`, `cd`, `cld`). | Settings -> Exam Settings -> Task Type Points. | `div.modal-panel.hub-modal-panel.settings-modal-panel`, `section#exam-settings-task-type-defaults.exam-task-type-defaults-panel` |
| Laufzeitverknuepfung (Popup) | Ausgewaehlte Exam-Dateien, Modus, Run-Profil mit Punkte-/Zeit-/Stat-Summary verbinden. | Exam-Files-Popup. | `div.modal-panel.hub-modal-panel.note-modal-panel` |
| Laufzeitverknuepfung (Hauptflaeche) | Ausgewaehlte Exam-Dateien, Modus, Run-Profil mit Punkte-/Zeit-/Stat-Summary verbinden. | Exam-Panel + Exam-Files-Panel. | `section.panel.exam-panel`, `section.panel.list-panel.exam-files-panel` |

## Laufzeit-Datenflaechen

| Flaeche | Werte, die synchron bleiben muessen |
| --- | --- |
| Haupt-Exam-Summary (`.exam-mix-info`) | Selection-Summary, Max-Punkte, Modus, Profil-Label, Dauer. |
| Exam-Files-Sidebar-Panel | Ausgewaehlte Dateien, Modus, Run-Profil-Selector, Reorder-Status. |
| Exam-Files-Popup-Panel | Derselbe State/Dieselben Handler wie Sidebar + kompakte Summary-KPIs. |

## KPI-Vertrag fuer kompakte Summary

In der kompakten Popup-Summary stammen die Werte aus ViewModel-Ableitungen:

- `maxPoints` <- `plannedMaxPoints`
- `taskCount` <- `plannedTaskCount`
- `minDurationMinutes` <- `previewDurationMinutes`
