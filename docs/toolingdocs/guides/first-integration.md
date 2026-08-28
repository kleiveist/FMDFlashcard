# First integration

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

From the root of a project that already contains the copied portable payload, start
with a read-only assessment:

```sh
python tools/control.py integrate --check --json
```

Review the proposed profile, paths, operations, conflicts and verification findings.
Detection does not create configuration, state or reports. If the proposal matches the
project and there are no conflicts, commit or stash unrelated work and apply the
supported plan:

```sh
python tools/control.py integrate --full-fix
python tools/control.py tooling verify
```

Finish with a second Check. A fully integrated target reports a conflict-free no-op.
Missing product roots are not created automatically; select an explicit profile or
correct paths rather than expecting scaffolding. See [Check](../integration/check.md)
and [selecting a profile](selecting-a-profile.md).
