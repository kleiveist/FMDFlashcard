<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# QA- und Regression-Checkliste

## A) Auto-Matrix-Szenarien

| ID | Szenario | Erwartetes Ergebnis |
| --- | --- | --- |
| A1 | Eine einbezogene Exam mit gueltig aufgeloestem `Task`. | Auto-Ziel = aufgeloestes Task-Profil. |
| A2 | Eine einbezogene Exam ohne `Task` oder mit unbekanntem `Task`. | Auto-Ziel = `Standard (no profile)`. |
| A3 | Mehrere einbezogene Exams, `Nested`, alle loesen auf dasselbe non-null Task-Profil auf. | Auto-Ziel = gemeinsames Task-Profil. |
| A4 | Mehrere einbezogene Exams, `Nested`, gemischte/unbekannte/fehlende Aufloesung. | Auto-Ziel = `Standard (no profile)`. |
| A5 | Mehrere einbezogene Exams in `Fully mixed` / `Sequential` / `Sequential + internal shuffle`. | Auto-Ziel = `Standard (no profile)`. |

## B) Szenarien fuer manuelles Verhalten

| ID | Szenario | Erwartetes Ergebnis |
| --- | --- | --- |
| B1 | User waehlt ein manuelles Run-Profil. | Manuelles Profil wird sofort fuer Berechnungen angewendet. |
| B2 | Keine relevante Statussignatur-Aenderung nach manueller Auswahl. | Manuelles Profil bleibt aktiv. |
| B3 | Relevante Statussignatur-Aenderung nach manueller Auswahl (Selection/Mode/Task-Aufloesung). | Matrix wird neu ausgewertet und kann manuelles Profil ersetzen. |

## C) Szenarien fuer Punkte-/Zeitformeln

| ID | Szenario | Erwartetes Ergebnis |
| --- | --- | --- |
| C1 | Standard-Profil aktiv (`null`). | Punkte/Zeit aus Standard-Task-Type-Defaults. |
| C2 | Manuelles `task-order`-Profil mit Tasks jenseits `taskCount`. | Overflow-Tasks fallen auf Standard-Task-Type-Punkte zurueck. |
| C3 | Manuelles Profil in `Nested`. | Dauer wird einmalig gezaehlt. |
| C4 | Manuelles Profil in Non-Nested-Modi. | Dauer wird mit Anzahl einbezogener Quellen multipliziert. |

## D) UI-Konsistenz-Szenarien

| ID | Szenario | Erwartetes Ergebnis |
| --- | --- | --- |
| D1 | Moduswechsel in der Sidebar bei geoeffnetem Popup. | Sidebar und Popup bleiben synchron fuer Profil/Modus/KPIs. |
| D2 | Dateien toggeln und Reihenfolge aendern. | Summary-Werte aktualisieren sich konsistent in beiden Flaechen. |
| D3 | KPI-Werte in kompakter Popup-Summary. | `maxPoints`, `taskCount`, `minDurationMinutes` entsprechen den ViewModel-Werten. |

## E) Doku-Integritaetschecks

- EN- und DE-Dateien haben dieselbe Kapitelstruktur.
- EN- und DE-Matrix-Tabellen haben dieselbe Zeilen-Semantik.
- Tabellenrendering ohne kaputte Spalten oder fehlerhafte Headerumbrueche.
- Fuer diese Doku-Aufgabe sind nur `docs/...`-Dateien geaendert.
