# Rollback matrix

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

Fault-injection cases prove the limits of the integration transaction rather than
claiming a general project backup service.

| Failure point | Expected result |
| --- | --- |
| Assessment/preflight conflict | No mutation; a report is not required. |
| Staging or staged verification failure | Live tree unchanged; no published state. |
| Live preimage mismatch | Publication is refused; foreign/concurrent bytes are not overwritten. |
| Mid-publication or final-verification failure | Temporary backup restores changed paths or removes newly created ones. |
| Repeat after recovery | Read-only Check explains remaining issues or shows a valid no-op. |

Tests must preserve product and foreign structured hashes, inspect transaction evidence
where it exists, and avoid using a live adapter action as a rollback assertion. See
[rollback and recovery](../integration/rollback-and-recovery.md) and
[security boundaries](../development/security-boundaries.md).
