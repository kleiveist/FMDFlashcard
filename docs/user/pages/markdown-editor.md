<!-- AUTO-GENERATED:backlink START -->
[← Back](pages.md)
<!-- AUTO-GENERATED:backlink END -->

# Markdown Editor

## Purpose

The Markdown Editor is used to view and edit `.md` files inside the app. It should preserve formatting and avoid rewriting content unless you explicitly edit it.

## Main areas

- **Editor pane:** Text editing and syntax highlighting.
- **Preview pane:** Rendered Markdown preview consistent with study views.
- **File actions:** Save and open actions (if supported).
- **Tree context menu:** Right-click actions in the Markdown folder tree (New File/New Folder/Open actions), with correct focus and layering.

## Known issues / troubleshooting

### Markdown tree context menu shows a black backdrop and blocks actions

**Symptom**
- Right-click actions in the Markdown folder tree sometimes trigger a black backdrop and block actions such as **New File** / **New Folder**.

**Likely cause**
- A stuck overlay or focus trap (e.g., an unclosed popover/modal layer capturing pointer events).

**What to do**
1. Click once inside the main app area (not inside the backdrop) and try the context menu again.
2. If the issue persists, close any open popovers/menus (Esc) and retry.
3. Capture a screenshot and note:
   - OS + version
   - app version
   - where you clicked (folder vs file node)
   - whether a menu/overlay was already open

### “Open folder/path” does not launch the OS system explorer

**Symptom**
- **Open path in system explorer** does not open Finder/Explorer (or the platform default file manager).

**Notes**
- Treat this as a platform integration issue (shell open path).
- Capture OS + version and the exact path type (file vs folder; local vs network path).

### “Open with default editor” does not launch the OS default editor

**Symptom**
- **Open with default editor** does not open the configured OS default application for `.md` files.

**Notes**
- Treat this as a platform integration issue (shell open file with default app).
- Capture OS + version and the file path (including whether it is inside the selected vault).

### Wallet Directory context menu is covered by other UI blocks

**Symptom**
- The Wallet Directory context menu (e.g., GPT Filter / New File / New Folder / Open Data Folder) appears behind other UI blocks and cannot be clicked reliably.

**Expected**
- Context menus must always appear in the foremost layer above all other panels.

**What to capture**
- Screenshot showing the menu being covered.
- Which panel is covering it (tree, editor, preview, etc.).
- Whether the app is in a narrow layout or split-view mode.

## Typical workflows

### Edit a card safely

1. Open the note that contains the card.
2. Edit only inside markers.
3. Save and rescan if needed.
4. Verify the card in Flashcards/Exams.

## Related docs

- `../syntax/flashcard-syntax.md`
- `../syntax/exam-syntax.md`
