# Selecting a profile

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

The built-in profiles are `web-only`, `web-cloud`, `desktop-local`, `desktop-cloud`
and `full-platform`. Detection can suggest a conservative profile from existing Vite,
FastAPI, Tauri and Compose evidence, but it never persists a suggestion during Check.
An existing `project-tooling.toml` always takes precedence.

Choose the smallest profile that describes the project. `full-platform` is an explicit
choice because filesystem evidence cannot distinguish it from `desktop-cloud`. Optional
`postgres` requires a backend-capable profile and adds its `database` dependency during
resolution. Invalid or ambiguous selections fail closed.

Review the profile and feature set in the Check output before Full-Fix. The canonical
feature rules are in [profiles, features and adapters](../architecture/profiles-features-and-adapters.md)
and the persistent fields are documented in the
[project-tooling schema](../reference/project-tooling-schema.md).
