# Upgrade matrix

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

Upgrade coverage uses real, individually pinned historical payloads rather than newly
manufactured legacy fixtures. For each supported source/target pair, acceptance must
show that the exact reviewed `tools/` + `docs/toolingdocs/` replacement is internally
consistent, the registered migration check names the expected path, and the applying
run changes only permitted configuration/state.

| Case | Required result |
| --- | --- |
| Historical payload | Exact source identity and expected registered target path. |
| Tampered replacement | Payload validation/verification rejects it before migration. |
| Read-only migration | No target mutation; deterministic pending migration list. |
| Applied migration | Bounded transaction, verified state and preserved product hashes. |
| Repeated migration | Byte-stable no-op with no new report/state change. |

The current historical coverage and source constraints are described in
[copy matrix](copy-matrix.md). See [migrations](../integration/migrations.md) for the
runtime boundary.
