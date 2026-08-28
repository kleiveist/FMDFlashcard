<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

# Build product artifacts

Builds operate on the target project's configured features. They are not payload exports and
their outputs must remain outside `tools/` and `docs/toolingdocs/`.

Run the relevant [installation](install.md) and [test](tests.md) workflow first. Then choose one
build target:

| Target | Command | Requirements and output |
| --- | --- | --- |
| Web | `python tools/control.py build web` | A configured frontend, npm, and a `build` script. Packages `<configured frontend>/dist` as `.dist/web/web-build.zip`. |
| Desktop preview | `python tools/control.py build desktop --dry-run` | A Tauri-enabled profile; prints the host/toolchain-dependent plan. |
| Linux desktop | `python tools/control.py build desktop --target linux --bundles deb,rpm` | Tauri, Rust, platform prerequisites, and the requested bundle tools. Desktop evidence is collected under `.dist/desktop`. |
| Portable Windows | `python tools/control.py build desktop --target windows-portable` | The supported Tauri/Windows toolchain for the selected path. |
| Containers | `python tools/control.py build container` | A cloud-enabled profile, Docker, and configured `deployment/docker/*.Dockerfile` inputs. Compose validation is a separate container command. |

Container builds can be narrowed without changing the profile:

```sh
python tools/control.py build container --component backend
python tools/control.py build container --component frontend --no-cache
```

The accepted components are `all`, `backend`, and `frontend`.

An adapter build capability can be invoked explicitly when selected by the profile:

```sh
python tools/control.py tooling action container build
```

## Conservative behavior

The build commands require existing product manifests, scripts, sources, and toolchains. They do
not synthesize a missing frontend, backend, container deployment, or desktop application. A
profile that does not enable the requested capability fails rather than silently building a
different target.

Builds execute product scripts and external toolchains in the live project. They can write
generated files and caches and are outside `integrate --full-fix` rollback. Inspect the output,
checksums where available, and `git diff` before treating an artifact as releasable.

`.dist/` contains product build output. It is never a substitute for the deterministic
`tooling export` directory. Continue with the [release gate](releases.md).
