# Reports reference

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

Read-only Check and Verify do not create reports. A mutating Full-Fix or migration can
publish evidence after the transaction has entered its staged/final verification
boundary. Failures that occur earlier, such as a conflict or dirty-worktree preflight,
do not promise a report.

Each published report is an atomically renamed directory below
`.tooling-state/reports/<UTC-timestamp>/` containing:

- `integration.json`: report schema version 1, outcome, sanitized plan, verification
  findings and notices;
- `summary.md`: a human-readable outcome, plan/verification status, counts, operations
  and notices.

Plan serialization contains operation kind, relative path, source path, ownership,
expected preimage digest, reason and structured key names. It deliberately excludes
replacement bytes and structured values. Findings contain check, status, message,
adapter and path. Project-root occurrences and unsafe control characters are sanitized.

The transaction also writes `.tooling-state/reports/journal.json` before live
publication. It records each affected path, operation, ownership, before/after kind and
digest, and whether rollback restores a backup or removes a new path. The actual backup
is temporary and is discarded with the transaction scratch tree; the journal is
evidence, not a retained recovery archive.

A successful CLI result includes the timestamped report directory as a project-relative
`report_path` when one was published. See [Full-Fix and actions](../integration/full-fix-and-actions.md)
for the transaction sequence.
