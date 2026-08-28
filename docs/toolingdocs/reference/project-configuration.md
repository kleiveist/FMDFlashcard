# Project configuration reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

`project-tooling.toml` is the persistent, project-owned decision record that survives
replacement of `tools/` and `docs/toolingdocs/`. Its current schema is 1.

```toml
schema_version = 1

[tooling]
version = "0.4.0"

[project]
name = "example-project"
profile = "web-only"

[paths]
frontend = "frontend"
backend = ""
tauri = "src-tauri"
docs = "docs"

[features]
optional = []
```

| Key | Contract |
| --- | --- |
| `schema_version` | Integer `1`. |
| `tooling.version` | Non-empty copied tooling version; the integration/migration workflow reconciles it with `tools/VERSION`. |
| `project.name` | Non-empty project name. |
| `project.profile` | One profile ID from the copied catalog. |
| `paths.frontend` | Canonical project-relative frontend root. |
| `paths.backend` | Canonical project-relative backend root, or `""` when none is configured. |
| `paths.tauri` | Canonical project-relative Tauri root. |
| `paths.docs` | Canonical project-relative documentation parent; portable docs resolve below it as `toolingdocs/`. |
| `features.optional` | Deduplicated list of optional feature IDs requested for the active profile. |

Path values use portable `/` separators and may not be absolute, drive-qualified,
non-canonical or escaping. `.` is valid when a product root is the project root.

When the file exists, its profile and paths take precedence over detection. When it is
absent, Check uses a write-free detected/default proposal and Full-Fix may create the
canonical file exactly once. Later automatic changes are narrowly structured; arbitrary
foreign keys or malformed schema are not silently rewritten.

See [profiles and features](profiles-and-features.md) for valid profile/optional feature
combinations.
