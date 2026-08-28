# Project-tooling schema

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

`project-tooling.toml` is the project-owned, versioned decision record. Schema version
1 requires the top-level `schema_version` and `[tooling]`, `[project]`, `[paths]` and
`[features]` tables:

```toml
schema_version = 1
[tooling]
version = "<tooling version>"
[project]
name = "<project name>"
profile = "web-only"
[paths]
frontend = "frontend"
backend = ""
tauri = "src-tauri"
docs = "docs"
[features]
optional = []
```

Required strings are non-empty except `paths.backend`, which may be empty. Paths use
canonical project-relative `/` notation and cannot escape the project root. Optional
features are a deduplicated string list and must be valid for the selected profile.
When present, this file wins over detection. Full-Fix may create the canonical file
once, but malformed/foreign content is not silently rewritten.

See [Project configuration reference](project-configuration.md) for field detail and
[custom project paths](../guides/custom-project-paths.md) for operator guidance.
