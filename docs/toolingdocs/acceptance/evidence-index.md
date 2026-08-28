# Evidence index

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

Acceptance evidence should be traceable to an exact revision, command and environment.
Use this index as a map rather than inventing measurements or treating planned work as
completed.

| Evidence class | Source |
| --- | --- |
| Portable copy/integration | [Test matrix](test-matrix.md) and [copy matrix](copy-matrix.md). |
| Profile coverage | [Profile matrix](profile-matrix.md). |
| Payload replacement/migration | [Upgrade matrix](upgrade-matrix.md). |
| Transaction failure recovery | [Rollback matrix](rollback-matrix.md). |
| Release candidate | [Release gates](release-gates.md) and [definition of done](definition-of-done.md). |
| Mutating-run diagnostics | Sanitized reports below `.tooling-state/reports/`; see [report schema](../reference/report-schema.md). |

For every recorded result, retain the tooling version, source revision, operating system,
runtime/tool versions, fixture, command, status and relevant non-generated artifacts.
Known limitations, failures and skips belong beside the result; they must not be omitted
to make a matrix look complete.
