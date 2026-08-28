# Fixture development

<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

Fixtures represent independent target projects, not hidden copies of this repository's
application tree. Keep each fixture minimal and state its expected profile, relevant
existing markers and protected product/foreign structured files. Copy the portable
payload into a fresh temporary root for every acceptance case.

Each fixture should prove read-only Check, bounded Full-Fix, Verify, a second
conflict-free Check and an idempotent second Full-Fix. Add a focused fault-injection
case when changing a transaction boundary, and retain real pinned historical payloads
for versioned replacement coverage. Do not manufacture a "legacy" payload merely to
satisfy a migration test.

The current fixtures and their required assertions are in [test matrix](../acceptance/test-matrix.md)
and [copy matrix](../acceptance/copy-matrix.md).
