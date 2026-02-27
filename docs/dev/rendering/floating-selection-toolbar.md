# Floating Selection Toolbar (Hybrid Editor)

## Integration
- Component logic lives in `apps/fmd-desktop/src/features/preview/MarkdownHybridEditor.tsx`.
- Visual styles live in `apps/fmd-desktop/src/styles/components/preview.css` under `.markdown-hybrid-inline-toolbar*`.
- The toolbar is rendered via Portal (`createPortal`) and only activates for non-collapsed selections in the active hybrid-editor textarea block.

## Behavior hooks
- Selection tracking uses `selectionchange`, `pointerup`, and `keyup` listeners.
- Display is debounced (`INLINE_FORMATTING_TOOLBAR_DELAY_MS`) and hidden on:
  - collapsed selection
  - outside click
  - `Escape`
  - scroll/resize
  - focus leaving editor/toolbar context
- `T` clears supported inline markdown formatting in the current selection (including wrappers around the selection and wrappers inside the selected text).

## Adding new buttons
1. Add a new action id to `InlineFormattingToolbarAction`.
2. Add wrapper mapping in `INLINE_FORMATTING_WRAPPERS` (if it is a wrapper-based action).
3. Add the button in `FloatingInlineFormattingToolbar`.
4. Handle action wiring in `handleInlineFormattingToolbarAction`.
5. Optionally add a keyboard shortcut in `resolveInlineFormattingShortcutAction`.
