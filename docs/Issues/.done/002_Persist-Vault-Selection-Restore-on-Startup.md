# Persist Vault Selection & Restore on Startup

## Context
Vault selection currently lives in React state only. On restart, the user must re-select the vault.

## Goal
Persist the vault path and restore it on app startup, including refreshing the markdown file list.

## Scope
- Store vault path in a durable location (preferred: Tauri Store plugin; fallback: JSON file in app data dir).
- On startup: load stored vault path; if exists, list files automatically.

## Tasks
- [x] Choose storage method:
  - [ ] Preferred: `@tauri-apps/plugin-store`
  - [x] Fallback: write to app data directory via Rust command
- [x] Add `loadSettings()` on app init (e.g., in `App.tsx`).
- [x] Add `saveVaultPath()` when user selects a vault.
- [x] On startup with valid vault path, trigger listing flow and set UI states.
- [x] Handle missing/unavailable path gracefully (show message + clear persisted value).

## Acceptance Criteria
- Restarting the app restores the last vault and file list without user interaction.
- If the vault path is invalid, the app shows a clear message and does not crash.

## Notes
Current UI already uses folder picker (`@tauri-apps/plugin-dialog`) and invokes backend commands for listing/reading.
