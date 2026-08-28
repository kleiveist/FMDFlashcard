# Building and testing

<!-- AUTO-GENERATED:backlink START -->
[← Back](guides.md)
<!-- AUTO-GENERATED:backlink END -->

Integration validation and product work have different boundaries. First establish a
verified, no-op integration state:

```sh
python tools/control.py tooling verify
python tools/control.py integrate --check
```

Then invoke product-facing commands explicitly, selecting only what the active profile
supports:

```sh
python tools/control.py test --suite all
python tools/control.py build web
python tools/control.py tooling action frontend test
```

Tests, builds, installs and adapter actions run live project behavior and may create
dependencies, artifacts, processes or external effects. They are not rolled back by
Full-Fix. Review command help and the active profile before use, and retain output as
release evidence when appropriate. See [adapter contract](../reference/adapter-contract.md)
and the existing [tests](tests.md) and [builds](builds.md) guides.
