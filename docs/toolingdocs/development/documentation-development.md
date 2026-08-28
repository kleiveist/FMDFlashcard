# Documentation development

<!-- AUTO-GENERATED:backlink START -->
[← Back](development.md)
<!-- AUTO-GENERATED:backlink END -->

Portable documentation lives only below `docs/toolingdocs/`. Describe implemented
behavior precisely, distinguish integration transactions from live product actions, and
avoid treating a payload manifest as publisher authentication. Keep links relative so
the pages remain valid after export.

Every Markdown page except `index.md` needs exactly one generated backlink block. Each
section overview and the root index need exactly one generated index block containing
all expected direct children. Preserve the marker strings and let the documentation
indexing workflow maintain their contents; examples must not repeat marker text.

Before handoff, run:

```sh
python tools/control.py docs check --docs-dir docs
```

For the bilingual PDF case study, use the project-local build environment instead of
installing TeX or PDF utilities globally:

```sh
python docs/toolingdocs/case-study/scripts/environment.py build --all --reproducible
```

The environment is generated below `.tooling-state/docs/environment/`; the Documentation
workflow runs the same bootstrap and retains its runtime inventory with the PDF artifacts.

Then review the diff for stale names, unsupported command examples and generated
artifacts. The [documentation navigation](contribution.md) section and
[evidence index](../acceptance/evidence-index.md) provide related checks.
