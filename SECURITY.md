<!-- AUTO-GENERATED:backlink START -->
[← Back](README.md)
<!-- AUTO-GENERATED:backlink END -->
# Security Policy

## Supported Versions

The current `VERSION` line is supported while the project is under active development. Published packages must include checksums, an SPDX SBOM, an artifact manifest, and explicit signing/notarization state.

## Reporting a Vulnerability

If you believe you found a security issue:

1. Do not open a public issue with sensitive details.
2. Contact the maintainers via a private channel (if available) or open a minimal issue asking for a secure contact method.

Please include:

- a description of the issue,
- steps to reproduce,
- impact assessment (what an attacker could do),
- any suggested mitigation.

Thank you for reporting responsibly.

## Release integrity

Release consumers should verify `SHA256SUMS`, `release-manifest.json`, and GitHub provenance attestations before running downloaded packages. Instructions are in [Artifact verification](docs/tools/artifact-verification.md).

The repository currently has no verified license file. Tagged release publication is blocked until maintainers resolve that legal metadata requirement.

## Known Tauri hardening follow-up

The existing application still uses a null Content Security Policy, the asset protocol scope `**`, and opener permissions covering the user's home and common mount locations. This tooling change does not widen those capabilities. Narrowing them safely requires a separate product-level inventory of previewed local media, vault paths, file dialogs, and reveal/open flows, followed by platform regression testing. Until that work is complete, `release check` reports the condition visibly instead of presenting the current configuration as hardened.
