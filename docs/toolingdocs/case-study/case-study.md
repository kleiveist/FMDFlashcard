<!-- AUTO-GENERATED:backlink START -->
[← Back](../toolingdocs.md)
<!-- AUTO-GENERATED:backlink END -->

# Portable tooling case study / Fallstudie zum portablen Tooling

This directory contains the audited source architecture for a newly authored German and
English case study of portable tooling. The editions have the same numbered chapters,
appendices, labels, diagrams, evidence identifiers, tables, limitations, and bibliography
keys; each is nevertheless an independently written document.

Dieser Ordner enthält die auditierte Quellarchitektur einer neu verfassten deutschen und
englischen Fallstudie zum portablen Tooling. Beide Fassungen haben dieselben nummerierten
Kapitel, Anhänge, Labels, Diagramme, Evidence-IDs, Tabellen, Einschränkungen und
Bibliografie-Keys; sie sind dennoch eigenständige Texte.

## Audit boundary / Auditgrenze

The technical contract of `kleiveist/Latex-Template` was inspected at
`76b8efe19662a378eda568eddcdd4c96a5e649de`. Its source declares no license, so no template
file, earlier chapter, diagram, bibliography entry, PDF, or Git history is vendored here.
This is a newly authored adaptation of the observed technical contract, not a claim of
byte-identical upstream compatibility. The complete audit and authoring rules are in
[Template compatibility audit](TEMPLATE-COMPATIBILITY.md) and
[case-study guidelines](CASE-STUDY-GUIDELINES.md).

Der technische Vertrag von `kleiveist/Latex-Template` wurde bei
`76b8efe19662a378eda568eddcdd4c96a5e649de` geprüft. Da der Quellbestand keine Lizenz
ausweist, werden weder Template-Dateien noch frühere Kapitel, Diagramme, Bibliografieeinträge,
PDFs oder Git-Historie übernommen. Es handelt sich um eine neu verfasste Anpassung des
beobachteten technischen Vertrags, nicht um eine Zusage byte-identischer
Upstream-Kompatibilität.

## Source layout / Quellstruktur

- `source/common/` contains the local preamble, macros, bibliography, and neutral template
  notice.
- `source/de/` and `source/en/` contain independent editions with chapters `00`–`12` and
  appendices `a`–`e`.
- `assets/diagrams/source/` contains the twelve versioned TikZ diagram sources; rendered
  images are intentionally not committed.
- `evidence/` contains claim-to-test links and the metrics schema.
- `scripts/` contains build, cleanup, static verification, and PDF render checks.

## Build and verification / Build und Verifikation

Build outputs are published only under `.tooling-state/docs/case-study/` locally. The
bootstrap keeps its Python virtual environment, TinyTeX tree, caches, and configuration
below `.tooling-state/docs/environment/`; it never invokes `sudo`, `apt`, or a global
`pip`. The TinyTeX release and archive SHA-256 as well as every Python package version are
pinned. Exact supplemental TeX package revisions are written to the environment report.

The bootstrap currently supports Linux x86_64. `build`, `verify`, and `test` create the
environment on first use, so activation is not necessary:

```sh
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py setup
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py build --language de
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py build --language en
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py build --all --clean
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py build --all --reproducible
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py verify --all
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py test
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/environment.py info --json
PYTHONDONTWRITEBYTECODE=1 python docs/toolingdocs/case-study/scripts/clean.py
```

The first setup downloads the checksum-verified TinyTeX archive; later runs reuse the
project-local environment. The `Documentation` GitHub workflow uses the same bootstrap,
rebuilds both editions twice, runs PDF integrity tests, renders every page, and publishes
the PDFs, checksums, JUnit reports, and exact runtime inventory as one CI artifact.

Der Bootstrap hält Python-`venv`, TinyTeX, Caches und Konfiguration vollständig unter
`.tooling-state`. Der erste Aufruf lädt das per SHA-256 geprüfte TinyTeX-Archiv; spätere
Aufrufe verwenden die lokale Umgebung erneut. Auch die GitHub-Action nutzt denselben
Ablauf und dokumentiert die tatsächlich installierten Versionen als CI-Evidenz.

No PDF, auxiliary file, Biber output, SyncTeX file, rendered diagram, or other TeX build
state belongs in this source tree. / PDFs, Hilfsdateien, Biber-Ausgaben, SyncTeX-Dateien,
gerenderte Diagramme und sonstiger TeX-Build-Zustand gehören nicht in diesen Quellbaum.

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Case-study guidelines](CASE-STUDY-GUIDELINES.md)
- 📝 [Template compatibility audit](TEMPLATE-COMPATIBILITY.md)

## 📁 Assets
- 🗂️ [Overview](assets/assets.md)

## 📁 Evidence
- 🗂️ [Overview](evidence/evidence.md)

## 📁 Scripts
- 🗂️ [Overview](scripts/scripts.md)

## 📁 Source
- 🗂️ [Overview](source/source.md)

## 📁 Tests
- 🗂️ [Overview](tests/tests.md)

<!-- AUTO-GENERATED:docs-index END -->
