<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# UI Area Mapping

## Markdown document properties

- The markdown property block is the source for `Task` assignment.
- This assignment links exam files to points profiles by name.

## Points profile authoring

- Points Profile Editor popup manages profile name, task count, points, and duration.
- Exam Editor points area provides the same profile editing domain.

## Standard defaults

- Settings → Exam Settings → Task Type Points defines standard points/time defaults per task type.
- These defaults are used when standard mode is active or when task-order profile overflow fallback applies.

## Exam runtime areas

- Exam panel and Exam Files sidebar are the main runtime control surfaces.
- Exam Files popup must mirror the same state and handlers as sidebar.
- Run summary (`.exam-mix-info`) and popup KPI chips must use the same computed values:
- planned max points
- preview duration
- included selection/task count context
