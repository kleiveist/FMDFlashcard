# Python Tooling Extension Guide

Add a command only when it has a real FMDFlashcard use case.

1. Add parser options and stable help in `tools/control_parser.py`.
2. Implement one focused handler in `tools/commands/` using `ProjectPaths`.
3. Register it explicitly in `tools/control_dispatch.py`.
4. Use `run_command` or `CommandRunner`; never use a shell or ignore a return code.
5. Put generated state below `.dist/`, `.reports/`, or `.tooling-state/`.
6. Add parser, dispatch, error, dry-run, and path-boundary tests.
7. Update [Control reference](../control-reference.md) and the relevant lifecycle page.

Dry-run must short-circuit before directory creation, file writes, package installation, or process start. JSON commands write only JSON to stdout. Any operation accepting a destination must reject traversal and symlink escapes; external destinations require an explicit user option.

Release changes also require matrix and workflow contract tests. Never add a fake artifact, suppress a required failure, or claim a signature/notarization state before verification.
