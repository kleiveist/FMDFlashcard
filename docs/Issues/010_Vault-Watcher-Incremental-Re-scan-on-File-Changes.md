# Vault Watcher: Incremental Re-scan on File Changes

## Context
Manual rescanning is acceptable for MVP but becomes slow for large vaults.

## Goal
Add a watcher that detects changes in the selected vault and updates:
- markdown file list
- extracted cards (if needed)

## Scope
- Watch create/update/delete of `.md` files.
- Debounce bursts.
- UI shows “Updating…” status.

## Tasks
- [ ] Implement watcher in Rust backend (recommended) using a file notify crate.
- [ ] Emit events to frontend on changes.
- [ ] Update the file list incrementally (avoid full rescan if possible).
- [ ] Handle rename/move events if available.

## Acceptance Criteria
- Editing/adding/removing a markdown file updates the UI automatically within a short delay.
- No excessive CPU usage on large vaults.

## Notes
Keep it opt-in via settings if necessary.
