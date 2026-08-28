# CI and acceptance

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Acceptance is evidence from independent copies, not a claim that every application
stack is supported. The copy fixtures exercise detection, read-only Check, Full-Fix,
verification, protected product hashes and an idempotent second run. Historical
replacement cases additionally prove that a reviewed new payload can be reconciled by
an exact registered migration.

Automation should run these checks in isolated temporary projects and retain the exact
revision, environment and command results with the candidate. Documentation navigation
is a separate portable gate: every page has one generated backlink, each overview has
an exact generated index, and `python tools/control.py docs check` is read-only.

The [test matrix](../acceptance/test-matrix.md), [profile matrix](../acceptance/profile-matrix.md),
and [release gates](../acceptance/release-gates.md) define the evidence to collect. A
passing source-only test does not replace the copied-payload acceptance path.

Hosted CI resolves Python, Node, Rust, TeX, and runner labels from one support matrix. Its
acceptance, nightly, and release paths first run Gate 0: concrete structured-adapter,
transactional-action, and rollback tests plus a runtime capability check. If that evidence is
blocked, copied acceptance is blocked as well rather than reported as a synthetic pass.
