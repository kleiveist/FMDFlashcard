# Define Flashcard Format Specification (Markdown conventions)

## Context
Next step is flashcard extraction. A clear, versioned format avoids ad-hoc parsing and makes testing easier.

## Goal
Define a minimal flashcard syntax that can be embedded in Markdown notes.

## Proposal (example)
Choose one of:
1) Frontmatter blocks:
- `cards:` with `q`/`a`
2) Fenced blocks:
```text
:::card
Q: ...
A: ...
:::
```
3) Heading-based:
- `## Card` with `Q:`/`A:` sections

## Tasks
- [ ] Decide on one canonical format (support others later).
- [ ] Write a short spec doc: `docs/flashcard-format.md`.
- [ ] Include examples and edge cases (multi-line answers, code blocks).
- [ ] Define a version tag to allow future changes (e.g., `fmd: 1`).

## Acceptance Criteria
- Format is documented with at least 5 examples.
- Parser requirements are clear enough to implement without guessing.

## Notes
Keep v1 strict; add compatibility later.
