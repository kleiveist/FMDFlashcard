<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# Releases

The normal command surface validates product releases but does not publish them.
The source repository has a separate, operator-controlled `tooling-v*` workflow for
publishing the portable tooling itself.

## Obtain and verify an official portable release

An official release uses a tag that exactly matches `tools/VERSION`, for example
`tooling-v0.4.0`. It publishes a deterministic `Template-Tooling-<version>.tar.gz`,
an external `SHA256SUMS` file, and a Sigstore provenance bundle. The archive keeps
the single top-level version directory and contains only `tools/` and
`docs/toolingdocs/` below it.

Download and verify the archive before extraction:

```sh
gh release download tooling-v0.4.0 --repo kleiveist/Template-Tooling
sha256sum --check SHA256SUMS
gh attestation verify Template-Tooling-0.4.0.tar.gz \
  --repo kleiveist/Template-Tooling
tar -xzf Template-Tooling-0.4.0.tar.gz
```

The external checksum detects a changed archive and the GitHub attestation binds its
digest to this repository's tag workflow. After extraction,
`tools/PORTABLE-PAYLOAD.json` independently validates the internal payload. Retain all
three layers; none is a substitute for the others.

## Version checks

Show the effective version and validate enabled component metadata:

```sh
python tools/control.py version
python tools/control.py version check
```

The root `VERSION` file is the product source of truth when present; otherwise the tooling falls
back to `tools/VERSION`. The check requires valid SemVer and compares the metadata of enabled
frontend and Tauri components.

To copy the product version into enabled component metadata:

```sh
python tools/control.py version sync
```

`version sync` directly changes product-owned files such as `package.json`, lockfiles,
`tauri.conf.json`, `Cargo.toml`, or `Cargo.lock` when applicable. It is not an integration
transaction. Review and commit those changes as an explicit product-version update.

## Non-publishing release gate

```sh
python tools/control.py release check
```

The gate checks applicable version metadata, project identity, desktop security/capabilities,
tag context, Git cleanliness, and signing-environment signals. A warning is evidence to review;
only a reported failure makes the command fail. The command neither uploads nor publishes an
artifact.

Run the applicable tests and builds before this gate, inspect every warning, and verify artifact
checksums and signatures using the target platform's release process.

## Export the portable tooling

```sh
python tools/control.py tooling export
python tools/control.py tooling export --output PATH
```

The default output parent is the current directory; `--output` must name an existing directory.
The command stages and validates `Template-Tooling-<version>/`, normalizes file metadata, and
publishes it only if no case-insensitive destination already exists. It never merges or replaces
an earlier export.

The result contains exactly `tools/` and `docs/toolingdocs/`. Source-only tests, repository files,
Git metadata, local state, dependency environments, logs, caches and build intermediates are not
included. The one verified Rust analyzer WASM and the Tauri `build/` source directory are narrow
policy exceptions. Symlinks, hidden runtime objects, case-folding collisions and any other
`dist/` object fail closed.

The included payload manifest verifies the exported bytes and relocation-independent paths; it
does not authenticate the source or sign the directory. For an official distribution, use the
tagged GitHub Release, its external checksum, and its provenance attestation. For a private local
export, maintain an equivalent trusted revision and checksum/signature chain separately. Follow
the [folder replacement guide](folder-replacement.md), and never combine files from different
exports.
