# FMDFlashcard project tools

This directory is the extension boundary for scripts that are specific to
FMDFlashcard. Centrally managed Template-Tooling files live in `tools/` and
must not be edited to carry product-specific behavior.

The legacy toolbox was reviewed before replacement. Its installers, platform
bootstrap helpers, runners, and package builders were general-purpose
functions now supplied by the pinned Template-Tooling release; no legacy
script required migration into this directory.
