# Tools

<!-- AUTO-GENERATED:docs-index START -->

## Tooling documentation

- [Artifact Verification](artifact-verification.md)
- [Build and Packaging](build-package.md)
- [CI Architecture](ci-architecture.md)
- [Control Script Reference](control-reference.md)
- [Platform Build Troubleshooting](platform-troubleshooting.md)
- [Python Tooling Extension Guide](python-code/extension-guide.md)
- [Python Tooling Module Reference](python-code/module-reference.md)
- [Tooling Architecture](python-code/python-code.md)
- [Release Maintainer Guide](release-maintainer.md)
- [Run and Test](run-test.md)
- [Setup and Bootstrap](setup-bootstrap.md)

<!-- AUTO-GENERATED:docs-index END -->

`tools/control.py` is the canonical implementation for the FMDFlashcard lifecycle. The root POSIX, PowerShell, and CMD wrappers contain no business logic and forward every argument and exit code.

Generated output is repository-local and ignored:

| Path | Purpose |
|---|---|
| `.dist/` | web, desktop, and release assets |
| `.reports/` | test, coverage, audit, and CI evidence |
| `.tooling-state/` | tracked process identity and build markers |

Start with `./control --help`. Bare groups such as `build`, `docs`, `tauri`, `version`, and `release` print their command maps without performing work.
