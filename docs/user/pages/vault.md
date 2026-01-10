# Vault

## Purpose

The Vault page manages your local Markdown vault: selecting the folder, scanning for cards and exams, maintaining the index, and browsing the folder tree.

## Main areas

- **Vault selector:** Choose or change the vault root folder.
- **Active vault badge (🔄):** Refresh/rescan the currently selected vault from disk to pick up renamed/moved files and rebuild the folder tree and index.
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

1. After renames/moves, click **🔄 refresh** (or use other rescan controls, if available).
2. Confirm the folder tree reflects the filesystem state (renamed files appear under the new name; old entries disappear).
3. Re-check card/exam counts in the study modes to ensure the index is consistent.

## Notes / tips

- If “Open folder/path” does not launch the system explorer, treat it as a UI integration issue and capture OS + version.
- If the folder tree looks stale after renames/moves, use **🔄 refresh** to force a full rescan from disk (not just a soft reload of cached data).

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
- `../troubleshooting.md`
