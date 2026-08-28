# Exit codes

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

The control command follows these common conventions:

| Code | Meaning |
| --- | --- |
| `0` | Requested command completed successfully. For Check/Verify this means a verified, conflict-free no-op. |
| `1` | A check found required work or a verification failure, or the command reached a handled operational error. |
| `2` | Command-line syntax, unknown command, unsupported mode or argument validation error. |
| `130` | The top-level command was interrupted with `KeyboardInterrupt`. |

Live delegated commands can return their own non-zero result through an adapter action;
do not reduce that to an integration diagnosis. In JSON mode, inspect `action`, `status`
and the sanitized message alongside the exit code. See [CLI](cli.md) and
[report schema](report-schema.md).
