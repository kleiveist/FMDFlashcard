<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Mapping and Naming Rules

## Source attribute

- Source field in markdown frontmatter: `Task`
- Example:

```yaml
---
Section: IUF
Rank: SE1
Projekt: IDBS01
Task: Exam
---
```

## Resolution rules

- `Task` is resolved against existing points profile names.
- Matching is case-insensitive and trimmed.
- Unknown `Task` names are treated as unresolved and fall back to standard behavior.
- No `Task` attribute is treated as no assigned task profile.

## Terminology used in Exam Simulation

- `Standard` means `selectedRunProfileId = null`.
- `Task profile` means the profile resolved from frontmatter `Task`.
- `Same exams` means all included exam sources resolve to the same `Task` profile id.
- `Different exams` means included sources resolve to different ids or unresolved task profile values.

## Precedence

- Manual run profile selection overrides frontmatter mapping for calculation.
- Automatic matrix profile set runs only on relevant state changes:
- Selection changes
- Combination mode changes
- Frontmatter task-resolution changes
- Manual dropdown changes alone do not immediately trigger a new auto-set.
