# Export and release boundary

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

`tooling export` produces a portable directory containing only the reviewed `tools/`
and `docs/toolingdocs/` trees. It rejects unsafe paths, symbolic links, unapproved
runtime/build objects and an already existing destination, then emits a deterministic
payload manifest. Generated reports, caches, environments and product artifacts stay
outside the export.

The manifest inventories payload files and their digests so a recipient can detect an
incomplete or mixed copy. It is self-consistency evidence only: a coherent replacement
of both the files and manifest is not authenticated. Distribution therefore also needs
a trusted source revision and any release checksums/signatures maintained outside the
payload.

The source repository's official release layer keeps that publisher material outside the
portable trees. It wraps a validated export in a reproducible
`Template-Tooling-<version>.tar.gz`, publishes `SHA256SUMS`, and records a GitHub Sigstore
provenance attestation for the archive digest. The annotated `tooling-v<version>` tag and
permanent GitHub Release identify the reviewed source revision. None of those repository
objects is copied into a customer payload.

Release validation must keep the boundary clear: product builds and publication are
explicit live operations, while portable export is limited to tooling and its
documentation. See [release process](../development/release-process.md) and
[tooling replacement](../integration/tooling-replacement.md).
