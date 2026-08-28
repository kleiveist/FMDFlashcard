# Tooling replacement

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Replace portable tooling as a pair: `tools/` and the configured
`docs/toolingdocs/` tree. Do not copy a partial payload, mix documentation from another
version, or overwrite `project-tooling.toml`, `.tooling-state/`, product files or
unknown project content.

Before replacement, preserve a recoverable project snapshot, obtain the payload from a
trusted reviewed revision and check its manifest. After replacement, run a read-only
migration assessment; when an exact migration is applicable, apply it, then verify the
target. A same-version replacement followed by verification must remain a no-op.

The payload manifest detects internally inconsistent copied files but does not
authenticate the publisher. The complete operator sequence is in
[the upgrading guide](../guides/upgrading-tooling.md); the architectural distinction is
in [migration and upgrades](../architecture/migration-and-upgrades.md).
