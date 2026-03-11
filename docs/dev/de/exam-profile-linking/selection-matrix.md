<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Selection Matrix

## Auto-Set Zielprofil

Das automatische Zielprofil wird bei Selection-/Mode-/Task-Aufloesungs-Aenderungen neu bestimmt.

| Fall | Modus | Auto-Ziel |
| --- | --- | --- |
| Eine einbezogene Exam-Datei mit gueltigem `Task`-Profil | Alle Modi | Aufgeloestes `Task`-Profil |
| Eine einbezogene Exam-Datei ohne gueltiges `Task`-Profil | Alle Modi | `Standard` |
| Mehrere einbezogene Exams mit identischem aufgeloesten `Task`-Profil | `Nested` | Gemeinsames aufgeloestes `Task`-Profil |
| Mehrere einbezogene Exams, alle anderen Konstellationen | `Fully mixed`, `Sequential`, `Sequential + internal shuffle` oder gemischte/fehlende Task-Profile | `Standard` |

## Verhalten bei manueller Auswahl

- Manuelle Run-Profil-Auswahl bleibt jederzeit moeglich.
- Manuelle Auswahl wird nicht blockiert.
- Ein neuer Auto-Set passiert erst bei der naechsten relevanten Zustandsaenderung.

## Punkte- und Zeitformeln

### Standard-Modus (`selectedRunProfileId = null`)

- Punkte pro Task kommen aus den Task-Type-Defaults in den Settings.
- Die Dauer kommt aus der Summe der Standard-Task-Type-Zeiten.

### Manuell gewaehltes Profil (`selectedRunProfileId != null`)

- Das manuelle Profil gilt fuer alle einbezogenen Sources.
- Bei Task-Order-Profilen wird der Task-Index pro Source-Datei zurueckgesetzt (`sourceTaskIndex`).
- Wenn der Source-Task-Index groesser als `taskCount` ist, fallen Punkte auf Standard-Task-Type-Punkte zurueck.

### Dauer mit manuellem Profil

- `Nested`: Profil-Dauer einmalig.
- `Fully mixed`, `Sequential`, `Sequential + internal shuffle`: Profil-Dauer pro einbezogener Source addieren.
