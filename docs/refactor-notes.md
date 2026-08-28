<!-- AUTO-GENERATED:backlink START -->
[← Back](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Refactor notes

## Fast Flashcard
- Moved page logic into `frontend/src/pages/fast-flashcard/hooks/useFastSession.ts`.
- Extracted UI panels into `frontend/src/pages/fast-flashcard/components/` and kept `FastFlashcardPage` as composition-only.
- Kept `frontend/src/pages/FastFlashcardPage.tsx` as a re-export to preserve routing/imports.

## Spaced Repetition
- Moved page logic into `frontend/src/pages/spaced-repetition/hooks/useSrSessionViewModel.ts`.
- Extracted UI panels into `frontend/src/pages/spaced-repetition/components/` and kept `SpacedRepetitionPage` as composition-only.
- Kept `frontend/src/pages/SpacedRepetitionPage.tsx` as a re-export to preserve routing/imports.

## Stylesheets
- Split `frontend/src/App.css` into layered files under `frontend/src/styles/` (`tokens.css`, `base.css`, `layout.css`) plus component files in `frontend/src/styles/components/`.
- Kept `frontend/src/App.css` as an import-only aggregator to preserve the existing import in `frontend/src/App.tsx` and the original cascade order.
