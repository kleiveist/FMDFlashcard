<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

# Refactor inventory

Status: Phase 1 baseline for `refactor/portable-tooling`

Reference commit: `9fefcdd`

Scope: all versioned runtime modules, resources, tests, and documentation placeholders

This inventory is deliberately a classification, not an attempt to make the inherited
master-template tests green. The target is portable tooling that compares an observed
project with a profile-defined desired state. It is not a product scaffold, a template Git
client, or an owner of application source code.

## Decision vocabulary

| Decision | Meaning |
| --- | --- |
| `KEEP` | Reusable as-is apart from import cleanup or documentation. |
| `REFACTOR` | Valuable behavior remains, but roots, runtime paths, or dependencies must use `ProjectContext`. |
| `EXTRACT` | Preserve a bounded mechanism in a new core/integration module, then remove the old module. |
| `REPLACE` | The responsibility remains, but its current product/template model is wrong. |
| `REMOVE` | Obsolete for portable tooling and must not survive in runtime, tests, or documentation. |

## Baseline evidence

The canonical command is currently not runnable:

```text
PYTHONDONTWRITEBYTECODE=1 python tools/control.py test --suite tools
=> exit 1; the child process hard-codes missing tools/.venv/bin/python (exit 127)
```

A clean temporary virtual environment built from `tools/requirements.txt` produced these
read-only diagnostics:

| Run | Result | Classification |
| --- | --- | --- |
| Complete collection | one collection error at root `config/environment.toml` | old root/resource wiring |
| Suite without that collector | 450 passed, 102 failed, 119 skipped, 199 errors | mixed baseline |
| Non-quality tests | 331 passed, 43 failed, 115 skipped | mostly absent master-product files |
| Quality tests | 119 passed, 59 failed, 4 skipped, 199 errors | root config and tooling-venv wiring |

All 199 quality setup errors come from looking for root `config/code-quality.toml`. Fifty-eight
Rust analyzer failures become passing tests when the launcher is pointed at a portable Python
runtime. The reusable test logic is therefore retained, while the old paths are not.

The checkout contains no ignored local `.venv`, `.runtime`, `target`, cache, or log directory.
The immediately preceding cleanup commit removed four tracked `tools/.runtime` files and 80
tracked Rust `target/` files. That history is a portable-export regression case, not permission to
restore those artifacts. The checked-in `tools/quality/rust_analyzer/dist/*.wasm` is an explicit
runtime resource and is not a Cargo build directory.

## Repository-level inventory

| Path | Decision | Target / reason |
| --- | --- | --- |
| `.gitattributes` | `KEEP` | Portable line-ending policy. |
| `.gitignore` | `REFACTOR` | Ignore project-root runtime/state/build outputs and exercise export exclusions. |
| `LICENSE` | `KEEP` | Repository licence; export has its own `tools/LICENSE`. |
| `README.md` (missing) | `REPLACE` | New repository-only README; never part of export. |
| `.github/` (missing) | `REMOVE` | Hosted push/pull-request workflows are outside the slim copy-paste scope; local acceptance covers copy, integration, idempotence, migration, and export. |
| `docs/toolingdocs/**/.gitkeep` | `REPLACE` | Replace placeholders with portable architecture, integration, guides, reference, acceptance, and case-study sources. |

## Runtime module inventory

### Entry point and shared utilities

| Module | Decision | Target / reason |
| --- | --- | --- |
| `tools/__init__.py` | `KEEP` | Package marker and version-facing exports only. |
| `tools/logger.py` | `KEEP` | Product-independent console logging. |
| `tools/process.py` | `KEEP` | Product-independent subprocess wrapper. |
| `tools/control.py` | `REFACTOR` | Add integration/tooling services, remove eager lifecycle import, resolve one context. |
| `tools/control_parser.py` | `REFACTOR` | Replace template/scaffold language and register `integrate` and `tooling export`. |
| `tools/VERSION` | `KEEP` | Portable tooling version source. |
| `tools/requirements.txt` | `REFACTOR` | Runtime/test contract remains, but its environment moves outside `tools/`. |
| `tools/LICENSE` | `KEEP` | Included in portable tooling. |

### Project configuration and profiles

| Module | Decision | Target / reason |
| --- | --- | --- |
| `tools/config/model.py` | `KEEP` | Generic typed environment contract. |
| `tools/config/masking.py` | `KEEP` | Generic secret masking. |
| `tools/config/validation.py` | `KEEP` | Generic validation rules. |
| `tools/config/loader.py` | `REFACTOR` | Load from `context.resources.config`, never root `config/`. |
| `tools/profiles/model.py` | `KEEP` | Profile/feature value objects are reusable. |
| `tools/profiles/validator.py` | `KEEP` | Catalog and feature-dependency validation are reusable. |
| `tools/profiles/loader.py` | `REFACTOR` | Load from `context.resources.profiles`; replace `project-profile.toml` with project tooling config. |
| `tools/profiles/runtime.py` | `REFACTOR` | Resolve active profile from `ProjectContext`; no module-level root. |
| `tools/profiles/generator.py` | `REPLACE` | Whole-product scaffold generation becomes detected-state/profile integration planning. |
| `tools/profiles/cli.py` | `REPLACE` | Remove lifecycle finalization and expose profile detection/selection through integration. |

