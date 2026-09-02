# Tooling Architecture

The tooling is owned by FMDFlashcard and optimized for one React/Vite/Tauri application. It adopts a stable command contract without importing Template-Tooling's integration, profiles, adapters, databases, containers, exports, or migrations.

```text
tools/
  control.py             dependency-free entry point
  control_parser.py      canonical parser and legacy normalization
  control_dispatch.py    explicit handler map and exit boundaries
  paths.py               one repository root and safe path checks
  process.py             shell-free subprocess/process identity helpers
  project_config.py      version, bundle, and release-matrix contract
  artifacts.py           native evidence, archives, manifests, checksums
  commands/              focused FMD command handlers
  tests/                 unit and source-contract tests
```

Read-only commands set `sys.dont_write_bytecode` before importing the package so help, doctor, checks, and dry-runs do not create local Python caches. Mutating commands create only their documented output roots.

Parser construction and dispatch are separate. Bare groups carry their parser through `set_defaults`, print their own map, and exit zero. Parser errors print actionable help to stderr and exit `2`; child failures keep their nonzero exit status.
