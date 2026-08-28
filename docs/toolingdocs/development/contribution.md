<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

# Contribution guide

Contributions should make one bounded behavior easier to verify without expanding ownership of
the target project.

## Before changing code

1. Read the active handoff and inspect `git status` without discarding other contributors'
   changes.
2. Identify whether the change belongs to core safety, project context, an adapter, integration,
   an operator command, documentation, or acceptance evidence.
3. State which paths the behavior reads and which paths it may write.
4. Add or update a fixture that represents an independent target project rather than relying on
   application files in this repository.

Use `ProjectContext` for project roots, configured component paths, packaged resources,
documentation paths, and state paths. Do not add module-import-time bindings to the source
checkout. Technology-specific detection and capabilities belong behind adapters; shared core
code must not guess a frontend, backend, desktop, database, or deployment layout.

## Ownership rules

- Tooling-managed content is limited to `tools/` and `docs/toolingdocs/` in a complete portable
  payload.
- Project-managed application source, business logic, data, UI, unknown files, and foreign
  configuration must not be overwritten automatically.
- Structured-managed changes must use the parser and exact allowlist for the supported key.
  Preserve all unrelated keys, ordering/format where the implementation promises it, and the
  file's preimage.
- Runtime state, environments, logs, reports, caches, and builds belong outside the payload,
  normally below `.tooling-state/`, `.dist/`, a target component, or a disposable directory.

Do not introduce a generic shell-operation field, arbitrary command evaluation, symlink
following, whole-file structured rewrites, or a fallback that treats an unknown path as owned.

## Verification loop

Prepare the tooling dependencies in an environment outside `tools/`, then run focused tests and
the complete suite appropriate to the change. A direct repository check is:

```sh
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tools/tests
```

Run the command-surface and documentation checks when their inputs change:

```sh
PYTHONDONTWRITEBYTECODE=1 python tools/control.py --help
PYTHONDONTWRITEBYTECODE=1 python tools/control.py docs check --docs-dir docs
```

Use `python tools/control.py integrate --check` only against a deliberate fixture or target; the
source repository marker may intentionally reject product integration. For mutating behavior,
test successful publish, precondition failure, mid-transaction failure, verification failure,
rollback, and a second idempotent run. Prove that unknown product files and foreign structured
keys remain byte-for-byte unchanged.

Before handing off, inspect:

```sh
git status --short
git diff --check
git diff --stat
```

Keep commits atomic and use an English imperative subject prefixed with the agreed emoji. Do not
mix payload replacement, state migration, product dependency changes, generated documentation,
and unrelated cleanup in one commit.

## Documentation navigation

Every `docs/toolingdocs/` page other than `index.md` has exactly one generated backlink block.
Each section overview is named after its directory and also has exactly one generated index
block. Preserve the exact `AUTO-GENERATED:backlink` and `AUTO-GENERATED:docs-index` START/END
marker pairs; repeating them in examples would itself make the navigation invalid.

Use relative Markdown links. In this source repository,
`python tools/control.py docs index --docs-dir docs` delegates to PyGitIndex and maintains the
repository-wide hierarchy below `docs/`. The default command without `--docs-dir` remains
limited to the configured portable `docs/toolingdocs/` tree. Neither mode rewrites the project
root `README.md`. After repository-wide generation, the wrapper keeps the generated
`toolingdocs.md` overview linked to the portable `toolingdocs/index.md`, so copied payloads do
not depend on a repository-only `docs/index.md`.

## Portable cleanliness

Never commit virtual environments, `node_modules`, `target`, `.dist`, caches, logs, reports,
coverage, local state, or secrets to the payload. The Rust analyzer's checked-in verified WASM
resource is an intentional runtime asset; a Cargo output directory is not.

When the payload changes, regenerate and review its manifest using the repository's designated
release workflow. The manifest must cover the complete portable file set, but it remains a
self-consistency mechanism rather than source authentication.
