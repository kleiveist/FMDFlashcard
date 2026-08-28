<!-- AUTO-GENERATED:backlink START -->
[← Back](case-study.md)
<!-- AUTO-GENERATED:backlink END -->
# Case-study working area

This directory is the sole source location for the portable-tooling case study.
The German and English editions are authored independently, share an evidence model,
and are built only into temporary output locations. Generated PDFs and LaTeX auxiliary
files are deliberately excluded from the portable payload.

The navigable overview is [case-study.md](case-study.md). The audit record and writing
rules are kept next to it so a later template refresh can be reviewed without consulting
an external checkout. Use `scripts/environment.py build --all` for an isolated local PDF
build; it places its Python virtual environment and pinned TinyTeX distribution only below
the repository's ignored `.tooling-state/` directory.
