# Profile schema

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

Each profile resource is a TOML file below `tools/resources/profiles/` whose filename
matches its kebab-case `id`. Schema version 1 uses:

```toml
schema_version = 1
id = "web-only"
order = 10
name = "Web only"
description = "Human-readable summary"
features = ["frontend"]
```

`schema_version`, `id`, `name`, `description` and a non-empty `features` list are
required; `order` defaults to 1000. Profile features must be known, unique, satisfy all
feature dependencies and must not hardcode optional features. The catalog validates
these rules before adapter planning.

The shipped profile choices and resolution semantics are listed in
[profiles and features](profiles-and-features.md).
