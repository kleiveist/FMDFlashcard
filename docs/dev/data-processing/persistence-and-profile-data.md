<!-- AUTO-GENERATED:backlink START -->
[← Back](data-processing.md)
<!-- AUTO-GENERATED:backlink END -->
# Persistence and Profile Data

FMDFlashcard is local-first. The frontend owns most data modeling, while Tauri/Rust provides safe filesystem commands. Persistent data is stored as Markdown files and JSON files, not in SQLite.

## Persistence Layers

| Layer | Path/location | File type | Purpose |
| --- | --- | --- | --- |
| Vault content | User-selected vault folder. | `.md`, PNG assets. | Notes, flashcards, exams, database blocks, frontmatter. |
| Tauri app data | Tauri `app_data_dir`. | JSON. | App settings and legacy global study stores. |
| Profile root, auto mode | `<vault>/.profile`. | JSON plus Markdown exam-run files. | Per-profile user/study data for the active vault. |
| Profile root, custom mode | `<custom>/.profile`, unless selected path already ends in `.profile` or `profile`. | JSON plus Markdown exam-run files. | Portable or shared profile storage outside the vault. |
| Browser `localStorage` | Webview local storage. | Key/value strings. | Small UI preferences only; not the source of domain data. |

## Tauri App Data Files

The Rust backend resolves these under `app.path().app_data_dir()` in [`src-tauri/src/lib.rs`](../../../frontend/src-tauri/src/lib.rs).

| File | Command path | Current role |
| --- | --- | --- |
| `settings.json` | `load_app_settings`, `save_app_settings`, `load_vault_path`, `save_vault_path`. | App-level settings, including selected vault path and profile-root settings. |
| `spaced_repetition.json` | `load_spaced_repetition_data`, `save_spaced_repetition_data`. | Legacy/global SR store with compatibility migration into keyed storage. |
| `fast_flashcard.json` | `load_fast_flashcard_data`, `save_fast_flashcard_data`. | Legacy/global fast flashcard session store. |
| `exam_runs.json` | `load_exam_run_data`, `save_exam_run_data`. | Legacy/global exam run history. |

Profile storage is now the main target for user-scoped study data. The app-data files still matter for compatibility and migration.

## Tauri Filesystem Commands

| Command | File boundary | Purpose |
| --- | --- | --- |
| `list_vault_entries` | Vault directory. | Returns Markdown files, PNG assets, and folders, respecting hidden-folder settings. |
| `list_markdown_files` | Vault directory. | Returns Markdown file metadata only. |
| `read_text_file` | `.md` only. | Reads Markdown content. |
| `write_text_file`, `write_text_file_atomic` | `.md` only. | Writes Markdown content, with atomic-style replacement available. |
| `create_markdown_file`, `delete_markdown_file`, `move_markdown_file` | Vault-relative `.md` paths. | Manages Markdown files while preventing path escape. |
| `read_json_file`, `write_json_file`, `rename_json_file` | `.json` only. | Supports user-vault/profile storage and safe migration/backup flows. |
| `ensure_directory`, `list_directories`, `list_files`, `rename_directory` | Filesystem paths. | Supports profile roots and vault manager workflows. |
| `get_os_username`, `get_system_identity` | Environment/system data. | Provides defaults and vault identity metadata. |

The Rust side validates file extensions and path boundaries for vault-relative operations. The frontend still decides what data shape to write.

## Profile Root Resolution

Profile root resolution is implemented in [`lib/userVault.ts`](../../../frontend/src/lib/userVault.ts).

| Mode | Resolution |
| --- | --- |
| `auto` | Uses `<vault>/.profile`. Requires an active vault path. |
| `custom` | Uses the selected custom path, normalized to `<custom>/.profile` unless the selected folder already ends in `.profile` or `profile`. |
| Legacy root | `user` is still recognized for migration/compatibility. |

Profile IDs are generated from a local date stamp plus sanitized profile name, for example `2026-05-05_Default`.

## Profile Storage Layout

The current write target defaults to `users/`, while legacy reads also support `profiles/` and direct profile folders. See [Profile System](../sync/profile-system.md) for the detailed migration rules.

```text
<PROFILE_ROOT>/
  user-vault.json
  users/
    <profile-id>/
      profile.json
      spaced-repetition.json
      fast-flashcard.json
      exam-points-profiles.json
      exam-runs/
        <exam-run-entry files>
```

## Profile Files

| File | Scope | Content |
| --- | --- | --- |
| `user-vault.json` | Profile root. | Schema version and active profile id. |
| `profile.json` | One profile. | Profile metadata plus profile-scoped app settings. |
| `spaced-repetition.json` | One profile. | SR users and card state, grouped under profile/vault keys. |
| `fast-flashcard.json` | One profile. | Fast flashcard session summaries. |
| `exam-points-profiles.json` | One profile. | Exam point/scoring profile definitions. |
| `exam-runs/` | One profile. | Exam run history entries and migration-compatible run data. |

## Profile Data Ownership

| Domain | Owner module | Notes |
| --- | --- | --- |
| Profile root, active profile, migration. | [`features/user-vault/useUserVault.ts`](../../../frontend/src/features/user-vault/useUserVault.ts), [`features/user-vault/storage.ts`](../../../frontend/src/features/user-vault/storage.ts). | Bootstraps root, lists profiles, manages active profile, imports/exports. |
| Profile settings. | [`features/settings/useAppSettings.ts`](../../../frontend/src/features/settings/useAppSettings.ts). | Loads/saves app settings through profile context when available. |
| Spaced repetition state. | Spaced repetition feature plus user-vault storage. | Stores per-profile SR users and card state. |
| Fast flashcard sessions. | Fast flashcard hooks plus user-vault storage. | Stores per-profile session summaries. |
| Exam runs. | Exam simulation view model plus user-vault storage. | Stores profile-scoped exam history and status-derived metadata. |
| Exam point profiles. | Exam points feature plus user-vault storage. | Stores scoring profile definitions and migrations. |

## Vault Scan Data

Tauri returns `VaultFile` entries with:

| Field | Meaning |
| --- | --- |
| `path` | Absolute file path. |
| `relative_path` | Path relative to the vault root. |
| `created_at` | Optional creation timestamp in Unix milliseconds. |
| `last_modified` | Optional modification timestamp in Unix milliseconds. |
| `size_bytes` | Optional byte size. |

Those entries are runtime indexes. They are rebuilt by rescanning; they are not persisted as a database index file.

## Data Safety Notes

| Area | Current behavior |
| --- | --- |
| Markdown writes | Restricted to `.md`; atomic-style replacement is available for safer writes. |
| JSON writes | Restricted to `.json`; profile code can write temp files and rename for migration-sensitive stores. |
| Vault-relative file moves/deletes | Rust checks that target paths remain inside the selected vault. |
| Corrupt JSON handling | Some profile stores back up corrupt files and recreate empty stores. |
| Profile migrations | Legacy `user`/`profiles` layouts and app-data stores are read for compatibility. |

## Developer Guidance

| Change goal | Start here |
| --- | --- |
| Add a new persisted profile store. | `features/user-vault/storage.ts`, `lib/userVault.ts`, and [Profile System](../sync/profile-system.md). |
| Add a new Tauri filesystem command. | `src-tauri/src/lib.rs` command plus frontend `invoke` wrapper. |
| Change settings persistence. | `features/settings/useAppSettings.ts` and `src-tauri/src/lib.rs` settings structs. |
| Change vault scan metadata. | `src-tauri/src/lib.rs`, `features/vault/useVault.ts`, and downstream consumers. |
| Change migration behavior. | User-vault storage tests and profile-system docs. |
