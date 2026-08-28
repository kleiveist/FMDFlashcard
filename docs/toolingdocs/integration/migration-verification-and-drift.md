# Migration, verification and drift

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Tooling migrations are registry entries with an exact source/target version and state
schema, deterministic order, explicit preconditions and postconditions, and typed
operations. They cannot execute arbitrary shell commands or write project-owned paths.
Structured migration patches require both a preimage digest and a complete dotted-key
allowlist.

Check or apply the registry with:

```sh
python tools/control.py tooling migrate --check
python tools/control.py tooling migrate --check --json
python tools/control.py tooling migrate
python tools/control.py tooling migrate --json
```

`--check` is read-only; add `--json` to inspect the pending migration IDs. Application
uses the same Git preflight, replan, staging, verification, reporting and rollback
boundary as Full-Fix whenever changes are required. When local `.git` metadata exists,
its resolved Git top-level must equal the project root and the worktree must be clean;
a target without local `.git` uses the explicit non-repository safety path.
Successfully applied IDs are persisted in `.tooling-state/state.toml`, so selection is
idempotent.

## Current production migrations

The registry retains three exact historical managed-payload reconciliations:

- `reconcile-managed-payload-0-1-0-to-0-2-0` preserves the prior 0.2.0 release path;
- `reconcile-managed-payload-0-1-0-to-0-3-0` upgrades a 0.1.0 integration directly;
- `reconcile-managed-payload-0-2-0-to-0-3-0` upgrades a 0.2.0 integration directly.

The current release adds three direct paths:

- `reconcile-managed-payload-0-1-0-to-0-4-0`;
- `reconcile-managed-payload-0-2-0-to-0-4-0`;
- `reconcile-managed-payload-0-3-0-to-0-4-0`.

They are intentionally operation-free. Each supports the workflow where an operator
has already replaced the managed `tools/` and `docs/toolingdocs/` folders with the exact
target payload. Applicability requires the stated source and target tooling versions
and state schema 1 on both sides. The current 0.4.0 release therefore has a direct path
from every previously released integration; it does not depend on implicit chaining.

Each migration's identical pre- and postconditions require the canonical SHA-256 of
the target `tools/VERSION` bytes plus the presence of `tools/PORTABLE-PAYLOAD.json`.
Assessment separately validates payload identity and reconciles configuration/state.
These narrow migrations are not general version-range upgrades and do not copy product
or tooling files themselves.

## Verification and drift

```sh
python tools/control.py tooling verify
python tools/control.py tooling verify --json
```

Verification runs the same read-only assessment as Check. Success requires a no-op plan
and no `FAIL` findings; the status is `INTEGRATED`, otherwise
`VERIFICATION_FAILED`. It covers selected adapter paths, payload self-consistency or
identity, all managed Python syntax, configuration, tooling state and plan conflicts.

The integration digest binds the managed tooling/documentation tree, project
configuration and applied migration IDs to the last verified state. Same-version
replacement or manual managed edits that do not match that digest are rejected as
unverified drift. The workflow never silently re-baselines them. Restore the previous
bytes or install an exact payload and run an applicable registered migration.

The payload manifest answers “are these copied bytes internally consistent with this
manifest?” It does not answer “who published these bytes?” See
[ownership and state](../architecture/ownership-and-state.md) for that trust boundary.
