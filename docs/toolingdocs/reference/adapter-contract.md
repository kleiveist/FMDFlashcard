# Adapter contract

<!-- AUTO-GENERATED:backlink START -->
[← Back](reference.md)
<!-- AUTO-GENERATED:backlink END -->

An adapter is selected by core policy or a profile feature. It may observe project
evidence, plan typed operations/conflicts, contribute verification findings, and expose
fixed live capabilities. It does not receive general authority to mutate a project.

Planning must use only safe project-relative paths, correct ownership and exact
structured-key allowlists. Product-owned paths are observational; missing components
are not scaffolding requests. A structured update preserves all unmentioned fields and
uses a captured preimage. The shared transaction, not an adapter, stages, publishes,
writes state and rolls back operations.

Live `install`, `run`, `stop`, `test` and `build` capabilities must be fixed built-in
mappings selected by the active profile. They run outside Full-Fix rollback and may
have product side effects. See [adapter capabilities](adapter-capabilities.md),
[adapter development](../development/adapter-development.md), and
[ownership, state and transactions](../architecture/ownership-state-and-transactions.md).
