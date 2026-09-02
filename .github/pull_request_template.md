## Summary

Describe the user-visible or tooling outcome and why the change is needed.

## Related issue

Use `Closes #123` when the pull request resolves an issue, or explain why no issue is required.

## Screenshots

For user-interface changes, include before/after screenshots. Otherwise write `Not applicable`.

## Validation

List the exact commands and manual checks you ran, including relevant platforms.

## Checklist

- [ ] The change is focused and contains no unrelated generated or runtime data.
- [ ] Tests cover changed behavior or the reason tests are unnecessary is documented.
- [ ] `./control quality` and the relevant test suites pass.
- [ ] Documentation and release notes are updated when behavior or packaging changes.
- [ ] No credentials, private vault content, local profiles, or signing material are included.
- [ ] Native package changes include matching native-CI evidence or validated dry-run plans.
- [ ] I listed every operating system on which I tested this change.
- [ ] The Tauri identifier and security permissions remain intentional.
