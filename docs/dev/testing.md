<!-- AUTO-GENERATED:backlink START -->
[← Back](dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Testing

## Running tests

If the project uses a monorepo layout, tests are typically run from the app workspace.

Examples (adjust to your workspace names):

```bash
# From repo root
pnpm -C apps/fmd-desktop test
```

If you only changed logic in one file, prefer running targeted tests to shorten feedback loops.
```q
DEV  v2.1.9 /home/kleif/Projects/FMDFlashcard/apps/fmd-desktop  
  
✓ src/lib/exam.test.ts (15)  
✓ src/lib/flashcards.test.ts (40)  
✓ src/lib/seededShuffle.test.ts (3)  
✓ src/features/flashcards/logic.test.ts (5)  
✓ src/features/spaced-repetition/logic.test.ts (3)  
✓ src/pages/exam-simulation/components/ExamTaskRunner.test.ts (7)  
✓ src/pages/fast-flashcard/hooks/useFastSession.test.ts (1)  
  
Test Files  7 passed (7)  
     Tests  74 passed (74)  
  Start at  15:06:35  
  Duration  538ms (transform 548ms, setup 0ms, collect 963ms, tests 46ms, environment 1ms, prepare 1.21s)
```
## Expectations for pull requests

- Add or update tests when changing evaluation logic (e.g., composite cards, result summaries).
- Ensure lint and typechecks pass before requesting review.

## AppImage installer smoke test (Linux)

```bash
python3 tools/control.py --build-lin
python3 tools/control.py --install-appimage --dry-run
python3 tools/control.py --install-appimage
```

Quick checks:
- `~/Applications/FMDFlashcard.AppImage` exists and is executable
- `~/.local/share/applications/fmdflashcard.desktop` exists
- launcher appears in the desktop application menu

## Table rendering checklist

- Flashcard tables render as real tables; non-token tables can scroll horizontally.
- Exam tasks keep table prompts intact inside `#exam` blocks.
- `cl`, `cd`, and `cld` tokens render inside table cells without scroll wrappers.
- `---` separators do not split cards or tasks when they appear inside table blocks.
