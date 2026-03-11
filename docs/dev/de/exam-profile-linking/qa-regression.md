<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# QA- und Regression-Checkliste

## Matrix-Kernchecks

- Single-File mit gueltigem `Task`-Profil waehlt dieses Profil automatisch.
- Single-File ohne gueltiges `Task`-Profil waehlt automatisch `Standard`.
- Multi-File + `Nested` + gleiches aufgeloestes `Task`-Profil waehlt dieses Profil automatisch.
- Multi-File in anderen Modi waehlt automatisch `Standard`.

## Manuelle Override-Checks

- Manuelle Profilauswahl ist nach Auto-Set moeglich.
- Manuelle Auswahl bleibt stabil, solange keine relevante Zustandsaenderung erfolgt.
- Bei der naechsten relevanten Zustandsaenderung greift die Matrix wieder.

## Berechnungs-Konsistenz

- Sidebar und Popup zeigen identischen Profil-/Mode-State.
- Sidebar- und Popup-KPI-Werte bleiben bei Mode-Wechsel synchron.
- Task-Order-Punkte werden pro Source zurueckgesetzt und nutzen Overflow-Fallback auf Standard.
- Dauerregel ist `einmalig` in `Nested` und `pro Source` in Non-Nested-Modi.

## Popup-Rendering

- Exam Files Popup oeffnet mit voller Inhaltsbreite und korrektem Scroll-Verhalten.
- Popup kollabiert nicht mehr zu einem schmalen Balken.
- Popup bleibt in responsiven Breakpoints funktional, auch wenn die Sidebar ausgeblendet ist.
