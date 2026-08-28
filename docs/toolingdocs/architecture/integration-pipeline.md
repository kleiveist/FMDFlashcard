# Integration pipeline

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Integration follows one deterministic pipeline:

1. resolve a read-only project context and detect bounded evidence;
2. select persisted or proposed profile/features and the matching adapters;
3. build a typed plan with operations, conflicts and verification findings;
4. for Full-Fix, preflight and re-plan, stage the immutable plan, then verify it;
5. publish only verified planned outputs, write state last, and record sanitized
   evidence when a mutation reached the reporting boundary.

`integrate --check` stops after assessment and never creates configuration, state or a
report. `integrate --full-fix` is the only command that applies the supported plan;
adapter actions are separate, explicit live commands and are not part of rollback.
Unsafe paths, malformed structured documents, ambiguity and unmanaged drift are
conflicts rather than best-effort repairs.

Use the [integration overview](../integration/integration.md) for operational commands
and [verification](../integration/verification.md) for the no-op acceptance condition.
