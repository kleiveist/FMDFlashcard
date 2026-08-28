# System context

<!-- AUTO-GENERATED:backlink START -->
[← Back](architecture.md)
<!-- AUTO-GENERATED:backlink END -->

Portable Tooling operates inside a project that the operator already owns. The copied
payload is limited to `tools/` and `docs/toolingdocs/`; project code, data and unknown
files stay outside its write authority. `ProjectContext` resolves the target-local
configuration, resources, documentation and external state without relying on the
source repository.

The boundary has three durable inputs: project configuration in
`project-tooling.toml`, profile resources in `tools/resources/`, and existing project
evidence. The durable integration result is recorded below `.tooling-state/`; reports,
runtime data and tooling environments therefore do not travel with a replacement
payload. A payload manifest can prove that a copied payload is internally consistent,
but it is not a publisher signature.

The context is deliberately conservative: detection is read-only, missing product
roots are not scaffolded, and live product commands require an explicit request. See
[Project context and paths](project-context-and-paths.md),
[ownership, state and transactions](ownership-state-and-transactions.md), and the
[export and release boundary](export-and-release.md).
