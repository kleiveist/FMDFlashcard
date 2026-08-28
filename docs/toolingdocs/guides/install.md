<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# Install dependencies

Installation prepares dependency environments for the features selected in
`project-tooling.toml`. It does not create missing application manifests or add missing product
dependency declarations.

## Before installing

1. Commit or stash unrelated project changes.
2. Review the detected profile and integration plan:

   ```sh
   python tools/control.py integrate --check
   ```

3. If the plan is correct, apply and verify it. With local `.git`, the resolved top-level
   must be the project root and the worktree must be clean; without local `.git`, the
   non-repository safety path applies:

   ```sh
   python tools/control.py integrate --full-fix
   python tools/control.py tooling verify
   ```

4. Inspect the local environment without changing it:

   ```sh
   python tools/control.py doctor
   ```

Resolve profile, path, manifest, runtime, and port errors before installing.

## Install the selected environments

```sh
python tools/control.py install
```

Useful bounded variants are:

```sh
python tools/control.py install --skip-playwright
python tools/control.py install --skip-frontend
python tools/control.py install --skip-backend
python tools/control.py install --skip-tooling
```

For a configured frontend, installation uses `npm ci` when a lockfile exists and otherwise uses
`npm install`. For a configured Python backend, it prefers `uv` and falls back to a conventional
virtual environment and `pip`. The backend environment is stored below the configured backend
path. The tooling test environment is stored under `.tooling-state/venv`, never under `tools/`.
Playwright Chromium is installed only when the active configuration requires it and the step is
not skipped.

The command warns about a missing `.env`, but deliberately does not create one or copy secrets.
Create environment files manually from a project-owned example and review every value.

## Adapter-specific installation

An explicitly selected adapter capability can be dispatched with:

```sh
python tools/control.py tooling action frontend install
```

The adapter must be selected by the active profile and must advertise the `install` capability.
Use `--json` when a stable machine-readable result is required.

## Safety boundary

`install` and adapter actions are live operations. Package managers may write lockfiles,
dependency directories, caches, or environment files and may contact configured registries.
They are not part of `integrate --full-fix` and do not inherit its backup or rollback guarantee.
Review the product manifests and package-manager policy first, then inspect `git diff` after the
command.

The dependency step used internally by a staged full-fix, when a planned operation actually
requires one, is validation-only in a disposable environment. It does not publish a live
`node_modules` tree and is not a replacement for this installation workflow.

Continue with [tests](tests.md) after installation.
