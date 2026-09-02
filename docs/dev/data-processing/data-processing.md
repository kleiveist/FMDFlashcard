<!-- AUTO-GENERATED:backlink START -->
[← Back](../dev.md)
<!-- AUTO-GENERATED:backlink END -->
# Data Processing

<!-- AUTO-GENERATED:docs-index START -->

## 📄 Pages
- 📝 [Database Blocks and Views](database-blocks-and-views.md)
- 📝 [Filtering, Sorting, and Normalization](filtering-sorting-and-normalization.md)
- 📝 [Markdown and Frontmatter](markdown-and-frontmatter.md)
- 📝 [Persistence and Profile Data](persistence-and-profile-data.md)

<!-- AUTO-GENERATED:docs-index END -->

This section documents how FMDFlashcard turns local Markdown files into structured records, views, study data, and profile-scoped JSON stores. It is developer documentation for the implemented architecture, not a proposal for a new storage layer.

## Current Storage Model

| Layer | What it stores | Physical storage | Owner |
| --- | --- | --- | --- |
| Vault Markdown | User-authored notes, flashcards, exams, YAML frontmatter, embedded database blocks. | `.md` files inside the selected vault folder. | User plus Markdown editor and vault features. |
| Frontmatter properties | Per-file structured attributes such as tags, status, dates, numbers, links, formulas, and cover/image fields. | YAML frontmatter at the top of Markdown files. | Preview/frontmatter parser and database frontmatter update helpers. |
| Database blocks | Query/source/view configuration embedded inside Markdown. | `::::` fenced blocks containing a small YAML-like config subset. | Preview database block parser and renderer. |
| Runtime records | In-memory normalized rows derived from resolved Markdown files. | React/TypeScript state only. | Database store builder, filters, sorts, and view components. |
| App settings and legacy app data | Vault path, UI settings, legacy SR/fast/exam stores. | JSON files under Tauri `app_data_dir`. | Tauri commands in `src-tauri/src/lib.rs`. |
| Profile data | Profile metadata, settings, SR state, fast sessions, exam runs, exam point profiles. | JSON files plus Markdown exam-run entries under the resolved profile root. | User vault storage service. |

Important: the current app does not use SQLite, IndexedDB, or a SQL query engine for the Markdown database feature. "Database" in this codebase means an embedded, Markdown-backed view model over vault files.

## Conceptual Flow

| Step | Input | Processing | Output |
| --- | --- | --- | --- |
| 1. Vault scan | Selected vault path. | Tauri walks the folder tree and returns Markdown files, folders, and PNG assets. | `VaultFile[]`, folder list, asset list. |
| 2. File read | Absolute Markdown paths. | Tauri reads `.md` files; frontend parses Markdown and frontmatter. | Raw Markdown plus structured frontmatter properties. |
| 3. Database source resolution | Database block `source` config plus vault file list. | Source resolver chooses candidate files by current folder, explicit folders, multi-folder, history, or stubbed query modes. | Resolved files for a database block. |
| 4. Record creation | Resolved files and parsed frontmatter. | System fields and frontmatter fields are merged into `DatabaseRecord` objects. | Raw database records. |
| 5. Attribute discovery | Parsed records and configured fields. | Field metadata is inferred, merged with explicit field definitions, then normalized by type. | Attribute registry and normalized records. |
| 6. Formulas | Formula field definitions and optional history records. | Formula definitions are evaluated into computed/derived fields. | Records with computed normalized values. |
| 7. Filtering/search/sorting | Filter group, search query, sort rules. | Type-aware filters and multi-level sorts produce the visible row set. | `visibleRecords`. |
| 8. View rendering | Active saved view. | The same records are interpreted by table, kanban, gantt, pie, or project view logic. | UI-specific visualization. |

## Core Source Files

| Concern | Primary modules |
| --- | --- |
| Tauri filesystem bridge | [`src-tauri/src/lib.rs`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src-tauri/src/lib.rs) |
| Vault scanning hook | [`features/vault/useVault.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/vault/useVault.ts) |
| Markdown block segmentation | [`features/preview/markdownBlocks.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/markdownBlocks.ts) |
| Frontmatter parsing and updates | [`features/preview/frontmatter.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/frontmatter.ts), [`features/preview/database/frontmatter-update.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/database/frontmatter-update.ts) |
| Database block parser/types/store | [`database-block-parser.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/database/database-block-parser.ts), [`database-types.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/database/database-types.ts), [`database-store.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/preview/database/database-store.ts) |
| Database views | [`features/preview/database/views/`](https://github.com/kleiveist/FMDFlashcard/tree/main/apps/fmd-desktop/src/features/preview/database/views) |
| Profile/user vault storage | [`features/user-vault/storage.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/features/user-vault/storage.ts), [`lib/userVault.ts`](https://github.com/kleiveist/FMDFlashcard/blob/main/apps/fmd-desktop/src/lib/userVault.ts) |

## How To Read This Section

| Question | Page |
| --- | --- |
| How does Markdown become structured data? | [Markdown and Frontmatter](markdown-and-frontmatter.md) |
| What is a database block and what view modes exist? | [Database Blocks and Views](database-blocks-and-views.md) |
| Why can the same record behave differently in filters, sorts, and views? | [Filtering, Sorting, and Normalization](filtering-sorting-and-normalization.md) |
| Where are app settings, profile data, and study history persisted? | [Persistence and Profile Data](persistence-and-profile-data.md) |

## Related Documentation

- [Architecture overview](../architecture.md)
- [Rendering documentation](../rendering/rendering.md)
- [Profile System](../sync/profile-system.md)
- [User Vault dev notes](../sync/user-vault.md)
- [User Vault user docs](../../usr/user-vault.md)
- [Vault page user docs](../../usr/pages/vault.md)
- [Settings user docs](../../usr/settings.md)
