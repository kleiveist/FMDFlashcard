<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Selection Matrix

## Auto-set target profile

Automatic target is recalculated on selection/mode/task-resolution changes.

| Case | Mode | Auto target |
| --- | --- | --- |
| Single included exam with valid resolved `Task` profile | All modes | Resolved `Task` profile |
| Single included exam without valid resolved `Task` profile | All modes | `Standard` |
| Multiple included exams, all with same resolved `Task` profile | `Nested` | Shared resolved `Task` profile |
| Multiple included exams, any other constellation | `Fully mixed`, `Sequential`, `Sequential + internal shuffle`, or mixed/missing task profiles | `Standard` |

## Manual selection behavior

- Manual run profile selection remains possible at all times.
- Manual selection is not blocked.
- A new auto-set happens only when a relevant state change occurs.

## Points and duration formulas

### Standard mode (`selectedRunProfileId = null`)

- Points per task come from task-type defaults in settings.
- Duration comes from summed task-type default times.

### Manual selected profile (`selectedRunProfileId != null`)

- Manual profile is used for all selected sources.
- For task-order profiles, task index resets per source file (`sourceTaskIndex`).
- If source task index exceeds profile `taskCount`, points fall back to standard task-type points.

### Duration with manual profile

- `Nested`: use profile duration once.
- `Fully mixed`, `Sequential`, `Sequential + internal shuffle`: add profile duration per included source.
