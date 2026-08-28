# FMDFlashcard project tools

This directory is the extension boundary for scripts that are specific to
FMDFlashcard. Centrally managed Template-Tooling files live in `tools/` and
must not be edited to carry product-specific behavior.

The legacy toolbox was reviewed before replacement. Its installers, platform
bootstrap helpers, runners, and package builders were general-purpose
functions now supplied by the pinned Template-Tooling release; no legacy
script required migration into this directory.

`tooling_acceptance.py` supplies the product-specific CI fixtures that the
portable payload cannot know about. It creates isolated temporary copies and
checks clean integration, an update from the exact `0.3.0` source revision,
repeatability, transactional rollback, old-path removal, and payload-manifest
integrity. Run a case with:

```bash
python3 project-tools/fmdflashcard/tooling_acceptance.py clean-integration
python3 project-tools/fmdflashcard/tooling_acceptance.py idempotency
python3 project-tools/fmdflashcard/tooling_acceptance.py rollback
python3 project-tools/fmdflashcard/tooling_acceptance.py path-regression
python3 project-tools/fmdflashcard/tooling_acceptance.py update \
  --legacy-source /path/to/template-tooling-at-ee4d4fee
```
