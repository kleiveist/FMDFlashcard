<!-- AUTO-GENERATED:backlink START -->
[← Back](data-processing.md)
<!-- AUTO-GENERATED:backlink END -->
# Markdown and Frontmatter

Markdown files are the primary content database for FMDFlashcard. The app keeps notes readable and local-first, then derives structured data from file metadata, YAML frontmatter, and embedded syntax blocks.

## Markdown File Roles

| Role | How it appears in the vault | How the app treats it |
| --- | --- | --- |
| Normal note | Any `.md` file. | Rendered and edited through the Markdown editor/preview pipeline. |
| Flashcard source | Markdown containing `#card` and `#endcard` blocks. | Parsed by flashcard/exam logic into study interactions. |
| Exam source | Markdown with exam task markers and card-like interaction syntax. | Parsed by exam simulation and exam editor flows. |
| Database host | Markdown containing a `::::` database block. | Split into normal Markdown segments and rendered database view segments. |
| Structured record | Any Markdown file resolved by a database block source. | Becomes one database record with system fields plus frontmatter fields. |

## YAML Frontmatter Boundary

Frontmatter is recognized only when it appears at the beginning of a Markdown document and is enclosed by `---` markers. The parser is implemented in [`features/preview/frontmatter.ts`](../../../apps/fmd-desktop/src/features/preview/frontmatter.ts).

| Parser behavior | Implementation effect |
| --- | --- |
| Detects the first frontmatter block at file start. | Body Markdown remains separate from structured properties. |
| Preserves line endings and raw lines where needed. | Updates can avoid unnecessary rewrites. |
| Parses scalar values, string arrays, booleans, numbers, and null-like values. | Properties can be normalized into typed database fields. |
| Keeps unknown or unsupported shapes conservatively. | The app does not pretend every YAML construct is fully understood. |
| Supports update/add helpers. | Database cell edits can upsert frontmatter without replacing the whole document manually. |

## Frontmatter Property Model

| Field | Meaning |
| --- | --- |
| `key` | Original YAML property key. Case is preserved for display, but many lookup paths use case-insensitive matching. |
| `kind` | Frontmatter-level type such as `text`, `task`, `time`, `number`, `boolean`, `tags`, `link`, `cover`, `formula`, or `unknown`. |
| `value` | Parsed value: string, number, boolean, string array, formula definition, or `null`. |
| `icon` | UI classification for property panels and database controls. |

The frontmatter parser is deliberately narrower than a general-purpose YAML engine. That is a design choice: the app needs predictable editable properties, not full YAML language coverage.

## From Markdown To Database Record

| Source | Example fields | Notes |
| --- | --- | --- |
| File system metadata | absolute path, relative path, file name, folder, extension, timestamps, size. | Produced by Tauri vault scanning and file resolution. |
| Frontmatter | `tags`, `status`, `date`, `score`, `cover`, custom fields. | Parsed from the Markdown file body. |
| Configured database fields | explicit type declarations and formulas from a database block. | Merged with inferred fields in the database store. |
| Computed/formula fields | formula outputs and history-derived values. | Stored in memory for rendering, filtering, and sorting. |

Each resolved Markdown file normally becomes one `DatabaseRecord`. The body text is not automatically flattened into columns; structured columns come from frontmatter, system fields, configured fields, and computed values.

## Editable Frontmatter Updates

Database views can write back to Markdown frontmatter through [`frontmatter-update.ts`](../../../apps/fmd-desktop/src/features/preview/database/frontmatter-update.ts).

| Operation | Behavior |
| --- | --- |
| Add property | Creates frontmatter when needed and inserts a typed key/value pair. |
| Update property | Modifies the existing key when present, preserving the rest of the document. |
| Coerce draft value | Converts UI draft values by database field type before writing YAML. |
| Bulk upsert | Applies the same key/value operation across multiple resolved Markdown files. |
| Atomic text write | Uses Tauri Markdown file write commands when persisting file content. |

## Type Mapping Into Frontmatter

| Database field type | Frontmatter write kind | Typical persisted shape |
| --- | --- | --- |
| `number`, `unit` | `number` | Numeric scalar. |
| `boolean` | `boolean` | `true` or `false`. |
| `tags`, `multiselect` | `tags` | String array or list-like value. |
| `link` | `link` | Normalized wiki link style value. |
| `time` | `time` | Normalized time string. |
| `date`, `datetime` | `text` with date normalization before write. | Normalized date/datetime string. |
| Other text-like fields | `text` | String scalar. |

## Developer Guidance

| Change goal | Start here |
| --- | --- |
| Change frontmatter parsing or serialization. | [`frontmatter.ts`](../../../apps/fmd-desktop/src/features/preview/frontmatter.ts) and its tests. |
| Change how database cell edits update Markdown files. | [`frontmatter-update.ts`](../../../apps/fmd-desktop/src/features/preview/database/frontmatter-update.ts). |
| Change block segmentation around database blocks. | [`markdownBlocks.ts`](../../../apps/fmd-desktop/src/features/preview/markdownBlocks.ts) and [`databaseBlockSyntax.ts`](../../../apps/fmd-desktop/src/lib/databaseBlockSyntax.ts). |
| Change user-facing Markdown syntax rules. | Update parser code and the matching docs under `docs/usr/syntax/` or `docs/dev/rendering/`. |

