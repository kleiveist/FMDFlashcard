# Release gates

<!-- AUTO-GENERATED:backlink START -->
[← Back](acceptance.md)
<!-- AUTO-GENERATED:backlink END -->

A release candidate needs evidence from the exact candidate revision, not an inference
from a prior run. At minimum, the portable payload boundary, profile/fixture matrix,
migration/rollback coverage, documentation navigation, payload consistency and
idempotence need to pass or be explicitly rejected as inapplicable by policy.

| Gate | Evidence |
| --- | --- |
| Portable scope | Export contains only `tools/` and `docs/toolingdocs/`; no state or generated artifacts. |
| Navigation | `python tools/control.py docs check` passes after all documentation changes. |
| Integration | Copy fixtures prove Check, Full-Fix, Verify and repeat stability. |
| Gate 0 | Concrete structured-mutation, typed staged-action, and rollback evidence is available before acceptance jobs can run. |
| Upgrade/recovery | Registered migration and rollback cases preserve protected files. |
| Distribution | Manifest is regenerated/reviewed; the tag equals `tools/VERSION`; deterministic archive, external checksum and GitHub provenance attestation are verified before the permanent Release is published. |

Retain commands, exit codes, environment constraints and revision identifiers in the
candidate record. See [definition of done](definition-of-done.md) and
[release process](../development/release-process.md).
