# Profile matrix

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

Every built-in profile needs an independent fixture with the expected persisted or
detected choice and its corresponding feature/adapter set.

| Profile | Required base features | Acceptance focus |
| --- | --- | --- |
| `web-only` | `frontend` | Browser-project detection without backend scaffolding. |
| `web-cloud` | `frontend`, `backend`, `cloud` | Existing frontend/backend/container evidence. |
| `desktop-local` | `frontend`, `tauri` | Existing desktop evidence without source overwrite. |
| `desktop-cloud` | `frontend`, `backend`, `tauri`, `cloud` | Explicit/nested paths and cloud-capable desktop layout. |
| `full-platform` | `frontend`, `backend`, `tauri`, `cloud` | Explicit persisted choice; it is not inferred solely from filesystem evidence. |

Optional-feature cases must prove dependency resolution and rejection when their base
profile is unsuitable. In every row, missing optional roots are informational rather
than scaffolding permission. See [profiles, features and adapters](../architecture/profiles-features-and-adapters.md)
and [feature schema](../reference/feature-schema.md).
