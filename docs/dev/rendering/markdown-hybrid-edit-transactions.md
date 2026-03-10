<!-- AUTO-GENERATED:backlink START -->
[← Back](rendering.md)
<!-- AUTO-GENERATED:backlink END -->
# Markdown Hybrid Edit Transactions

## Core rule
- The hybrid editor parses and renders blocks only from committed `markdown`.
- The active textarea edits only a local draft buffer until commit.

## Do not reintroduce live parsing
- `handleTextareaChange`, inline toolbar actions, page-link picker inserts, paste handling, and math toolbox updates must not call `onChange(nextMarkdown)` while a block edit transaction is active.
- Structural block parsing belongs only to the commit path.

## Commit triggers
- `Blur` outside the editor context
- `Ctrl+Enter` / `Cmd+Enter`
- Switching to another block
- Switching markdown/code view
- Toggling hybrid edit mode off
- Save actions

## Composition / IME
- While composition is active, commit and discard requests are queued.
- The queued action is executed only after `compositionend`.

## Maintenance note
- If a future change needs to update rendered block structure while the user types, it should happen in draft-only UI state, never by reparsing committed markdown on each keystroke.
