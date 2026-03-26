<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# Selection Matrix

## A) Auto Profile Selection Matrix

Auto target is evaluated when parsing is ready and based on included exam sources.

| Selection constellation | Mode | Auto target |
| --- | --- | --- |
| No selected files or parse not ready | Any | No matrix update applied yet. |
| Single included source, resolved `Task` profile exists | Any | Resolved task profile id |
| Single included source, no resolved `Task` profile | Any | `Standard (no profile)` |
| Multiple included sources, all same resolved non-null task profile | `Nested` | Shared resolved task profile id |
| Multiple included sources, mixed/unknown/missing task profile resolution | `Nested` | `Standard (no profile)` |
| Multiple included sources | `Fully mixed`, `Sequential`, `Sequential + internal shuffle` | `Standard (no profile)` |

## B) Manual Selection Behavior Matrix

| User action / state | Immediate result | Reversion behavior |
| --- | --- | --- |
| User selects a manual run profile | Manual profile becomes effective for points/time calculation. | No immediate reset from manual action alone. |
| User keeps same selection/mode/task-resolution state | Manual choice remains active. | No auto re-target without state-signature change. |
| Relevant state-signature changes (selection/mode/task-resolution) | Matrix is evaluated again. | Manual selection may be replaced by auto target from section A. |

## C) Points, Task Count, and Duration Formulas

### Standard run profile (`selectedRunProfileId = null`)

| Metric | Formula |
| --- | --- |
| Task points | Sum per task from `settings.examTaskTypeDefaultPoints` using detected task types. |
| Task count (`plannedTaskCount`) | `previewTaskPlan.taskPoints.length` (derived from mixed session tasks). |
| Duration | Sum of per-task values from `settings.examTaskTypeDefaultTimeSeconds`, then `ceil(totalSeconds / 60)`. |

### Manual run profile (`selectedRunProfileId != null`)

| Profile distribution | Points behavior | Fallback |
| --- | --- | --- |
| `task-type` | Per-task points from profile type rules for detected task types. | No extra fallback branch needed. |
| `task-order` | Uses `sourceTaskIndex` (index reset per source file) to read profile task points. | If `sourceTaskIndex >= profile.taskCount`, fallback to standard task-type default points for that task. |

### Duration with manual profile

| Mode | Duration rule |
| --- | --- |
| `Nested` | Use profile duration once. |
| `Fully mixed` | Add profile duration per included source (`duration * sources.length`). |
| `Sequential` | Add profile duration per included source (`duration * sources.length`). |
| `Sequential + internal shuffle` | Add profile duration per included source (`duration * sources.length`). |

## D) Unknown Task Name Behavior

| Condition | Effective behavior |
| --- | --- |
| `Task` contains unknown profile name | Treated as unresolved for matrix purposes (`Standard` target in non-single-resolved cases). |
| Unknown task profile while manual profile selected | Manual profile still drives calculation until next relevant auto-signature change. |
