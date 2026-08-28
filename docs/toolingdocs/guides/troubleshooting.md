# Troubleshooting

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

Start with the read-only commands and keep their output:

```sh
python tools/control.py integrate --check --json
python tools/control.py tooling verify --json
python tools/control.py doctor
```

Common safe responses are:

- Profile or path mismatch: review `project-tooling.toml` against actual existing roots;
  do not create missing product directories merely to satisfy detection.
- Managed drift or payload mismatch: restore the expected payload or install one exact
  reviewed version, then use a registered migration if applicable.
- Conflict, unsafe path or malformed structured file: correct the underlying issue;
  do not bypass the failure by editing state or broadening ownership.
- Failed live action: treat its output as product-command evidence. It is separate from
  the integration transaction and may need product-specific recovery.

Argument errors conventionally return exit code 2; integration/verification failures
return a non-zero result. See [exit codes](../reference/exit-codes.md),
[rollback and recovery](../integration/rollback-and-recovery.md), and
[security boundaries](../development/security-boundaries.md).
