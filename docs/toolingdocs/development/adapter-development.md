# Adapter development

<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

Add a technology-specific adapter only behind the profile/feature catalog and the
deterministic registry. Start with read-only detection and typed planning; do not
infer ownership from a discovered file. Every operation needs a safe relative path,
an ownership class, a reason and any required preimage/structured-key policy.

Adapters may not scaffold missing applications or bypass the common transaction. Test
their plans against independent fixtures, including malformed inputs, symlink/path
rejection, foreign structured fields, conflict handling and a no-op after successful
integration. Live capabilities must be fixed dispatches rather than user-provided shell
commands and must document their side effects.

Review [adapter contract](../reference/adapter-contract.md),
[security boundaries](security-boundaries.md), and
[fixture development](fixture-development.md) before adding a write.
