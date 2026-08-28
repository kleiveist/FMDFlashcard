# Feature schema

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

`tools/resources/profiles/features.toml` starts with schema version 1 and a non-empty
`[core].adapters` list. Each `[features.<id>]` table requires `name`, `description` and
the uniquely mapped adapter name:

```toml
[features.example]
name = "Example"
description = "Human-readable summary"
adapter = "example"
requires = []
optional = false
selectable = false
```

`requires` is an optional unique feature list. `optional` and `selectable` default to
false; a selectable feature must also be optional. Only an optional selectable feature
may be requested in `project-tooling.toml`; its optional dependencies are resolved
transitively, while required base features must already belong to the profile. Cycles,
unknown dependencies and duplicate ownership are rejected.

See [profile schema](profile-schema.md) and
[profiles, features and adapters](../architecture/profiles-features-and-adapters.md).
