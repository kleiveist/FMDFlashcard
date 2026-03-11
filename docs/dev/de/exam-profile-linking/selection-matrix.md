<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Selection Matrix

## A) Auto-Profilwahl-Matrix

Das Auto-Ziel wird ausgewertet, wenn Parsing bereit ist und auf einbezogenen Exam-Quellen basiert.

| Selection-Konstellation | Modus | Auto-Ziel |
| --- | --- | --- |
| Keine ausgewaehlten Dateien oder Parsing nicht bereit | Beliebig | Noch kein Matrix-Update angewendet. |
| Eine einbezogene Quelle, aufgeloestes `Task`-Profil vorhanden | Beliebig | Aufgeloeste Task-Profil-ID |
| Eine einbezogene Quelle, kein aufgeloestes `Task`-Profil | Beliebig | `Standard (no profile)` |
| Mehrere einbezogene Quellen, alle gleiches aufgeloestes non-null Task-Profil | `Nested` | Gemeinsame aufgeloeste Task-Profil-ID |
| Mehrere einbezogene Quellen, gemischte/unbekannte/fehlende Task-Profil-Aufloesung | `Nested` | `Standard (no profile)` |
| Mehrere einbezogene Quellen | `Fully mixed`, `Sequential`, `Sequential + internal shuffle` | `Standard (no profile)` |

## B) Matrix fuer manuelles Auswahlverhalten

| User-Aktion / Zustand | Unmittelbares Ergebnis | Ruecksetzverhalten |
| --- | --- | --- |
| User waehlt manuelles Run-Profil | Manuelles Profil wird fuer Punkte-/Zeitberechnung wirksam. | Kein sofortiger Reset durch die manuelle Aktion allein. |
| User behaelt denselben Selection-/Mode-/Task-Aufloesungs-Zustand | Manuelle Auswahl bleibt aktiv. | Kein Auto-Retarget ohne Statussignatur-Aenderung. |
| Relevante Statussignatur aendert sich (Selection/Mode/Task-Aufloesung) | Matrix wird erneut ausgewertet. | Manuelle Auswahl kann durch Auto-Ziel aus Abschnitt A ersetzt werden. |

## C) Punkte-, Task-Anzahl- und Zeitformeln

### Standard-Run-Profil (`selectedRunProfileId = null`)

| Metrik | Formel |
| --- | --- |
| Task-Punkte | Summe pro Task aus `settings.examTaskTypeDefaultPoints` anhand erkannter Task-Typen. |
| Task-Anzahl (`plannedTaskCount`) | `previewTaskPlan.taskPoints.length` (abgeleitet aus gemischten Session-Tasks). |
| Dauer | Summe pro Task aus `settings.examTaskTypeDefaultTimeSeconds`, danach `ceil(totalSeconds / 60)`. |

### Manuelles Run-Profil (`selectedRunProfileId != null`)

| Profilverteilung | Punkteverhalten | Fallback |
| --- | --- | --- |
| `task-type` | Pro-Task-Punkte aus Profil-Type-Regeln fuer erkannte Task-Typen. | Kein zusaetzlicher Fallback-Zweig noetig. |
| `task-order` | Nutzt `sourceTaskIndex` (Index-Reset pro Quelldatei), um Profil-Task-Punkte zu lesen. | Wenn `sourceTaskIndex >= profile.taskCount`, Fallback auf Standard-Task-Type-Defaultpunkte fuer diese Task. |

### Dauer mit manuellem Profil

| Modus | Dauerregel |
| --- | --- |
| `Nested` | Profil-Dauer einmal verwenden. |
| `Fully mixed` | Profil-Dauer pro einbezogener Quelle addieren (`duration * sources.length`). |
| `Sequential` | Profil-Dauer pro einbezogener Quelle addieren (`duration * sources.length`). |
| `Sequential + internal shuffle` | Profil-Dauer pro einbezogener Quelle addieren (`duration * sources.length`). |

## D) Verhalten bei unbekanntem Task-Namen

| Bedingung | Effektives Verhalten |
| --- | --- |
| `Task` enthaelt unbekannten Profilnamen | Fuer Matrixzwecke als nicht aufgeloest behandelt (`Standard`-Ziel in nicht-single-resolved Faellen). |
| Unbekanntes Task-Profil bei aktivem manuellem Profil | Manuelles Profil treibt weiterhin die Berechnung bis zur naechsten relevanten Auto-Statussignatur-Aenderung. |
