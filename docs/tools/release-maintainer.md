# Release Maintainer Guide

## Safety model

The release workflow never creates or pushes a tag. Manual dispatch defaults to validation only. Native jobs build and upload evidence but cannot publish; only the final job receives `contents: write`, `attestations: write`, and `id-token: write` after every prerequisite succeeds.

The current repository has no verified license terms. `release check` warns during ordinary local validation and fails for a tagged build until the owner adds one canonical root license, the same explicit SPDX expression to `package.json` and `Cargo.toml`, and a Tauri `bundle.licenseFile` reference that includes that root license in native bundles. A license file alone does not clear the gate.

## Local release candidate validation

Keep `VERSION`, package metadata, Cargo metadata/lock, Tauri configuration, and the changelog synchronized:

```bash
./control version check
./control version sync       # explicit mutation only
./control tooling verify
./control quality --release
./control test --suite all --coverage --report --ci
./control docs check
./control release check
```

Validate every native plan even when the current host cannot build it:

```bash
./control build desktop --target linux --bundles deb,rpm,appimage --dry-run
./control build desktop --target windows --dry-run
./control build desktop --target windows-portable --dry-run
./control build desktop --target windows-cross-linux --dry-run
./control build desktop --target macos --dry-run
```

## Hosted release

1. Resolve every gate, add verified license terms, and commit a clean release candidate.
2. Confirm `VERSION` is exact SemVer and `CHANGELOG.md` has real notes under that version.
3. Create the annotated `v<VERSION>` tag outside the workflow and push it deliberately.
4. Observe all quality, test, docs, and four native jobs. Any failure prevents assembly and publication.
5. Verify the draft/output asset inventory and downloaded checksums/attestations.

For a manual validation, dispatch `release.yml` with `publish=false`. Manual publication requires `publish=true` and an explicit existing matching tag. Existing stable releases are never overwritten automatically.

Configure a repository ruleset for `v*` tags that blocks updates and deletion. The
workflow binds every build to the gated 40-character commit SHA and rechecks the
remote tag before and after draft creation, while the server-side rule closes the
remaining tag-mutation race.

## Signing policy

Set repository variable `FMD_RELEASE_SIGNING_POLICY` to `optional` or `required`. Required policy fails before publication when credentials or verified signatures are absent. Optional unsigned artifacts remain explicitly `unsigned` in the manifest. Non-publishing manual validation never receives signing credentials and always assembles explicitly unsigned evidence.

Configure these Actions secrets by purpose; never store values in source:

| Secret | Purpose |
|---|---|
| `WINDOWS_CERTIFICATE_BASE64` | Base64-encoded Authenticode PFX |
| `WINDOWS_CERTIFICATE_PASSWORD` | PFX import password |
| `APPLE_CERTIFICATE` | Base64-encoded Developer ID certificate |
| `APPLE_CERTIFICATE_PASSWORD` | Apple certificate import password |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application identity |
| `APPLE_ID` | Notarization Apple ID |
| `APPLE_PASSWORD` | App-specific notarization password |
| `APPLE_TEAM_ID` | Apple Developer team identifier |

Optionally set the non-secret repository variable `WINDOWS_TIMESTAMP_URL` to
an absolute HTTPS RFC 3161 timestamp endpoint supplied by the certificate
provider. Windows signing always uses SHA-256; when the variable is present,
both Tauri and the portable executable signer timestamp their signatures before
the post-build Authenticode check.

Unsigned pull-request builds never import certificates. Windows signatures are checked after build. macOS code signatures are verified with `codesign`; notarization is recorded only after the notarization/stapling verification succeeds. The workflow does not add Tauri updater keys because no updater is implemented.

## Retry and failure behavior

Validation is idempotent because it creates no release. Publication refuses an existing immutable stable release and uploads all verified assets in one `gh release create --verify-tag` operation. If any platform fails, fix the commit and create a new version/tag according to the release policy; do not replace already published stable assets.

See [Artifact verification](artifact-verification.md) and [Build and packaging](build-package.md) for the exact inventory.
