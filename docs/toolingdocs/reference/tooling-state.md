# Tooling state reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

The generated state file is `.tooling-state/state.toml`. Its current schema is 1 and its
field set is exact: unknown or missing fields are rejected.

```toml
schema_version = 1
tooling_version = "0.4.0"
profile = "web-only"
optional_features = []
applied_migrations = []
integration_digest = "sha256:<64 lowercase hexadecimal characters>"
```

| Field | Meaning |
| --- | --- |
| `schema_version` | State schema, currently `1`. |
| `tooling_version` | Canonical semantic version of the integrated copied tooling. |
| `profile` | Persisted profile identity used for the baseline. |
| `optional_features` | Ordered, unique optional feature choices. |
| `applied_migrations` | Ordered, unique registry IDs already applied. |
| `integration_digest` | SHA-256 binding managed tooling/docs, project configuration and migration IDs. |

The workflow writes state atomically as a tooling-owned file. Do not edit it to clear a
drift conflict: that would discard verification evidence instead of explaining the
change. Restore the managed tree or use an exact registered migration.

Other state-root locations include `.tooling-state/runtime`, `.tooling-state/venv` and
`.tooling-state/reports`. These stay outside replaceable `tools/` and portable docs.
Runtime/venv contents and generated reports are not part of the directly copied
payload. Reserved state directories are protected from arbitrary integration
operations.

The integration digest and `tools/PORTABLE-PAYLOAD.json` have different roles. The
former detects drift from the last verified project state. The latter checks internal
consistency of a copied release payload and is not publisher authentication. See
[ownership and state](../architecture/ownership-and-state.md).
