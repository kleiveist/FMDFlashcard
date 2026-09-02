# Artifact Verification

Download all release assets into one directory and verify checksums before opening an installer:

```bash
sha256sum --check SHA256SUMS
python tools/control.py release verify --directory .
```

On macOS use `shasum -a 256` to compare individual files if `sha256sum` is unavailable. `release verify` checks the manifest schema, exact file sizes, SHA-256 values, duplicate names, and checksum coverage. Platform tools add native checks during collection: DEB/RPM metadata, AppImage/installer signatures, ZIP/TAR safety, DMG integrity, app bundle version, executable presence, and post-signing verification.

GitHub provenance links final files to the workflow and source commit:

```bash
gh attestation verify FMDFlashcard-v1.0.0-linux-x86_64.AppImage \
  --repo kleiveist/FMDFlashcard
```

An attestation establishes origin, not freedom from vulnerabilities. Review `SBOM.spdx.json`, release notes, signature state, and notarization state as separate evidence.

Archive validation rejects absolute paths, `..` traversal, unsafe links, special files, Windows reserved names, and case-insensitive collisions. Do not extract an asset that fails verification.
