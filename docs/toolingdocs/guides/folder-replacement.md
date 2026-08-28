<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# Replace a portable tooling payload

A tooling update replaces exactly two complete directories: `tools/` and the target's
configured `<paths.docs>/toolingdocs/` tree. The source repository always supplies that
second tree from `docs/toolingdocs/`, but the target parent may be different (for example,
`handbook/toolingdocs/`). Resolve it from `project-tooling.toml` before copying. The update
must not replace product source, `project-tooling.toml`, or `.tooling-state/`.

## 1. Prepare a recoverable change

1. Start from a trusted, pinned repository revision or reviewed release package.
2. Confirm that it contains both complete payload directories.
3. Commit or stash all unrelated target-project work.
4. Back up the existing `tools/` and resolved `<paths.docs>/toolingdocs/` outside the
   project tree.
5. Record the current `tools/VERSION`, `project-tooling.toml`, and `.tooling-state/` contents.

Do not merge two payload versions file by file. Do not follow symbolic links, copy caches, or
copy dependency/build directories. The payload manifest is an internal consistency check, not
proof that the source revision is authentic; establish trust in the source separately.

## 2. Replace only the two owned directories

Remove or move the old `tools/` and resolved target documentation tree only after the external
backup is complete, then copy both new directories into those exact locations. Use explicit
paths and inspect the result before any mutating tooling command. Never assume the default
`docs/` parent when persisted configuration names another location.

For example, after confirming that `project-tooling.toml` contains
`paths.docs = "handbook"` and that both exact destinations no longer exist:

```sh
cp -R /absolute/trusted/Template-Tooling/tools /absolute/target-project/
mkdir -p /absolute/target-project/handbook
cp -R /absolute/trusted/Template-Tooling/docs/toolingdocs /absolute/target-project/handbook/
```

Replace every example path with a resolved path you have inspected. If either destination still
exists, stop instead of using `cp` to merge directory contents.

Preserve these target-owned paths:

- `project-tooling.toml`
- `.tooling-state/`
- all application, configuration, data, and unknown files outside `tools/` and the resolved
  target tooling-documentation directory

The repository-only root `README.md`, workflow handoff files, other repository metadata, and
`.dist/` are not part of this copy operation.

## 3. Inspect migration compatibility

The read-only migration assessment can run immediately after copying:

```sh
python tools/control.py tooling migrate --check --json
```

Review the reported old version, new version, pending migration IDs, profile, paths, payload
consistency, and conflicts. The production registry retains the historical `0.1.0` to `0.2.0`,
`0.1.0` to `0.3.0`, and `0.2.0` to `0.3.0` paths. The current `0.4.0` payload adds direct
reconciliations from `0.1.0`, `0.2.0`, and `0.3.0`; it never relies on implicit migration
chaining. An unregistered version jump fails closed; do not edit state to bypass it.

A same-version replacement has no version migration to apply. Verification still checks payload
and recorded integration state for drift.

## 4. Establish the clean mutation precondition

In a Git project where the portable directories are tracked, the replacement itself makes the
worktree dirty. After the read-only assessment succeeds, review and commit the exact two-tree
replacement as its own atomic payload-update commit. The mutating migration requires a clean
worktree and will reject staged, unstaged, or untracked changes. In a non-Git target the tooling
uses its non-repository safety path.

Do not hide Git metadata or bypass the preflight. The clean commit is the recovery point for the
new payload before state/config migration.

## 5. Migrate, verify, and reconcile

```sh
python tools/control.py tooling migrate
python tools/control.py tooling verify
python tools/control.py integrate --check
```

The migration is transactional: it checks preconditions, stages the change, verifies the result,
publishes state last, and rolls back on failure. Review any integration operations separately. If
the plan is accepted, apply it only after the Git top-level/root and cleanliness preflight
passes, or through the verified non-repository path when local `.git` is absent:

```sh
python tools/control.py integrate --full-fix
python tools/control.py tooling verify
```

Run the relevant [tests](tests.md), inspect `git diff` and `.tooling-state/` evidence, then commit
the migration/integration result separately from the payload copy.

## Failure recovery

Stop at the first failed check. Keep the failed command output and transaction evidence, restore
the exact previous `tools/` and resolved `<paths.docs>/toolingdocs/` pair from the external
backup or Git recovery point, and re-run the old version's verification. Never combine the
restored directory of one version with the other directory of another version.

Folder replacement does not update live dependency environments. After a successful migration,
run the [install workflow](install.md) explicitly if dependency manifests or toolchain
requirements changed.
