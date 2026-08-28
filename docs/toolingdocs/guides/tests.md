<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# Run tests

The test command selects suites explicitly. A bare `test` prints help and does not unexpectedly
run the complete project matrix.

## Common commands

```sh
python tools/control.py test --suite tools
python tools/control.py test --suite all
python tools/control.py test --suite all --report
python tools/control.py test --suite e2e --no-start
```

`--report` accepts Markdown, JSON, all supported formats, or the concise `done` form. Generated
evidence is runtime state below `.tooling-state/`; it is not portable documentation and should
not be copied into `tools/`. Unlike sanitized integration reports, test reports retain the full
command, absolute working directory, stdout and stderr. They can contain project paths, test data
or secrets emitted by product code, so review and redact them before sharing.

## Suite map

| Suite | Scope |
| --- | --- |
| `tools` | Portable tooling unit, integration, quality, and acceptance tests. |
| `schema` | Configured schema checks. |
| `api` | Configured backend API tests. |
| `database` | Adapter-level database tests. |
| `postgres` | PostgreSQL-specific checks when enabled. |
| `frontend` | The configured frontend `npm test` command. |
| `e2e` | The configured `npm run test:e2e`; services may be started unless `--no-start` is used. |
| `tauri` | Desktop structure, Cargo checks, and Rust tests when Tauri is enabled. |
| `all` | The applicable suites above; unconfigured optional features are skipped. |

Selecting a specific suite asks the runner to evaluate that suite directly. An unconfigured
optional component can produce `SKIP` while the overall command remains successful; review every
skip instead of treating exit 0 as proof that the component ran. Missing manifests, scripts or
runtimes inside a configured feature can still fail the suite.

Adapter tests can also be dispatched directly, for example:

```sh
python tools/control.py tooling action backend test
python tools/control.py tooling action frontend test --json
```

The adapter must belong to the active profile and advertise the requested capability.

## Source-repository check

Contributors can run the tooling tests directly with an already prepared external interpreter:

```sh
PYTHONDONTWRITEBYTECODE=1 python -m pytest -q -p no:cacheprovider tools/tests
```

Install the pinned `tools/requirements.txt` into `.tooling-state/venv` or another environment
outside `tools/`. Do not create `tools/.venv`, caches, coverage output, or build artifacts in the
portable tree.

## Execution boundary

Product suites and adapter actions import or execute target-project code, scripts, plugins, and
configuration. They are live commands, not a hostile-code sandbox, and their side effects are
outside the integration transaction's rollback boundary. Review code and dependency sources
before executing tests in an untrusted target.

The staged quality validation used by `integrate --full-fix` intentionally runs trusted tooling
checks and bounded adapter/integration tests. Passing it does not claim that every product test
has run. Run the relevant product suites separately before a [build](builds.md) or
[release](releases.md).
