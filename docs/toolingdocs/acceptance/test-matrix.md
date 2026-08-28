# Test matrix

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

The acceptance matrix tests the copied payload in fresh temporary target projects.
Each required row exercises this sequence: read-only `integrate --check`, bounded
`integrate --full-fix`, `tooling verify`, a second Check, the applicable copied-tooling
test path, and an idempotent second Full-Fix. Product and foreign structured hashes are
captured before and compared after the transaction.

| Area | Required evidence |
| --- | --- |
| Detection | Expected profile/proposal and bounded evidence only. |
| Integration | Supported operations, no unauthorized product writes, and a report only when mutation reached that boundary. |
| Verification | Conflict-free no-op with no `FAIL` findings. |
| Idempotence | No actions, report, state change or protected-tree change on repeat. |
| Portability | Copied tooling runs without imports or fixtures from the source checkout. |

The concrete fixtures are listed in [copy matrix](copy-matrix.md). Add technology
coverage through the [profile matrix](profile-matrix.md), not by broadening an existing
fixture's unstated authority.
