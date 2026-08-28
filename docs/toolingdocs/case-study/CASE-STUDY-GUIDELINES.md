<!-- AUTO-GENERATED:backlink START -->
[← Back](case-study.md)
<!-- AUTO-GENERATED:backlink END -->

# Case-study guidelines

## Evidence and claim status

Every substantive implementation statement in the case study uses one of these
statuses: `IMPLEMENTED`, `VERIFIED`, `MEASURED`, `PLANNED`, or `LIMITATION`.
`IMPLEMENTED` identifies source that is present in this repository; `VERIFIED` identifies
a named automated test; `MEASURED` is reserved for a reproducible recorded run;
`PLANNED` is future work; and `LIMITATION` describes a boundary. The documents must not
turn planned work, missing platform runs, or skipped toolchains into completed results.

Stable evidence identifiers are written with `\evidence{EV-...}` and are registered in
[`evidence/claims.toml`](evidence/claims.toml). A claim must cite only an existing test or
recorded artifact. Measurements are optional: the current evidence set intentionally contains
no hand-entered success rates or durations.

"commit_state = committed" means the named test and result are attributable to the immutable
commit SHA. "commit_state = pending-next-commit" is permitted only for a PLANNED claim:
it identifies a regression target in the working tree, not completed evidence, and must be
replaced by the commit that introduces its source and recorded result.

## Editorial and source rules

The two editions have identical chapter files, labels, diagram sources, tables, bibliography
keys, evidence IDs, and limitations. They are not machine-translated at build time. Short code
examples identify their real path and are checked against the CLI where a command is shown.

Use the label prefixes `chap:`, `sec:`, `subsec:`, `fig:`, `tab:`, `lst:`, `alg:`, `eq:`,
and `app:`. Keep visual sources under `assets/diagrams/source/`; do not commit rendered
intermediates. Avoid absolute paths, external downloads, shell escape, manual page breaks,
and unresolved references or citations.

## Build discipline

Run the documented scripts from a fresh worktree. The builder uses a controlled timestamp,
temporary source copy, configured TeX engine, Biber pass, reference stabilization, PDF
validation, and rendering checks. It publishes only final PDFs below the selected temporary
output directory. `clean.py` removes only the precise default state directory and never
cleans a repository root.

The template audit in [TEMPLATE-COMPATIBILITY.md](TEMPLATE-COMPATIBILITY.md) is a required
input to every build. Any change to the audited template contract requires a new commit SHA,
re-audit, source review, and reproducibility check.