### Quality subsystem

| Module group | Decision | Target / reason |
| --- | --- | --- |
| `tools/quality/model.py`, `exceptions.py`, `reporter.py` | `KEEP` | Generic findings, exceptions, and reporting. |
| `tools/quality/scanner.py`, `architecture.py`, `python_imports.py`, `typescript.py`, `rust_ast.py` | `KEEP` | Reusable analyzers; roots are already arguments at their useful boundaries. |
| `tools/quality/config.py`, `control.py` | `REFACTOR` | Default config and source roots come from context/resources. |
| `tools/quality/tooling.py`, `rust.py` | `REFACTOR` | Remove `tools/.venv` launchers; use project-state runtime or current interpreter. |
| `tools/quality/rust_analyzer/src/**`, `tests/**`, `Cargo.toml`, `Cargo.lock`, toolchain and provenance | `KEEP` | Reproducible analyzer source. Cargo output must remain outside the export. |
| `tools/quality/rust_analyzer/build.py` | `REFACTOR` | Build in external state/temp space and deliberately publish only the verified runtime asset. |
| `tools/quality/rust_analyzer/dist/rust_quality_analyzer.wasm` | `KEEP` | Checked-in verified runtime resource, not an incidental `target/` artifact. |

### Tauri subsystem

| Module group | Decision | Target / reason |
| --- | --- | --- |
| `tools/tauri/paths.py` | `REPLACE` | Compatibility facade over `ProjectContext.paths`; remove fixed frontend/Tauri roots. |
| `tools/tauri/common.py`, `doctor.py`, `install.py`, `test.py`, `copy.py`, `cache.py` | `REFACTOR` | Retain diagnostics/safety while taking context paths. |
| `tools/tauri/run.py`, `control.py` | `REFACTOR` | Delegate technology details to the Tauri adapter; runtime files move to `.tooling-state/runtime`. |
| `tools/tauri/build/**` | `REFACTOR` | Retain platform build logic; resolve paths via context and emit outside `tools/`. |
| `tools/tauri/linux/**`, `tools/tauri/fixes/**` | `KEEP` | Host-specific installation/fix logic is portable and has no product ownership. |

### Existing command implementations

| Module | Decision | Target / reason |
| --- | --- | --- |
| `tools/inst/tooling_runtime.py` | `REFACTOR` | Centralize a state-root tooling environment, never `tools/.venv`. |
| `tools/inst/install.py`, `doctor.py`, `run.py`, `run_test.py`, `stop.py` | `REFACTOR` | Use context paths, adapter selection, and `.tooling-state/runtime`. |
| `tools/inst/build.py`, `container.py`, `db.py` | `REFACTOR` | Move technology knowledge behind frontend/container/database adapters. |
| `tools/inst/configuration.py`, `docs_index.py` | `REFACTOR` | Use context resources/docs and configurable project documentation paths. |
| `tools/inst/report.py`, `e2e.py` | `KEEP` | Generic result/report helpers; callers supply context paths. |
| `tools/inst/release.py`, `release_publish.py`, `release_publish_cli.py`, `release_publish_bundle.py` | `REFACTOR` | Tooling release/export owns only `tools/` and `docs/toolingdocs/`; product release is adapter-driven. |
| `tools/inst/console.py` | `REPLACE` | Menu and descriptions must represent portable commands and adapter capabilities. |

### Resources

| Resource | Decision | Target / reason |
| --- | --- | --- |
| Five files `tools/resources/profiles/{web-only,web-cloud,desktop-local,desktop-cloud,full-platform}.toml` | `KEEP` | Canonical portable profiles. |
| `tools/resources/profiles/features.toml` | `REFACTOR` | Replace whole-product scaffold path ownership with feature/adapter requirements. |
| `tools/resources/config/*.toml` | `KEEP` | Canonical packaged config loaded from `context.resources.config`. |
| `tools/resources/examples/*` | `REFACTOR` | Examples must use `project-tooling.toml` and portable paths. |

## `template_lifecycle` disposition

The old package must survive only long enough to characterize and extract its safety properties.

