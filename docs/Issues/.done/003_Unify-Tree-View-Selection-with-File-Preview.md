# Unify Tree View Selection with File Preview

## Context
The tree view currently tracks selection (`treeSelection`) but does not trigger loading the file contents.
The file list does trigger preview via `handleSelectFile(file)`.

## Goal
Clicking a file in the tree should open the same preview as the file list, keeping state consistent.

## Tasks
- [ ] Extend `TreeNode` file nodes to keep a reference to `VaultFile` (or map from `fullPath`).
- [ ] Update `renderTreeNodes()` file click handler to call `handleSelectFile(...)`.
- [ ] Sync selection highlights between tree and list (`selectedFile` becomes the single source of truth).
- [ ] Optional: auto-expand parent directories on file selection.

## Acceptance Criteria
- Tree file click loads preview content.
- Only one selection state exists; both tree and list reflect it.

## Notes
Implementation is primarily in `apps/fmd-desktop/src/App.tsx`.
