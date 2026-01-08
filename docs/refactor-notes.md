<!-- AUTO-GENERATED:backlink START -->
[← Back to Docs Home](index.md)
<!-- AUTO-GENERATED:backlink END -->
# Refactor notes

## Fast Flashcard
- Moved page logic into `apps/fmd-desktop/src/pages/fast-flashcard/hooks/useFastSession.ts`.
- Extracted UI panels into `apps/fmd-desktop/src/pages/fast-flashcard/components/` and kept `FastFlashcardPage` as composition-only.
- Kept `apps/fmd-desktop/src/pages/FastFlashcardPage.tsx` as a re-export to preserve routing/imports.

## Spaced Repetition
- Moved page logic into `apps/fmd-desktop/src/pages/spaced-repetition/hooks/useSrSessionViewModel.ts`.
- Extracted UI panels into `apps/fmd-desktop/src/pages/spaced-repetition/components/` and kept `SpacedRepetitionPage` as composition-only.
- Kept `apps/fmd-desktop/src/pages/SpacedRepetitionPage.tsx` as a re-export to preserve routing/imports.

## Stylesheets
- Split `apps/fmd-desktop/src/App.css` into layered files under `apps/fmd-desktop/src/styles/` (`tokens.css`, `base.css`, `layout.css`) plus component files in `apps/fmd-desktop/src/styles/components/`.
- Kept `apps/fmd-desktop/src/App.css` as an import-only aggregator to preserve the existing import in `apps/fmd-desktop/src/App.tsx` and the original cascade order.
