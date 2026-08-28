# Upgrading tooling

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

An upgrade has two boundaries: replace the reviewed portable payload pair, then migrate
the target's persisted configuration/state if an exact registered path applies. Keep
product files, `project-tooling.toml` and `.tooling-state/` in place; those are not part
of the replaceable payload.

1. Preserve a recoverable snapshot and confirm a clean/known project state.
2. Replace matching `tools/` and `docs/toolingdocs/` trees from one trusted release.
3. Validate the copied payload and inspect migration applicability:

   ```sh
   python tools/control.py tooling migrate --check --json
   ```

4. Apply an applicable migration, then run `tooling verify` and a second Check.

Do not treat a same-version replacement as a migration or edit state to suppress drift.
The manifest verifies copy consistency, not publisher identity. See
[tooling replacement](../integration/tooling-replacement.md) and
[migrations](../integration/migrations.md).
