<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

# Security boundaries

Template Tooling is designed to make bounded changes to a project an operator already controls.
It is not a sandbox for hostile projects, plugins, package manifests, dependencies, or build
scripts.

## Ownership and write authority

| Class | Authority |
| --- | --- |
| Tooling-managed | The complete `tools/` and `docs/toolingdocs/` payload may be copied or replaced as a versioned pair. Runtime operations do not treat that as authority to rewrite arbitrary product files. |
| Structured-managed | Only an adapter's explicitly allowlisted keys may change, through a structure-aware parser with preimage and verification checks. Foreign keys are preserved. |
| Project-managed | Application code, data, UI, arbitrary configuration, secrets, unknown files, and product behavior remain under operator control and are never automatically overwritten. |

Missing optional components are evidence that a capability is unavailable, not permission to
scaffold a product tree. The current built-in integration adapters add only bounded configuration
supported by detected manifests. They do not add dependency declarations.

## Read-only assessment

`python tools/control.py integrate --check` and
`python tools/control.py tooling migrate --check` inspect and plan without changing project
files or state. Machine-readable output is available with `--json`. A check may fail on unsafe
paths, symbolic links, malformed structured files, profile ambiguity, conflicts, or payload
inconsistency; failure must not be converted into a best-effort write.

The included payload manifest binds the copied files to the manifest shipped beside them. It
detects incomplete, mixed, or changed payload content when the manifest is unchanged. Because
the manifest and files travel together, it does not authenticate their publisher or repository
origin. Pin and verify the source independently.

## Transaction boundary

`python tools/control.py integrate --full-fix` and a mutating registered migration require their
preconditions, including a clean Git worktree when the target is a repository. Planned writes
are staged outside the live tree, checked against captured preimages, verified, backed up, and
published as one transaction with state last. A staging failure leaves live files unchanged;
after live publication begins, a later failure triggers rollback. Journal/report evidence exists
only after the workflow reaches those boundaries—preflight conflicts and early staging failures
may return without creating either artifact.

The guarantee covers only operations in that plan. It does not cover unrelated processes,
concurrent writes after preflight, external services, remote registries, or live dependency
environments. Dependency validation is planned only when an actual operation changes an
allowlisted dependency key; current built-in operations do not do so. When such validation is
needed, it uses a fresh disposable environment and does not publish a live `node_modules` tree.

Staged quality validation runs trusted tooling checks and bounded adapter/integration tests. It
does not import every target plugin or claim to run the complete product test matrix. A staged
build is restricted to a fixed manifest mapping; a declared npm build script, Python source, or
locked Cargo package is still target-controlled behavior and is executed only in the disposable
staging tree. Any such failure prevents publication and leaves the live target unchanged.

## Live-command boundary

These are explicit product operations rather than integration transactions:

- `python tools/control.py install`
- `python tools/control.py test --suite all`
- `python tools/control.py build web`
- `python tools/control.py version sync`
- adapter actions such as `python tools/control.py tooling action frontend test`

They may execute package-manager lifecycle behavior, application imports, scripts, plugins,
tests, compilers, container builds, or network clients selected by the target project. They can
write product lockfiles, dependency environments, caches, generated output, and external state.
They have no general transaction rollback. Run them only after reviewing the target code and
dependency sources, with the least host/network credentials needed, then inspect their output
and `git diff`.

Adapter action names and capabilities are fixed by the command parser and active profile. This
dispatch is not permission to accept an arbitrary shell command from project data.

## Filesystem and secret handling

All managed paths must remain relative to the resolved project root, use regular files and
directories where required, and reject escaping or unsafe symbolic links. Destructive
operations must resolve exact targets; the tooling must never broaden an unknown or empty path.

Secrets remain project-owned. The installer does not create `.env`. Integration transaction
reports sanitize bounded fields, but optional test reports deliberately retain full command,
absolute working directory, stdout and stderr as diagnostic evidence. Treat test reports as
potentially sensitive local runtime artifacts: review and redact them before sharing, and do not
store credentials, private keys, environment dumps, raw reports or registry tokens in `tools/`,
documentation, fixtures, logs, or acceptance artifacts.

## Non-goals and reporting

The current tooling does not provide publisher authentication, a signed archive, a hostile-code
sandbox, hermetic product builds, universal dependency rollback, or protection from a privileged
concurrent process. `tooling export` creates a deterministic, self-validating directory but does
not establish who supplied it. The exporter rejects symlinks, case-folding collisions, hidden or
sensitive runtime objects and every unapproved build/dist artifact before publishing a target.

When reporting a security issue, stop the mutating workflow, preserve the smallest redacted
reproduction and transaction evidence, identify the affected ownership boundary, and avoid
including secrets or private project content. Do not work around a fail-closed result by editing
state or disabling preflight checks.
