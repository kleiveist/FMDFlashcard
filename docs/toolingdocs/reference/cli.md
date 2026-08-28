# CLI reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

The portable entry point is `python tools/control.py`. Integration commands take the
safe early-dispatch path so malformed project configuration can be reported without
eagerly importing unrelated product command modules.

| Command | Mutates | Result |
| --- | --- | --- |
| `integrate --check [--json]` | No | Detects, plans and verifies. Exit 0 only for a verified no-op; otherwise 1. |
| `integrate --full-fix [--json]` | If the plan is non-empty | Applies the complete supported plan transactionally. Exit 0 on success. |
| `tooling migrate --check [--json]` | No | Assesses applicable migrations; `--json` includes their IDs. Exit 0 only when assessment is already a verified no-op. |
| `tooling migrate [--json]` | If a migration/reconciliation plan is non-empty | Applies all currently applicable registry migrations in deterministic order. |
| `tooling verify [--json]` | No | Requires a no-op plan and successful verification. |
| `tooling action <adapter> <capability> [--json]` | Capability-dependent, live | Runs one fixed capability for an adapter selected by the active profile. |
| `tooling export [--output PATH]` | Creates one new export directory | Writes a deterministic `Template-Tooling-<version>/` under the existing output parent; refuses unsafe sources and an existing destination. |
| `docs check [--docs-dir PATH]` | No | Validates documentation indices, backlinks and targets. |
| `docs index [--dry-run]` | Unless dry-run | Runs the configured PyGitIndex regeneration command. |

`integrate` requires exactly one of `--check` and `--full-fix`. Adapter capability is
one of `install`, `run`, `stop`, `test` or `build`, but the selected adapter may support
only a subset. Parser errors and unsupported command syntax exit 2. Runtime errors are
sanitized and normally exit 1.

`--json` output is one sorted JSON object using output schema version 1. Check,
Full-Fix, migration and verification include detection, profile, plan and verification
data. Adapter actions include adapter, capability and a bounded real command message.
Export reports its target, file count and manifest digest as text; it does not currently expose
`--json`.

The integration commands are covered in more detail by [Check](../integration/check.md),
[Full-Fix](../integration/full-fix-and-actions.md) and
[migration/verification](../integration/migration-verification-and-drift.md).
