<!-- AUTO-GENERATED:backlink START -->
[← Back](adr.md)
<!-- AUTO-GENERATED:backlink END -->
# ADR 0001: Documentation source of truth

Date: 2026-01-06

## Status

Accepted

## Context

The project needs documentation that is:

- easy to review in pull requests,
- friendly to contributors,
- usable for both end users and developers,
- optionally publishable as a website and exportable as PDF.

## Decision

Use **Markdown** files in the repository as the single source of truth for documentation:

- Short overview in `README.md`
- Full docs in `docs/`
- Contribution guidelines in `CONTRIBUTING.md`
- Changelog in `CHANGELOG.md`

Optionally, generate a docs website (MkDocs/Docusaurus) from the same Markdown content.

## Consequences

- Documentation changes are versioned, reviewable, and diff-friendly.
- Website/PDF generation can be automated later via CI without duplicating content.
