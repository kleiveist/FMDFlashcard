<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# Exam Task-Profil-Verknuepfung

Dieser Bereich dokumentiert die aktuelle Implementierung der `Task`-Frontmatter-Verknuepfung zu Exam-Points-Profilen.

## Geltungsbereich

- Deckt das Mapping vom Markdown-Attribut `Task` auf Run-Profil-Verhalten ab.
- Deckt Auto-Profilwahl, manuelles Override, Punkte-/Zeitberechnung und UI-Touchpoints ab.
- Ist auf die aktuelle Implementierung in `apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts` ausgerichtet.

## Dokumentationskarte

| Seite | Zweck |
| --- | --- |
| [Mapping- und Benennungsregeln](mapping-and-naming.md) | Kanonische Begriffe, `Task`-Aufloesung, Prioritaets- und Triggerregeln. |
| [Selection Matrix](selection-matrix.md) | Vollstaendige Run-Profil-Matrix fuer Auto- und manuelles Verhalten inkl. Fallback-Formeln. |
| [UI-Bereichszuordnung](ui-areas.md) | Strukturierte Tabelle der betroffenen UI-Bereiche und Verknuepfungsverantwortungen. |
| [QA- und Regression-Checkliste](qa-regression.md) | Szenariobasierte Checks, auf Matrixzeilen und Moduswechsel abgebildet. |

## Quellgrundlagen

- Rohanforderung: `docs/adr/TaskExamProf.md`.
- Implementiertes Verhalten: Exam-Simulation-ViewModel und verknuepfte Exam-Files-/Popup-Flow-Logik.
