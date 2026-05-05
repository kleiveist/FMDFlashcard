<!-- AUTO-GENERATED:backlink START -->
[← Back](../index.md)
<!-- AUTO-GENERATED:backlink END -->
# Tools

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Build and Packaging](build-package.md)
- 📝 [Control Script Reference](control-reference.md)
- 📝 [Run and Test](run-test.md)
- 📝 [Setup and Bootstrap](setup-bootstrap.md)

## 📁 Python Tooling Code
- 🗂️ [Overview](python-code/python-code.md)
- 📝 [Python Tooling Extension Guide](python-code/extension-guide.md)
- 📝 [Python Tooling Module Reference](python-code/module-reference.md)

<!-- AUTO-GENERATED:docs-index END -->

This section is the single source of truth for repository tooling.

Scope:
- `tools/control.py` command entrypoint
- Tool runners under `tools/inst/`
- Python tooling source documentation under `docs/tools/python-code/`
- Setup/bootstrap, run/test, build/packaging, and command reference

Important:
- Run all `python3 tools/control.py ...` commands from the repository root (`/home/kleif/Projects/FMDFlashcard`).
- On Windows PowerShell, use `py -3 .\tools\control.py ...`.

## Lifecycle navigation

- [Setup and bootstrap](setup-bootstrap.md)
- [Run and test](run-test.md)
- [Build and packaging](build-package.md)
- [Control script reference](control-reference.md)
- [Python tooling code](python-code/python-code.md)

## Quick start

```bash
python3 tools/control.py --doctor
python3 tools/control.py --install
python3 tools/control.py --tauri
python3 tools/control.py --start
```

For all available flags and aliases, use:

```bash
python3 tools/control.py --help
```
