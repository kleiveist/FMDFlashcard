# Project context and paths

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

`ProjectContext` is the single source of truth for paths. By default, the copied
`tools/` directory is the tooling root and its parent is the project root. Loading the
context is read-only: it does not create configuration, state, reports, logs, caches or
bytecode.

## Resolved locations

| Context value | Location |
| --- | --- |
| Tooling root | `<project>/tools` |
| Profile resources | `<project>/tools/resources/profiles` |
| Other resources | `<project>/tools/resources/config` and `tools/resources/examples` |
| Project configuration | `<project>/project-tooling.toml` |
| Documentation root | `<project>/<paths.docs>/toolingdocs` |
| Tooling state | `<project>/.tooling-state` |
| Runtime data | `<project>/.tooling-state/runtime` |
| Tooling virtual environment | `<project>/.tooling-state/venv` |
| Product roots | `paths.frontend`, optional `paths.backend`, and `paths.tauri` |

The four configured product/documentation paths are canonical project-relative paths.
They use `/` separators, may not contain an absolute path, drive prefix, NUL byte or
`..`, and may not resolve outside the project. `paths.backend` may be the empty string
to represent a project without a configured backend. State, runtime and virtual
environment paths are fixed and reject unsafe symlink redirection.

## Persisted decisions and discovery

An existing [project configuration](../reference/project-configuration.md) always wins
over discovery. When configuration is absent, assessment performs a bounded, no-follow
scan and builds an in-memory proposal. The scan descends at most six levels, inspects at
most 4,096 entries and excludes tooling, documentation, state, dependencies, caches and
build outputs. It looks for Vite, FastAPI, Tauri and Compose evidence.

Discovery suggestions are not persisted by `integrate --check`. A first successful
`integrate --full-fix` creates `project-tooling.toml` and the tooling state in the same
transaction. Ambiguous candidate roots become conflicts instead of arbitrary choices.
`full-platform` is never inferred because its filesystem evidence is indistinguishable
from `desktop-cloud`; selecting it is an explicit project decision.

If no technology is detected, the write-free proposal uses the safe defaults
`web-only`, `frontend`, an empty backend path, `src-tauri` and `docs`. These defaults do
not authorize creation of missing product directories.
