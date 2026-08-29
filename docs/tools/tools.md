<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->
# Project tooling

<!-- AUTO-GENERATED:docs-index START -->

## Pages

- [Build and packaging](build-package.md)
- [Control script reference](control-reference.md)
- [Run and test](run-test.md)
- [Setup and bootstrap](setup-bootstrap.md)

<!-- AUTO-GENERATED:docs-index END -->

FMDFlashcard uses Template-Tooling `0.4.0`, pinned by full source revision in
the [migration report](../migration/template-tooling-v2.md). The centrally
managed payload is `tools/` plus `docs/toolingdocs/`; product-specific helpers
belong in `project-tools/fmdflashcard/`.

Run commands from the repository root. On this project, use `python3` on Unix
systems or `py -3` on Windows.

## Lifecycle

1. [Set up and diagnose the environment](setup-bootstrap.md).
2. [Run and test the application](run-test.md).
3. [Build desktop artifacts](build-package.md).
4. Consult the [confirmed command map](control-reference.md).

The portable Tooling documentation is available at
[`docs/toolingdocs/README.md`](../toolingdocs/README.md). Before using an
unfamiliar command, inspect the help for the exact pinned version:

```bash
python3 tools/control.py --help
python3 tools/control.py <command> --help
```

Do not modify central payload files for FMDFlashcard-specific behavior. The
CI fixtures under `project-tools/fmdflashcard/` exercise clean integration,
updates, idempotency, rollback, old-path removal, and payload integrity.
