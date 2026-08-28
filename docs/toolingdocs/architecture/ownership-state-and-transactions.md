# Ownership, state and transactions

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Every integration operation is classified as `tooling`, `structured`, or `project`.
Tooling-owned paths are limited to the copied tooling/docs payload and state; a
structured operation changes only an allowlisted key with a captured preimage; a
project-owned path is never automatically overwritten. The planner and transaction
validate these limits before staging and again before publishing.

`.tooling-state/state.toml` persists the selected profile, optional features, applied
migrations and an integration digest. The digest detects a managed tree that no longer
matches the last verified state. It must not be edited to silence drift: restore the
known bytes or use a registered migration.

For a non-empty Full-Fix or migration plan, the implementation re-plans after
preflight, stages only planned outputs, verifies the staged result, checks live
preimages, publishes state last, and rolls back if publication or final verification
fails. The temporary backup is part of that transaction, not a long-term product backup.
Detailed policies remain in [Ownership and state](ownership-and-state.md) and
[Full-Fix](../integration/full-fix.md).
