# Persist Review State (Start with JSON, plan SQLite migration)

## Context
Scheduling state must survive restarts. Start simple, but keep a clear migration path.

## Goal
Persist per-card review state to disk and load it on startup.

## Scope
- Phase 1: JSON file storage in app data directory.
- Phase 2: SQLite migration plan (no need to implement SQLite fully here, but define schema).

## Tasks
- [ ] Decide a stable card ID scheme (hash of file path + card index + question text).
- [ ] Implement read/write of `review_state.json` (or store plugin).
- [ ] Load state on startup and merge with extracted cards.
- [ ] Write a short SQLite schema proposal (tables, indexes).

## Acceptance Criteria
- After reviewing cards and restarting, due dates/states are preserved.
- State file is located in the OS-specific app data dir (not inside the repo).

## Notes
Avoid writing into vault files for v1.
