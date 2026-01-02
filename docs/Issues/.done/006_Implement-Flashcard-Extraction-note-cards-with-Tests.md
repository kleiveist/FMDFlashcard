# Implement Flashcard Extraction (note → cards) with Tests

## Context
Vault browsing works. Next is converting note content into a list of flashcards.

## Goal
Given a Markdown file, parse it and extract flashcards according to the chosen spec.

## Scope
- Implement parser in one place (choose Rust or TypeScript):
  - Rust is good for performance and shared backend logic.
  - TypeScript is faster to iterate but stays on the frontend.
- Provide unit tests for common and edge cases.

## Tasks
- [ ] Pick implementation location (Rust command vs TS module).
- [ ] Implement `extract_cards(markdown: string) -> Card[]`.
- [ ] Create test fixtures for:
  - [ ] single card
  - [ ] multiple cards
  - [ ] nested lists/code blocks inside answers
  - [ ] invalid card blocks (should be ignored or raise a warning)
- [ ] Expose cards in UI for a selected note (read-only list).

## Acceptance Criteria
- Parser passes tests.
- Selecting a note can show “cards found: N” and list their questions.

## Notes
Start without scheduling; extraction first.
