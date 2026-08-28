# Migration development

<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

A migration is an exact, registered reconciliation of tooling/state versions; it is
not a generic upgrade script. Define source and target tooling/state schemas,
deterministic preconditions and postconditions, and typed operations restricted to
tooling/state or explicitly allowlisted structured fields. Never use a migration to
copy product files, establish an unexplained baseline or invoke an arbitrary command.

Implement and test both the read-only applicability assessment and the mutating path.
The latter must use the shared preflight, re-plan, staging, verification, reporting and
rollback boundary. Test an already-applied migration as a byte-stable no-op and test
rejection for payload tampering, wrong versions, unsafe paths and unexpected drift.

See [migrations](../integration/migrations.md),
[upgrade matrix](../acceptance/upgrade-matrix.md), and the historical
[refactor inventory](refactor-inventory.md).
