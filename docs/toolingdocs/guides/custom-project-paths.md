# Custom project paths

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

`project-tooling.toml` can describe non-default project layout through `paths.frontend`,
`paths.backend`, `paths.tauri` and `paths.docs`. Each non-empty value is canonical and
project-relative: use `/` separators and do not use an absolute path, a drive prefix,
`..`, a NUL byte or a path that escapes the project root. `paths.backend = ""` means no
backend is configured; `.` is valid when a product root is the project root.

The documentation value is a parent path: the portable documentation root resolves as
`<paths.docs>/toolingdocs`. Existing configuration wins over detection, so review path
changes carefully before Full-Fix. Unsafe paths and symbolic-link redirection are
rejected rather than normalized.

For the exact field contract, see [project-tooling schema](../reference/project-tooling-schema.md)
and [Project context and paths](../architecture/project-context-and-paths.md).
