<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# Exam Task-Profile Linking

This section documents the current implementation of `Task` frontmatter linking to exam points profiles.

## Scope

- Covers mapping from markdown `Task` attribute to run profile behavior.
- Covers auto-profile selection, manual override behavior, points/time calculation rules, and UI touchpoints.
- Aligned with current implementation in `apps/fmd-desktop/src/pages/exam-simulation/hooks/useExamSimulationViewModel.ts`.

## Documentation Map

| Page | Purpose |
| --- | --- |
| [Mapping and Naming Rules](mapping-and-naming.md) | Canonical terms, `Task` resolution behavior, precedence and trigger rules. |
| [Selection Matrix](selection-matrix.md) | Full run-profile matrix for auto and manual behavior, including fallback formulas. |
| [UI Area Mapping](ui-areas.md) | Structured table of affected UI areas and linkage responsibilities. |
| [QA and Regression Checklist](qa-regression.md) | Scenario-driven checks mapped to matrix rows and mode transitions. |

## Source Inputs

- Raw requirement source: `docs/adr/TaskExamProf.md`.
- Implemented behavior source: exam simulation view-model and linked exam file/popup flows.
