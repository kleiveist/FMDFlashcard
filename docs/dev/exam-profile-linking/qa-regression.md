<!-- AUTO-GENERATED:backlink START -->
[← Back](exam-profile-linking.md)
<!-- AUTO-GENERATED:backlink END -->
# QA and Regression Checklist

## A) Auto Matrix Scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| A1 | Single included exam with valid resolved `Task`. | Auto target = resolved task profile. |
| A2 | Single included exam without `Task` or with unknown `Task`. | Auto target = `Standard (no profile)`. |
| A3 | Multi included exams, `Nested`, all resolve to same non-null task profile. | Auto target = shared task profile. |
| A4 | Multi included exams, `Nested`, mixed/unknown/missing resolution. | Auto target = `Standard (no profile)`. |
| A5 | Multi included exams in `Fully mixed` / `Sequential` / `Sequential + internal shuffle`. | Auto target = `Standard (no profile)`. |

## B) Manual Behavior Scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| B1 | User selects a manual run profile. | Manual profile is applied immediately for calculations. |
| B2 | No relevant state-signature change after manual selection. | Manual profile remains active. |
| B3 | Relevant signature change after manual selection (selection/mode/task-resolution). | Matrix re-evaluates and may replace manual profile. |

## C) Points/Time Formula Scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| C1 | Standard profile active (`null`). | Points/time from standard task-type defaults. |
| C2 | Manual `task-order` profile with tasks beyond `taskCount`. | Overflow tasks fall back to standard task-type points. |
| C3 | Manual profile in `Nested`. | Duration counted once. |
| C4 | Manual profile in non-nested modes. | Duration multiplied by number of included sources. |

## D) UI Consistency Scenarios

| ID | Scenario | Expected result |
| --- | --- | --- |
| D1 | Switch modes in sidebar while popup is open. | Sidebar and popup remain synchronized for profile/mode/KPIs. |
| D2 | Toggle files and reorder selection. | Summary values update consistently in both surfaces. |
| D3 | Popup compact summary KPIs. | `maxPoints`, `taskCount`, `minDurationMinutes` match view-model values. |

## E) Documentation Integrity Checks

- EN and DE files have the same chapter structure.
- EN and DE matrix tables have matching row semantics.
- Table formatting renders without broken columns or wrapped header corruption.
- Only `docs/...` files are changed for this documentation task.
