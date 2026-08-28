# Ownership and state

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Every planned operation has one ownership class. The transaction validates that class
again before staging and before publishing any bytes.

| Ownership | Meaning | Automatic write policy |
| --- | --- | --- |
| `tooling` | Replaceable tooling, portable documentation and generated tooling state | Full-file operations are allowed only under declared managed roots and only with the required preimage checks. |
| `structured` | A project file shared with its owner | Only allowlisted dotted-key patches are allowed; first creation of canonical `project-tooling.toml` is the explicit exception. |
| `project` | Product source, application configuration, data and unknown files | Automatic writes are rejected. |

The managed roots are the copied `tools/` tree, the configured documentation root and
`.tooling-state`. Protected metadata, secrets, user data, dependency/build directories
and product source paths have additional fail-closed filters. A structured patch must
target a supported JSON or TOML document, or an existing scalar in a GitHub workflow,
declare exact non-overlapping keys and match its planned preimage. The current adapter
policy uses this mechanism only for known scripts in an existing frontend
`package.json`.

## Persistent state and managed drift

`.tooling-state/state.toml` records schema version, tooling version, profile, optional
features, applied migration IDs and an integration digest. The digest inventories the
managed tooling and documentation, the rendered project configuration, migrations and
the versioned Rust-analyzer runtime. Planned managed operations are simulated into the
digest before state is written.

On later assessment, the persisted digest is recomputed against the decisions recorded
in state. A mismatch is `unverified-managed-tree`: Full-Fix does not silently accept a
new baseline. Restore the managed content or use an applicable registered
[migration](../integration/migration-verification-and-drift.md).

## Payload self-consistency, not authentication

`tools/PORTABLE-PAYLOAD.json` is an exact inventory of the directly copyable `tools/`
and `docs/toolingdocs/` payload. It checks paths, byte sizes, SHA-256 digests and the
logical executable flag for the allowlisted entry points. It detects incomplete, mixed
or accidentally modified copies and rejects protected or unexpected payload objects.

This manifest is **self-consistency evidence, not an authenticated signature**. If an
attacker can replace both payload files and the manifest coherently, local validation
cannot establish publisher identity. On fresh integration or a version change, the
full payload is compared with the release manifest. For an already integrated
same-version tree, manifest identity is checked and the persisted integration digest
governs managed drift.

See the [state reference](../reference/tooling-state.md) for the file schema.
