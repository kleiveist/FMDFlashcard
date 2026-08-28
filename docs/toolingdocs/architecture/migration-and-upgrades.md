# Migration and upgrades

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Replacing a portable tooling payload and migrating an integrated project are distinct
steps. Replacement installs a reviewed matching `tools/` and `docs/toolingdocs/` pair;
it must preserve project-owned files, `project-tooling.toml`, and `.tooling-state/`.
Migration then reconciles versioned project configuration and state through an exact
registered path.

Each registry entry has source/target versions and state schemas, deterministic
preconditions/postconditions and typed operations. It cannot run an arbitrary command
or take ownership of product paths. A read-only migration check reports applicability;
a non-empty application uses the same staged transaction, reporting and rollback
boundary as Full-Fix. Applied IDs make the operation idempotent.

Do not re-baseline a changed managed tree or call a same-version replacement a
migration. Validate the copied payload, run the appropriate
[migration command](../integration/migrations.md), then run
[verification](../integration/verification.md).
