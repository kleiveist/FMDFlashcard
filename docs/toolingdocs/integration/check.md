# Check

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Run a read-only assessment with:

```sh
python tools/control.py integrate --check
python tools/control.py integrate --check --json
```

The direct integration entry point disables Python bytecode writes before importing the
tooling packages. Assessment does not create `project-tooling.toml`, `.tooling-state`, a
report, a cache or a log. It performs these steps:

1. resolve the [project context](../architecture/project-context-and-paths.md);
2. scan bounded filesystem evidence for Vite, FastAPI, Tauri and Compose;
3. prefer valid persisted configuration, otherwise derive an in-memory proposal;
4. resolve the profile, features, adapters and structured-key policy;
5. validate payload self-consistency or identity as appropriate;
6. compile all managed Python sources in memory without import or bytecode output;
7. inspect configuration, state, managed drift and adapter requirements;
8. return sorted operations, conflicts and verification findings.

The plan status is `INTEGRATED` for a conflict-free no-op, `FIX_REQUIRED` when supported
operations remain, and `CONFLICT` when automatic application would be unsafe. Exit code
0 requires both a no-op plan and successful verification; otherwise the command returns
1. Argument errors return 2.

`--json` emits one stable schema-version-1 object with action, status, project and
tooling identity, detection evidence, profile, plan, verification, actions, report path
and notices. Operation payloads and replacement values are intentionally omitted; only
structured key names are exposed. Human output summarizes the same assessment.

Missing optional product paths are not repair operations. They remain informational
findings because automatic product scaffolding is outside the current trust boundary.
Ambiguous roots, unsafe symlinks, malformed structured documents, payload mismatch and
unexplained managed drift fail closed.
