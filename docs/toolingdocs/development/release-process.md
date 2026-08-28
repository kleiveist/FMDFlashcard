# Release process

<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

Prepare a release from a reviewed revision with a clean, understood worktree. Run the
portable documentation check, focused integration/acceptance suites and the relevant
release validation. Record the tooling version, exact revision, environment and any
skipped/inapplicable matrix rows as evidence; a skip is not a pass for a required case.

Export only the `tools/` and `docs/toolingdocs/` payload pair. Regenerate and review its
manifest after payload changes, inspect the resulting destination, and retain any
distribution checksums/signatures outside the payload. Do not include project source,
state, dependency environments, reports, PDFs or build artifacts.

The source repository publishes portable tooling only from an annotated `tooling-v<version>`
tag. The tag must match `tools/VERSION` exactly and must point to a protected `main` revision.
Before tagging, require the Quality, Core, System, Documentation, Upgrade and Acceptance final
checks on pull requests and confirm that the candidate branch is current with `main`.

The tag-triggered Release workflow repeats Gate 0, real historical upgrades, documentation,
full portable acceptance and release-contract tests. It then creates a deterministic tarball,
`SHA256SUMS`, and a GitHub Sigstore provenance attestation. Only after every prerequisite passes
does it create or idempotently repair the permanent GitHub Release from `RELEASE-NOTES.md`.
A manual dispatch exercises the same release gates and archive verification without publishing.

Release/publish actions for a customer product remain explicit live operations. See
[export and release boundary](../architecture/export-and-release.md),
[release gates](../acceptance/release-gates.md), and the existing
[release guide](../guides/releases.md).
