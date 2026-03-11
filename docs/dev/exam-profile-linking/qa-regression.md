<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# QA and Regression Checklist

## Core matrix checks

- Single file with valid `Task` profile auto-selects that profile.
- Single file without valid `Task` profile auto-selects `Standard`.
- Multi-file + `Nested` + same resolved `Task` profile auto-selects that profile.
- Multi-file in other modes auto-selects `Standard`.

## Manual override checks

- Manual profile selection is possible after auto-set.
- Manual selection remains stable when no relevant state change happens.
- On next relevant state change, matrix auto-set applies again.

## Calculation consistency checks

- Sidebar and popup show identical profile/mode state.
- Sidebar and popup KPI values stay synchronized while switching modes.
- Task-order profile points reset by source and use standard fallback on overflow.
- Duration rule is `once` in `Nested` and `per source` in non-nested modes.

## Popup rendering checks

- Exam Files popup opens with full content width and scroll behavior.
- Popup no longer collapses into a narrow bar.
- Popup remains functional on responsive breakpoints where sidebar panel is hidden.
