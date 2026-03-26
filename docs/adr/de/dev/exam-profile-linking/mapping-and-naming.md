<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# Mapping- und Benennungsregeln

## Kanonische Begriffe

| Begriff | Definition |
| --- | --- |
| `Task` | Frontmatter-Attribut in Exam-Markdown, das ein Points-Profil per Name referenziert. |
| Task-Profil | Points-Profil, das aus Frontmatter-`Task` aufgeloest wurde. |
| Manuelles Run-Profil | Profil, das der User explizit im Exam-Files-Panel waehlt. |
| `Standard (no profile)` | Technischer Zustand `selectedRunProfileId = null`. |
| Einbezogene Exam-Quelle | Ausgewaehlte gueltige Datei mit lesbarem Inhalt, `#exam`-Block und mindestens einer Task. |
| Gleiche Exams | Alle einbezogenen Quellen loesen auf dieselbe non-null Task-Profil-ID auf. |
| Unterschiedliche Exams | Einbezogene Quellen loesen nicht auf eine gemeinsame non-null Task-Profil-ID auf. |

## Task-Aufloesungsregeln

| `Task`-Zustand in Datei | Aufloesungsverhalten | Resultierender Task-Profilzustand |
| --- | --- | --- |
| Fehlend oder leer | Wird als keine Zuordnung behandelt. | Nicht aufgeloest (`null`) |
| Name passt zu vorhandenem Profil | Namensabgleich via trim + case-insensitive Vergleich. | Aufgeloeste Profil-ID/-Name |
| Name passt zu keinem Profil | Wird fuer Run-Selection-Logik wie fehlende Zuordnung behandelt. | Nicht aufgeloest (`null`), `taskMissing = true` |

## Auto- vs. manuelle Prioritaet

| Situation | Effektives Run-Profil fuer Berechnung |
| --- | --- |
| `selectedRunProfileId = null` | Standard-Task-Type-Defaults aus Settings. |
| `selectedRunProfileId != null` | Ausgewaehltes manuelles Profil wird fuer alle Run-Berechnungen verwendet. |

## Auto-Set-Triggerregeln

Die Auto-Profilzielwahl wird nur neu ausgewertet, wenn sich die Run-Profil-Statussignatur aendert:

- Selection-Anzahl oder Menge einbezogener Quellen aendert sich.
- Combination-Mode aendert sich.
- Pro-Quelle-`Task`-Aufloesung aendert sich.

Kein Trigger fuer sich allein:

- Reine manuelle Dropdown-Aenderung ohne Selection-/Mode-/Task-Aufloesungs-Aenderung.

## Initialisierungsregel

Beim initialen Profile-Load-Zustand:

- Wenn kein Run-Profil ausgewaehlt ist und ein Default-Points-Profil existiert, wird die Default-Profil-ID gesetzt.
- Die spaetere Matrixauswertung kann dann auf `Standard` oder ein anderes Profil umschalten, sobald der Auto-Status bereit ist.
