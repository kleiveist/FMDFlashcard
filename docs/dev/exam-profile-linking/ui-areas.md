<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# UI Area Mapping

## Affected Area Table

| Profile scope | Functional responsibility | UI area | Reference selector / component |
| --- | --- | --- | --- |
| Individual task profile mapping | Markdown frontmatter stores `Task` linkage to points profile name. | Markdown document properties in editor/preview. | `div.preview.preview-editor.markdown.md-preview.markdown-hybrid-surface[data-input-scope="editor"]` |
| Individual profile authoring | Create/edit profile name, task count, points, duration. | Points Profile Editor popup. | `div.modal-panel.hub-modal-panel.task-profile-editor-modal-panel` |
| Individual profile authoring | Same profile data in exam editor points section. | Exam Editor -> Points panels. | `section.panel.exam-editor-panel.points-profile-editor`, `aside.panel.exam-editor-panel.points-profile-nav` |
| Standard defaults only | Define default points/time per task type (`qa`, `tf`, `m1`, `m2`, `cl`, `cd`, `cld`). | Settings -> Exam Settings -> Task Type Points. | `div.modal-panel.hub-modal-panel.settings-modal-panel`, `section#exam-settings-task-type-defaults.exam-task-type-defaults-panel` |
| Runtime linkage (popup) | Bind selected exam files, mode, run profile to points/time/stat summary. | Exam Files popup. | `div.modal-panel.hub-modal-panel.note-modal-panel` |
| Runtime linkage (main) | Bind selected exam files, mode, run profile to points/time/stat summary. | Exam panel + Exam Files panel. | `section.panel.exam-panel`, `section.panel.list-panel.exam-files-panel` |

## Runtime Data Surfaces

| Surface | Values expected to stay synchronized |
| --- | --- |
| Main exam summary (`.exam-mix-info`) | Selection summary, max points, mode, profile label, duration. |
| Exam Files sidebar panel | Selected files, mode, run profile selector, reorder state. |
| Exam Files popup panel | Same state/handlers as sidebar + compact summary KPIs. |

## Compact Summary KPI Contract

In popup compact summary, values come from view-model derivations:

- `maxPoints` <- `plannedMaxPoints`
- `taskCount` <- `plannedTaskCount`
- `minDurationMinutes` <- `previewDurationMinutes`
