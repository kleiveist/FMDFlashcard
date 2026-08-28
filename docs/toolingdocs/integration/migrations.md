# Migrations

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Use the tooling migration registry after replacing a reviewed portable payload with a
different version:

```sh
python tools/control.py tooling migrate --check
python tools/control.py tooling migrate --check --json
python tools/control.py tooling migrate
```

The registry selects only exact source/target version and state-schema paths. A
migration defines deterministic preconditions, postconditions and typed operations;
it cannot run arbitrary shell commands or modify project-owned files. The read-only
form reports the applicable IDs. A non-empty application receives the same preflight,
staging, verification, report and rollback protections as Full-Fix.

Applied IDs are recorded in `.tooling-state/state.toml`, making a completed migration
idempotent. Restore a modified managed tree or install the exact target payload first;
do not use migration to normalize unknown drift. See
[migration, verification and drift](migration-verification-and-drift.md).
