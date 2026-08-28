# Report schema

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

Mutating Full-Fix and migration runs can publish a timestamped directory below
`.tooling-state/reports/`. Schema-version-1 `integration.json` contains `outcome`, a
sanitized `plan`, `verification` data and `notices`; `summary.md` is its concise
human-readable companion. Check and Verify never create a report.

Serialized operations include kind, relative path, source path, ownership, expected
digest, reason and structured key names. Replacement bytes and structured values are
deliberately omitted. Findings include check, status, message, adapter and path after
sanitization. A transaction journal may record before/after evidence for publication;
it is not a retained backup.

Reports are project-local diagnostic evidence and can contain command/result detail;
review them before sharing. See [Reports reference](reports.md),
[rollback and recovery](../integration/rollback-and-recovery.md), and
[evidence index](../acceptance/evidence-index.md).
