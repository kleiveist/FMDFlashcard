# Full-Fix

<!-- AUTO-GENERATED:backlink START -->
[← Back](integration.md)
<!-- AUTO-GENERATED:backlink END -->

Run the complete supported integration plan only after reviewing Check:

```sh
python tools/control.py integrate --full-fix
python tools/control.py integrate --full-fix --json
```

Full-Fix refuses conflicts, unsafe paths and unexplained managed drift. A no-op returns
without mutation. For a plan with changes, it performs the required preflight,
re-assesses the target, stages the fixed plan outside the live tree, verifies the
staged result, rechecks live preimages and publishes only the frozen planned outputs.
State is written last; a later publish or verification failure triggers rollback.

Full-Fix does not scaffold missing product roots, accept arbitrary commands, or run a
live install/build/test action. Fixed staged validation is bounded to the plan; explicit
adapter capabilities are separate live commands. See the detailed
[Full-Fix and actions page](full-fix-and-actions.md) and
[rollback and recovery](rollback-and-recovery.md).
