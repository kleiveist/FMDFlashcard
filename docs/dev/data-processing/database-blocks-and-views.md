<!-- AUTO-GENERATED:backlink START -->
[← Back](data-processing.md)
<!-- AUTO-GENERATED:backlink END -->
# Database Blocks and Views

The Markdown database feature is an embedded view system over vault files. It does not create a standalone SQL database. A database block stores source, field, view, filter, and sort configuration inside a Markdown file, then the runtime resolves Markdown files into records and renders the selected view.

## Block Syntax

Database blocks use a standalone `::::` marker for both opening and closing. Marker detection is shared in [`lib/databaseBlockSyntax.ts`](../../../frontend/src/lib/databaseBlockSyntax.ts), and config parsing lives in [`database-block-parser.ts`](../../../frontend/src/features/preview/database/database-block-parser.ts).

```markdown
::::
title: Database
source:
  type: current-folder
views:
  activeViewId: view-default
  items:
    - id: view-default
      name: Database
      view:
        type: table
      properties:
        - title
        - status
      filters:
        id: root
        op: and
        rules: []
      sort: []
options:
  editable: false
  showSearch: true
  showToolbar: true
::::
```

The parser handles a controlled YAML-like subset: mappings, sequences, scalar values, booleans, numbers, null-like values, quoted strings, and simple flow arrays. Invalid or missing pieces fall back to default config and collect parse errors.

## Database Block Config

| Config area | Purpose | Source type |
| --- | --- | --- |
| `title` | Display name fallback for legacy paths. | String. |
| `source` | Decides which Markdown files become candidate records. | `DatabaseSourceSpec`. |
| `fields` | Optional explicit field definitions and formulas. | `DatabaseFieldDefinition[]`. |
| `views` | Persisted saved views, including active view id. | `DatabaseSavedViewsConfig`. |
| `options` | UI capabilities like editability, search, toolbar. | `DatabaseBlockOptions`. |
| `view`, `columns`, `filters`, `sort`, `propertiesByView` | Compatibility mirrors of the active saved view. | Kept for legacy runtime paths. |

The persisted source of truth for user-defined database modes is `views.items`. Compatibility mirrors are still serialized because older runtime paths and migrations expect them.

## Source Resolution

Source resolution is implemented in [`database-source-resolver.ts`](../../../frontend/src/features/preview/database/database-source-resolver.ts). It starts from the vault file list and returns the Markdown files visible to one database block.

| Source type | Current behavior |
| --- | --- |
| `current-folder` | Uses Markdown files in the same folder as the Markdown document that hosts the database block. |
| `explicit-folder` | Uses Markdown files below one configured folder path. |
| `multi-folder` | Uses Markdown files below any configured folder path. |
| `multi-folder` with `includeHistory` | Combines selected vault files with profile/history records when available. |
| `history-folder` | Uses history files from context, mainly exam-run history integration. |
| `tag-query` | Parsed but query execution is not enabled yet; returns a warning. |
| `manual-query` | Parsed but query execution is not enabled yet; returns a warning. |
| `linked-files` | Reserved for a later phase. |

## View Modes

The available database view types are defined in [`database-types.ts`](../../../frontend/src/features/preview/database/database-types.ts): `table`, `kanban`, `gantt`, `pie`, and `project`.

| View mode | Interpretation | Key config |
| --- | --- | --- |
| `table` | Shows records as rows and selected properties as columns. Supports inspection and editable cells where fields are editable. | `properties`, filters, sort rules. |
| `kanban` | Groups records by a compatible text/select/tag-like field. Can hide excluded groups and optionally show cover/image data. | `groupBy`, `kanbanShowCover`, `kanbanOrderByGroup`, `kanbanExcludedValues`. |
| `gantt` | Interprets date/time/datetime attributes as timeline start/end positions. | `timelineStartField`, `timelineEndField`, `timelineMode`, `timelineBaseDate`, `ganttZoom`. |
| `pie` | Groups records and renders counts or numeric aggregations. | `pieGroupField`, `pieAggregate`, `pieAggregateField`, `pieExcludedValues`. |
| `project` | Treats records as unit/block spans in a project-style grid. | `projectStartField`, `projectUnitField`, `blockResolution`, `defaultUnits`, `projectMissingPlacement`, bar fill config. |

## Why One Record Can Be Interpreted Differently

The database store produces a shared set of normalized records. Each saved view then chooses a different projection.

| Shared record value | Table view | Kanban view | Gantt view | Pie view | Project view |
| --- | --- | --- | --- | --- | --- |
| `status: "2 Active"` | Cell text/status chip. | Group column if selected as group field. | Ignored unless configured as a timeline field and parseable. | Slice/category if selected as group field. | Optional bar fill/category metadata. |
| `date: "2026-05-05"` | Date cell. | Usually not a grouping candidate. | Timeline coordinate. | Usually not a pie grouping candidate. | Can be ignored unless mapped into project fields. |
| `units: 5` | Number cell. | Not a good grouping field. | Ignored for date timeline. | Numeric aggregate candidate. | Duration/width of a project bar. |
| `tags: ["math", "exam"]` | Chip list. | Grouping candidate. | Ignored for timeline. | Grouping candidate. | Metadata display. |

This is why "database view mode" matters: the record is stable, but the view decides which attributes are structural, decorative, editable, groupable, aggregatable, or ignored.

## Saved Views

| Saved view field | Meaning |
| --- | --- |
| `id` | Stable view identifier. |
| `name` | User-facing saved view name. |
| `view` | View type and view-specific configuration. |
| `properties` | Visible property keys for that saved view. |
| `filters` | Filter group applied by that view. |
| `sort` | Ordered sort rules applied after filtering/search. |

Switching saved views changes the active interpretation without changing the underlying Markdown files.

## Developer Guidance

| Change goal | Start here |
| --- | --- |
| Change database config parsing/serialization. | [`database-block-parser.ts`](../../../frontend/src/features/preview/database/database-block-parser.ts). |
| Change source scope behavior. | [`database-source-resolver.ts`](../../../frontend/src/features/preview/database/database-source-resolver.ts). |
| Change view UI behavior. | [`features/preview/database/views/`](../../../frontend/src/features/preview/database/views). |
| Change toolbar/panels for source, filters, sort, properties, or view selection. | [`features/preview/database/ui/`](../../../frontend/src/features/preview/database/ui). |
| Change block-level runtime orchestration. | [`database-block.tsx`](../../../frontend/src/features/preview/database/database-block.tsx). |
