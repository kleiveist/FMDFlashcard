# Troubleshooting

## The app shows “0 cards loaded”

- Confirm you selected the correct vault folder.
- Confirm your cards use the expected markers (see `flashcard-syntax.md`).
- Rescan / reload the vault.

## Clicking a view shows no cards

- Make sure your current filter/box selection contains cards.
- Verify that the vault was fully scanned and indexing completed.

## UI looks off after updates

- Restart the app.
- If you recently changed theme/accent settings, toggle the theme and return to your preferred mode.

## Something is inconsistent between modes (Flashcard / Fast / Spaced)

- Reproduce the issue in a minimal example file.
- Open an issue and include:
  - a small example `#card` block,
  - which mode you used,
  - expected vs. actual behavior.
