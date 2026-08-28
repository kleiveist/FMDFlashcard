# Rollback and recovery

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Rollback is available only for the bounded transaction used by a non-empty Full-Fix or
registered migration. The transaction records a journal and takes a temporary backup
before live publication. If publication or final verification fails, it restores changed
paths from that backup or removes paths that were newly created by the transaction.

Preflight conflicts and staging failures occur before live publication and may not
create a report or recovery artifact. A transaction rollback is not a general backup
system: it cannot reverse concurrent edits, live adapter actions, external services,
package-manager side effects or unrelated product commands.

After an interrupted or failed run, stop mutating commands, inspect the returned error
and transaction evidence, restore/resolve any project-side problem, and run
[`integrate --check`](check.md). Do not edit state to bypass a drift or preimage
failure. The [rollback matrix](../acceptance/rollback-matrix.md) states the evidence
expected for fault-injection cases.
