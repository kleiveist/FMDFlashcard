# Profiles and features reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

The built-in catalog uses schema version 1.

| Profile | Features | Typical detected evidence |
| --- | --- | --- |
| `web-only` | `frontend` | Vite |
| `web-cloud` | `frontend`, `backend`, `cloud` | FastAPI, optionally Vite/Compose |
| `desktop-local` | `frontend`, `tauri` | Tauri, normally with Vite |
| `desktop-cloud` | `frontend`, `backend`, `tauri`, `cloud` | Tauri and FastAPI |
| `full-platform` | `frontend`, `backend`, `tauri`, `cloud` | Explicit only; never inferred |

`desktop-cloud` and `full-platform` intentionally have the same current feature set.
Their different identity is a persisted product decision, not something discovery can
deduce from the filesystem.

| Feature | Adapter | Requires | Selection |
| --- | --- | --- | --- |
| `frontend` | `frontend` | — | Profile feature |
| `backend` | `backend` | — | Profile feature |
| `tauri` | `tauri` | `frontend` | Profile feature |
| `cloud` | `container` | `backend` | Profile feature |
| `database` | `database` | `backend` | Optional dependency; not directly selectable |
| `postgres` | `database` | `database` | Optional and directly selectable |

Selecting `postgres` through `features.optional` adds `database` transitively. It is
valid only for a profile that already provides `backend`; optional selection cannot add
a missing non-optional profile feature.

The core adapter set is always `quality`, `testing`, `documentation`, `ci` and
`release`. The feature adapters above are added deterministically, then the registry
validates unique feature ownership, adapter identity and structured-key policy.

Profiles express what the tooling should recognize and govern; they do not instruct
Full-Fix to scaffold absent product applications. See the
[architecture explanation](../architecture/profiles-features-and-adapters.md).
