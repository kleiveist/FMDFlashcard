<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Vault

## Purpose

The Vault page manages your local Markdown vault: selecting the folder, scanning for cards and exams, maintaining the index, and browsing the folder tree.

## Main areas

- **Vault selector:** Choose or change the vault root folder.
- **Folder tree:** Browse and open Markdown files; file/folder actions (if supported).
- **Scan / index controls:** Rescan, reload, and indexing progress.
- **Filters:** Search/tags and other view filters (implementation-dependent).

## Typical workflows

### Load a vault for the first time

1. Open Vault.
2. Select the vault root folder that contains your `.md` notes.
3. Run the initial scan and wait for indexing to complete.
4. Open a file from the tree to verify parsing is correct.

### Rescan after refactors

1. After renames/moves, use reload/rescan.
2. Confirm the folder tree reflects the filesystem state.
3. Re-check card counts in the study modes.

## Notes / tips

- If “Open folder/path” does not launch the system explorer, treat it as a UI integration issue and capture OS + version.

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
- `../troubleshooting.md`
