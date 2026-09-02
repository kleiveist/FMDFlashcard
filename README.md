# FMDFlashcard

FMDFlashcard is a local-first desktop application for Markdown flashcards, exams, and spaced-repetition study. It preserves Markdown files as the learning source of truth while providing a dedicated Tauri desktop experience.

## Quickstart

The root wrappers all forward to the same Python implementation:

```bash
./control doctor
./control install --dry-run
./control install
./control run --foreground
```

On PowerShell use `.\\control.ps1`; on Command Prompt use `control.cmd`. Direct invocation with `python tools/control.py` remains supported. Help works before project dependencies are installed.
The real install creates `.venv`, and the wrappers automatically select its Python for quality, documentation, and tooling commands.

Run the local gates before opening a pull request:

```bash
./control quality
./control test --suite all --report --ci
./control docs check
./control release check
```

See [Setup and bootstrap](docs/tools/setup-bootstrap.md), [Run and test](docs/tools/run-test.md), and [Build and packaging](docs/tools/build-package.md) for prerequisites and platform details.

## Release packages

Tagged releases use `v<VERSION>` and are assembled only after every native and quality gate succeeds.

| Platform | Architecture | Release assets |
|---|---|---|
| Windows | x86_64 | MSI, NSIS setup executable, portable ZIP |
| Linux | x86_64 | DEB, RPM, AppImage |
| macOS | Apple Silicon (`aarch64`) | DMG, compressed `.app` bundle |
| macOS | Intel (`x86_64`) | DMG, compressed `.app` bundle |

Each release also contains the documentation PDF, `SHA256SUMS`, `release-manifest.json`, `SBOM.spdx.json`, and GitHub build provenance where supported. Windows packages are built on Windows, Linux packages on Linux, and both macOS architectures on native macOS runners. The Linux-to-Windows cross-build is experimental and is never used as the production Windows source.

Verify downloaded assets as described in [Artifact verification](docs/tools/artifact-verification.md).

## Documentation

<!-- AUTO-GENERATED:docs-index START -->

## Project documentation

- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
- [Security Policy](SECURITY.md)
- [Architecture overview](docs/dev/architecture.md)
- [Developer ↔ Codex Workflow](docs/dev/codex-workflow.md)
- [DEV](docs/dev/dev.md)
- [Artifact Verification](docs/tools/artifact-verification.md)
- [Build and Packaging](docs/tools/build-package.md)
- [CI Architecture](docs/tools/ci-architecture.md)
- [Control Script Reference](docs/tools/control-reference.md)
- [Platform Build Troubleshooting](docs/tools/platform-troubleshooting.md)
- [Release Maintainer Guide](docs/tools/release-maintainer.md)
- [Run and Test](docs/tools/run-test.md)
- [Setup and Bootstrap](docs/tools/setup-bootstrap.md)
- [Tools](docs/tools/tools.md)
- [Getting started](docs/usr/getting-started.md)
- [Settings](docs/usr/settings.md)
- [Spaced repetition](docs/usr/spaced-repetition.md)
- [Troubleshooting](docs/usr/troubleshooting.md)
- [User Vault (Statistiken)](docs/usr/user-vault.md)
- [USER](docs/usr/usr.md)

<!-- AUTO-GENERATED:docs-index END -->

The MkDocs navigation is the hosted documentation source of truth. Release and CI internals are documented in [CI architecture](docs/tools/ci-architecture.md) and the [release maintainer guide](docs/tools/release-maintainer.md).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the development workflow and required checks. Participation is governed by the [Code of Conduct](CODE_OF_CONDUCT.md), and sensitive security reports follow the private process in [SECURITY.md](SECURITY.md).

## License status

This repository currently contains no verified license terms. The tooling therefore blocks tagged publication until the repository owner adds an appropriate license file and matching package metadata. No license has been guessed or added by the tooling work.
