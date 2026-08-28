# Verification

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Verify an integrated target without changing it:

```sh
python tools/control.py tooling verify
python tools/control.py tooling verify --json
```

Verification performs the same bounded assessment as Check. It succeeds only when the
plan is a conflict-free no-op and no verification finding has status `FAIL`; otherwise
it reports `VERIFICATION_FAILED`. It checks the selected profile/adapters, project
configuration, state, managed digest, payload consistency/identity and managed Python
syntax.

The command does not create a report, repair a conflict or establish a new baseline.
After Full-Fix or a migration, use it together with a second
[`integrate --check`](check.md) to prove idempotence. For failure interpretation, see
[troubleshooting](../guides/troubleshooting.md).
