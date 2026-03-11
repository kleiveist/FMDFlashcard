<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Mapping and Naming Rules

## Canonical Terms

| Term | Definition |
| --- | --- |
| `Task` | Frontmatter attribute in exam markdown that references a points profile by name. |
| Task profile | Points profile resolved from frontmatter `Task`. |
| Manual run profile | Profile explicitly selected by user in Exam Files panel. |
| `Standard (no profile)` | Technical state `selectedRunProfileId = null`. |
| Included exam source | Selected valid file with readable content, `#exam` block, and at least one task. |
| Same exams | All included sources resolve to the same non-null task profile id. |
| Different exams | Included sources do not resolve to one shared non-null task profile id. |

## Task Resolution Rules

| `Task` state in file | Resolution behavior | Resulting task profile state |
| --- | --- | --- |
| Missing or empty | Treated as no assignment. | Unresolved (`null`) |
| Name matches existing profile | Name lookup via trim + case-insensitive comparison. | Resolved profile id/name |
| Name does not match any profile | Treated as missing assignment for run selection logic. | Unresolved (`null`), `taskMissing = true` |

## Auto vs. Manual Precedence

| Situation | Effective run profile used for calculation |
| --- | --- |
| `selectedRunProfileId = null` | Standard task-type defaults from settings. |
| `selectedRunProfileId != null` | Selected manual profile is used for all run calculations. |

## Auto-Set Trigger Rules

Auto profile targeting is re-evaluated only when the run-profile state signature changes:

- Selection count or included source set changes.
- Combination mode changes.
- Per-source `Task` resolution changes.

Not a trigger by itself:

- Pure manual dropdown change without any selection/mode/task-resolution change.

## Initialization Rule

On initial profile-load state:

- If no run profile is selected and a default points profile exists, default profile id is set.
- Later matrix evaluation may switch to `Standard` or another profile when auto-state becomes ready.
