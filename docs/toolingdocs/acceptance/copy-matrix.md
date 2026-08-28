<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

# Copy matrix

The source acceptance suite copies the portable runtime into fresh temporary project roots. It
does not use application directories from this repository as an implicit fixture.

## Target fixtures

| Fixture | Expected profile | Boundary exercised |
| --- | --- | --- |
| `empty` | `web-only` | No product tree is scaffolded; only tooling config/state may be planned. |
| `vite` | `web-only` | Frontend detection and a narrowly structured package integration. |
| `fastapi` | `web-cloud` | Backend detection without inventing a frontend. |
| `tauri` | `desktop-local` | Desktop detection without overwriting Cargo, capabilities, or source. |
| `persisted-desktop-local` | `desktop-local` | An explicit persisted profile with frontend and Tauri evidence. |
| `persisted-web-cloud` | `web-cloud` | Explicit frontend/backend profile and provider-neutral Compose evidence. |
| `persisted-full-platform` | `full-platform` | Frontend, backend, desktop, and container evidence together. |
| `custom-paths-desktop-cloud` | `desktop-cloud` | Renamed/nested component paths and a non-default documentation root. |
| `unknown-extra-files` | `web-only` | Binary data, notes, assets, ignore rules, and a foreign workflow remain unchanged. |

For every matrix row, the test records product and structured preimages, copies a clean payload,
and performs this contract:

1. `integrate --check --json` reports the expected profile and plan and changes no byte or file
   metadata in the target snapshot.
2. `integrate --full-fix --json` publishes the accepted transaction and preserves product-owned
   hashes and foreign structured content.
3. A second check and `tooling verify --json` report an integrated state without mutation.
4. `test --suite all` runs the applicable copied-tooling path without changing the protected
   target tree.
5. A second full-fix is a stable no-op: no actions, no report, no new state, and no changed
   product or structured payload.

The clean-copy assertion rejects virtual environments, dependency trees, caches, runtime state,
coverage, logs, reports, archives, generic `build`/`dist` output, and similar artifacts. The
checked-in Rust analyzer WASM and Tauri build source directory are intentional, narrow
exceptions—not permission to copy their generated output.

## Replacement and historical migration

The replacement suite first proves that replacing the current `tools/` and
`docs/toolingdocs/` pair preserves product sentinels, `project-tooling.toml`, and
`.tooling-state/`, and that a same-version migration and repeated verification are no-ops.

Three historical cases materialize the real `0.1.0`, `0.2.0`, and `0.3.0` payloads from
individually pinned Git commit, `tools`, and `docs/toolingdocs` tree objects. Each case integrates
the old payload, replaces both portable directories with the current `0.4.0` payload, and then
proves:

- changing a copied documentation file while leaving its manifest unchanged is rejected as an
  invalid portable payload;
- verification rejects the unreconciled managed tree before migration;
- read-only migration assessment reports exactly the corresponding direct registered
  `0.1.0`/`0.2.0`/`0.3.0` to `0.4.0` reconciliation and only config/state operations;
- the mutating migration changes versioned config/state while leaving the new payload and all
  product hashes unchanged;
- verification passes afterward and the second migration is a byte-stable no-op.

The local source checkout must contain complete Git history so every pinned historical object can
be verified. Replacing any old fixture with a newly manufactured “legacy” payload would invalidate
the purpose of these tests.

## Run the focused acceptance suite

From the source repository with the pinned tooling dependencies installed outside `tools/`:

```sh
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider \
  tools/tests/acceptance/test_copy_matrix.py \
  tools/tests/acceptance/test_tooling_replacement.py \
  tests/source/test_historical_tooling_migration.py
```

Do not set `TEMPLATE_TOOLING_NESTED_TEST=1` for this top-level run; that guard exists only to
prevent recursive acceptance execution inside a copied tooling-suite subprocess. Regenerate and
review the portable manifest after any payload change before interpreting a failure as a runtime
regression.
