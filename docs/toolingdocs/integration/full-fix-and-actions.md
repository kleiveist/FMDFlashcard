# Full-Fix and actions

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Run the complete supported integration plan with:

```sh
python tools/control.py integrate --full-fix
python tools/control.py integrate --full-fix --json
```

Full-Fix first assesses the project and validates managed Python syntax. Conflicts stop
the run without mutation. A verified no-op returns immediately. Only a run that needs
changes runs a Git preflight. When the target has local `.git` metadata, its resolved
Git top-level must equal the project root and the worktree must be clean. Unsafe Git
metadata is rejected; a target without local `.git` follows the explicit non-repository
safety path. The workflow then assesses again so the transaction never relies on the
preflight plan.

## Transaction boundary

For a non-empty plan, the transaction:

1. validates ownership, paths, structured-key allowlists and preimage hashes;
2. copies a filtered project snapshot to a sibling temporary staging tree;
3. applies the immutable plan only to staging;
4. records the planned outputs, runs required fixed staged actions and rejects any
   action change to a planned output;
5. performs a fresh staged assessment and freezes the verified bytes;
6. writes a project-local journal, takes an ephemeral backup and rechecks live
   preimages;
7. publishes only the frozen planned outputs;
8. verifies the live tree and writes a sanitized report;
9. restores the backup or removes newly created paths if publication or final
   verification fails.

The staging copy excludes symbolic links; `.git`; named dependency, test and build
directories such as `.venv`, `node_modules`, `.pytest_cache`, `dist` and `target`;
reserved runtime/state directories; known data and secret locations; sensitive file
names/suffixes; and bytecode. Unrecognized directories remain observable staging input,
but only frozen planned outputs can be published. Backups live in the transaction's
temporary directory and exist for rollback; they are not a persistent product backup
service.

## Fixed staged actions

Plan paths determine whether Full-Fix must run `dependencies`, `quality`, `tests`, and `build`,
in that order. Callers cannot supply a command or shell fragment.

- Locked-dependency validation currently supports only a safe `package.json` paired
  with `package-lock.json`. It runs `npm ci --ignore-scripts --offline --no-audit
  --no-fund` in the disposable staging tree. Network access and lifecycle scripts stay
  disabled. Other dependency ecosystems or missing lockfiles fail closed rather than
  falling back to a live installer.
- Quality runs isolated Ruff checks on `tools/adapters` and `tools/integration`.
- Tests run isolated Pytest on `tools/tests/adapters` and
  `tools/tests/integration`, with plugin autoload and cache writes disabled.
- Build uses only an allowlisted manifest mapping: `npm run build` when the existing
  `package.json` declares a non-empty `scripts.build`, isolated Python source compilation for a
  `pyproject.toml`, or `cargo check --locked` for Cargo/Tauri. Missing scripts, lockfiles, or
  runtimes fail closed; Cargo targets and caches remain disposable staging output.

These actions validate the staged result. Their dependency and build artifacts are not
published to the target project. Current built-in planning does not add or update
dependency declarations; the `dependencies` action also changes no declaration and only
validates an existing lockfile offline when an allowlisted plan triggers it.

## Explicit live adapter actions

Product actions are deliberately separate and must be requested by the user:

```sh
python tools/control.py tooling action frontend test
python tools/control.py tooling action frontend test --json
```

Dispatch requires the adapter to be selected by the active profile and the capability
to be declared by that adapter. The command is a fixed built-in mapping executed from
the live project root with a bounded, sanitized subprocess environment. Consequently,
an install, run or build action may intentionally create dependencies, processes or
artifacts in the live project. It is not part of Full-Fix rollback. Review the complete
[capability map](../reference/adapter-capabilities.md) before invoking it.

Neither Full-Fix nor an adapter capability authorizes automatic scaffolding of a
missing product root. The action delegates to an existing product/tooling command and
reports its real exit status.
