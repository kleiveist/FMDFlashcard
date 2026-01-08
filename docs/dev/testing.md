<!-- AUTO-GENERATED:backlink START -->
[← Back to Docs Home](../index.md)
<!-- AUTO-GENERATED:backlink END -->
# Testing

## Running tests

If the project uses a monorepo layout, tests are typically run from the app workspace.

Examples (adjust to your workspace names):

```bash
# From repo root
pnpm -C apps/fmd-desktop test
```

If you only changed logic in one file, prefer running targeted tests to shorten feedback loops.

## Expectations for pull requests

- Add or update tests when changing evaluation logic (e.g., composite cards, result summaries).
- Ensure lint and typechecks pass before requesting review.