| Old module | Decision | New target / retained mechanism |
| --- | --- | --- |
| `manifest.py` | `EXTRACT` | `tools/core/manifest.py`: safe relative paths, deterministic SHA-256 manifests, file-mode/type handling, symlink containment. Scope only managed assets. |
| `state.py` | `EXTRACT` | `tools/core/state.py`: no-follow reads, inode checks, deterministic atomic/fsynced writes; model `.tooling-state`, not commits/baselines. |
| `planner.py` | `REPLACE` | `tools/integration/planner.py`: observed project state versus desired profile; ownership-aware operations. |
| `apply.py` | `EXTRACT` | `tools/integration/transaction.py`: clean-Git/HEAD/preimage checks, isolated staging, backup, verification, state-last commit, rollback, journal. |
| `migrations.py` | `EXTRACT` | `tools/integration/migrations.py`: deterministic registry, idempotency, pre/postconditions, no-shell and path/data guards. Version by tooling/state schema. |
| `verify.py` | `EXTRACT` | `tools/integration/verify.py`: generic finding/result aggregation plus adapter verification. |
| `report.py` | `EXTRACT` | `tools/integration/report.py`: atomic JSON/Markdown evidence, redaction and path sanitization. No report during `--check`. |
| `model.py` | `REPLACE` | `tools/integration/model.py`: ownership, operation, conflict, plan, finding, verification; no template identity/source/commit. |
| `service.py` | `REPLACE` | Small detection, planning, check, full-fix, migration, verification, and reporting services. |
| `cli.py` | `REPLACE` | `tools/integration/cli.py`; top-level `integrate --check` and `integrate --full-fix`. |
| `scaffold.py` | `REMOVE` | Delete historical reconstruction/finalization. Build small generic `tools/integration/assets.py` from core safe-file primitives only. |
| `source.py` | `REMOVE` | External template Git source, refs, and trust policy are not part of portable tooling. |
| `merge.py` | `REMOVE` | Product-wide three-way merge has no role in profile integration. |
| hard-coded ID/URL, `.template/`, full-product baseline | `REMOVE` | Explicitly prohibited target architecture. |

Deletion order is safety-sensitive: add filesystem/context primitives; extract manifest/state; add
new integration models; port report/migrations; implement profile planner; port transaction;
implement verification/services/CLI; rewire outside imports; only then delete the package.

## Test inventory

| Test group | Decision | Treatment |
| --- | --- | --- |
| `tools/tests/test_logger.py`, `test_process.py` | `KEEP` | Directly reusable utility tests. |
| Configuration model/masking/validation portions of `test_configuration.py` | `REFACTOR` | Point at packaged resources/context; retain validation behavior. |
| Profile model/catalog/validator portions of `test_profiles.py`, `test_profile_identity.py` | `REFACTOR` | Retain feature semantics; replace scaffold/root-product assertions. |
| `tools/tests/quality/**` | `REFACTOR` | Retain analyzer behavior; fixtures use resources/context and external runtime. |
| Tauri safety/cache/platform tests | `REFACTOR` | Exercise fixture contexts and adapter boundaries instead of root product files. |
| Install/run/stop/test/report/config/db command tests | `REFACTOR` | Inject fixture contexts and state-root runtime; retain process and cleanup safety. |
| `test_readme_onboarding.py`, `test_community_ownership.py` | `REMOVE` | Assert old README/community/master-template contents. New repository/docs acceptance replaces them. |
| Old product/workflow portions of `test_ci_workflows.py`, `test_container_release.py`, `test_frontend_quality_tooling.py`, `test_release_publish.py` | `REPLACE` | Local portable export/copy/integration acceptance and adapter fixture tests. |
| `test_profile_lifecycle_init.py`, `test_template_cli_integration.py` | `REPLACE` | New integration CLI tests; no scaffold initialization or template command. |
| `tools/tests/template_lifecycle/test_manifest.py`, `test_state.py`, generic safety from `test_apply.py`, `test_migrations.py`, `test_report.py`, `test_verify.py` | `EXTRACT` | Port bounded characterization cases to `tools/tests/core/` and `tools/tests/integration/`. |
| Lifecycle planner/service/status/integration/generation/CLI tests | `REPLACE` | Desired-profile planning, ownership, check/full-fix/idempotency, and copy fixtures. |
| Lifecycle source/merge/scaffold/adopt/audit/traceability tests | `REMOVE` | Test explicitly removed Git-template, reconstruction, adoption, and old traceability models. |
| Skips caused by absent root frontend/backend/Tauri/deployment | `REPLACE` | Independent target fixtures become mandatory rather than silently skipped. |

## Non-negotiable ownership boundary

The extracted transaction must enforce these categories both while planning and immediately
before mutation:

| Ownership | Paths / behavior |
| --- | --- |
| Tooling-managed | `tools/**`, `docs/toolingdocs/**`; may be fully verified/replaced by a later copy. |
| Project-managed | Application source, product data, business logic, UI components, and unknown files; never overwritten automatically. |
| Structured-managed | Only allowlisted keys in `package.json`, `Cargo.toml`, `pyproject.toml`, `tauri.conf.json`, workflows, and `project-tooling.toml`; all foreign content is preserved. |

Phase 1 is complete only as an inventory. No classification above is permission to mutate a
target project until the context, ownership model, planner, transaction, rollback, and fixture
tests in later phases enforce it.
