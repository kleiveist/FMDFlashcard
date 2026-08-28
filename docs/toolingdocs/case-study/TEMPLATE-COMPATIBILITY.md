<!-- AUTO-GENERATED:backlink START -->
[← Back](case-study.md)
<!-- AUTO-GENERATED:backlink END -->

# Template compatibility audit

## Audited reference

| Item | Result |
| --- | --- |
| Template source | `https://github.com/kleiveist/Latex-Template` |
| Immutable reference | `76b8efe19662a378eda568eddcdd4c96a5e649de` |
| Reference tree | `e108ed89f1c539eeb0489cab158205b71d75e0ea` |
| Branch / tag | `main` at the commit above; no tag exists at that commit |
| Audit date | 2026-08-27 |
| License | No license declared (NOASSERTION); no copying permission is inferred |
| Audit method | Clean temporary local checkout, `git ls-tree`, source inspection, and generated-PDF metadata inspection |
| Compatibility status | Source contract audited; no upstream source is imported and a clean local build still requires the configured TeX toolchain |

The temporary checkout was used only as an audit reference. It is not part of this
repository's sources, export, or build input.

## License and file transfer decision

The audited tree contains no `LICENSE`, `COPYING`, `NOTICE`, or repository README, and no
license or copyright grant was found in its tracked TeX and BibTeX sources or retained
history. In the absence of an explicit license, no permission is inferred for copying source
or example content.

Accordingly, **no upstream file is vendored**. In particular, the following audited files are
not copied: `name.tex` (`sha256:6799389cad272976c30a4bef0f020ef5f5a6b07b2c688aa264f9140e50a1d9ea`),
`preamble.tex` (`sha256:3533838cf5850b689bc9052530b496cc714c7b05cf3fc3f90f7eba0f509c3d50`),
`references.bib` (`sha256:963f417688f001d3edfaf4098ffb94f6053c1b4fa38ba0a3c79750a7500ffb13`),
and `Latex_Template.pdf` (`sha256:0637941366fa54ea54844c83bc3c1150f9c913b4f7f65899eb27ea482928d728`).
The `source/common/template/NOTICE.txt` file records this decision. The local shared files
are newly authored adaptations; they contain neither upstream prose nor copied diagram or
bibliography entries.

## Technical contract observed in the reference

| Area | Verified finding |
| --- | --- |
| Document class | `article` with `11pt,a4paper` in `name.tex` |
| TeX engine | Current `name.tex` declares `pdflatex`; the generated PDF identifies pdfTeX 1.40.28 / TeX Live 2025. A historical log used XeTeX despite that directive, so the reference has no canonical build recipe. |
| Bibliography | `biblatex` with `style=apa`, `backend=biber`, `sorting=nyt`; `\addbibresource{references.bib}` |
| Languages | `babel[ngerman]`, `csquotes`, and `ngerman-apa` mapping |
| Fonts | TeX Gyre Heros via `tgheros`, plus T1 font encoding; no font file is bundled |
| Layout | `geometry`, `setspace`, `microtype`, `titlesec`, and `fancyhdr` |
| Tables and figures | `graphicx`, `xcolor`, TikZ with `arrows.meta`, `backgrounds`, `calc`, `fit`, `matrix`, `positioning`, and `shapes.geometric`; `booktabs`, `array`, `tabularx`, `float`, `threeparttable` |
| Links | `hyperref[hidelinks]` and `url` |
| Shell escape | No shell-escape, `\\write18`, minted, externalization, or external renderer call is present in tracked sources |
| Build script | None is tracked; the source contract requires a pdfLaTeX/Biber/pdfLaTeX/pdfLaTeX sequence |
| Generated files | The history contains former `.aux`, `.bcf`, `.bbl`, `.blg`, `.log`, `.out`, `.pdf`, `.run.xml`, and `.toc` outputs; none may be imported |
| PDF metadata | The reference PDF has volatile Creation/Modification dates and empty title/author fields; this adaptation normalizes metadata instead |
| Styles | No tracked class or style file; the document relies on the distribution packages listed above |
| TeX distribution | The generated reference PDF identifies TeX Live 2025; the source has no supported-distribution declaration or pinned environment |
| Title page | The source has document-specific title/author content, while the generated PDF metadata is empty; the local title page and metadata are newly authored |
| Expected layout | A flat root with main source, preamble, bibliography, source assets, and a generated PDF; no build configuration, CI, Makefile, or latexmk file is tracked |
| Adaptability | No transfer permission is documented, so only a newly authored technical adaptation is used |
| Example content | German full-stack-template case-study prose and examples are excluded from this repository |

## Necessary, documented deviations

The source reference is German-only and contains an old full-stack-template case study. This
case study adds an independent English edition, relocates all sources below
`docs/toolingdocs/case-study/`, separates shared configuration from content, replaces volatile
PDF metadata, prohibits shell escape, and uses new diagrams and prose about portable tooling.
It uses the audited document class, engine family, bibliography backend, package contract, and
font family without transferring upstream source text.

The reproducible command implemented here is:

```sh
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error main.tex
biber main
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error main.tex
pdflatex -no-shell-escape -interaction=nonstopmode -halt-on-error main.tex
```

The local adaptation explicitly selects pdfLaTeX and Biber with the package set above; it does
not infer that the upstream history had one canonical engine. The reference PDF identifies TeX
Live 2025, but the CI uses the pinned Ubuntu runner label and records the actually resolved
TeX/Biber/PDF-tool versions as an artifact. Its mutable package repository is therefore a known
environment-pinning limitation, not a false claim that CI always installs TeX Live 2025. The
builder rejects a missing engine or bibliography backend instead of silently selecting another
toolchain. This audit does not claim byte-identical compatibility with the upstream generated
PDF; it records the upstream contract and the local reproducibility rules.
