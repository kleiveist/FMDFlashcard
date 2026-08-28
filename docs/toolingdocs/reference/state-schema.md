# State schema

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

`.tooling-state/state.toml` is tooling-owned persistent integration state. Its schema
version 1 has an exact field set:

```toml
schema_version = 1
tooling_version = "<SemVer>"
profile = "web-only"
optional_features = []
applied_migrations = []
integration_digest = "sha256:<64 lowercase hexadecimal characters>"
```

The version must be SemVer; profile and every list item must be non-empty; optional
features and migration IDs must be unique. The digest binds the managed
tooling/documentation tree, rendered project configuration and applied migration IDs to
the last verified state. Missing or unknown fields are rejected.

State is written atomically and must not be edited to clear drift. See
[Tooling state reference](tooling-state.md) and
[ownership, state and transactions](../architecture/ownership-state-and-transactions.md).
