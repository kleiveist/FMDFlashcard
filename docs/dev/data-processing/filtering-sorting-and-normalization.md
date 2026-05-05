<!-- AUTO-GENERATED:backlink START -->
[← Back](data-processing.md)
<!-- AUTO-GENERATED:backlink END -->
# Filtering, Sorting, and Normalization

Database blocks work by normalizing heterogeneous Markdown/frontmatter values into a common record model, then applying search, filters, sort rules, formulas, and view-specific projections.

## Record Model

`DatabaseRecord` is defined in [`database-types.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-types.ts).

| Field | Meaning |
| --- | --- |
| `fileId` | Stable runtime identifier for the file/record. |
| `filePath` | Absolute file path. |
| `relativePath` | Vault-relative path. |
| `fileName` | File basename. |
| `folder` | Vault-relative containing folder. |
| `extension` | File extension. |
| `frontmatter` | Raw parsed frontmatter key/value map. |
| `systemFields` | File-derived fields such as name/path/folder metadata. |
| `normalizedFields` | Type-normalized values used by filters, sorts, formulas, and views. |

## Attribute Origins

| Origin | Meaning | Editability |
| --- | --- | --- |
| `frontmatter` | Comes from YAML frontmatter in a Markdown file. | Often editable if the field type can be written back safely. |
| `system` | Derived from file metadata/path. | Not editable through frontmatter. |
| `computed` | Produced by runtime logic. | Usually read-only. |
| `formula` | Produced by a configured formula definition. | Definition is configurable; output is computed. |

Attribute metadata also records whether a field is sortable, filterable, aggregatable, and compatible with each view class.

## Field Type Normalization

Normalization is implemented in [`database-normalizers.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-normalizers.ts).

| Field type family | Normalized behavior |
| --- | --- |
| Text-like: `text`, `longtext`, `select`, `file`, `link`, `image`, `relation` | Stored as display/search strings unless a stronger parser applies. |
| Numeric: `number`, `unit`, `rating`, `duration` | Parsed as finite numbers when possible. |
| Percentage/progress | Parsed into numeric or structured percent/progress values. |
| Score | Strings like `7/10` can become structured score values with `value`, `max`, and `ratio`. |
| Boolean | Stored as boolean values. |
| Date/time/datetime | Normalized into comparable date/time values when parseable. |
| Tags/multiselect | Stored as string arrays. |
| Status | Parsed into status objects with code/rank/label/emoji where possible. |
| Formula | Evaluated through the formula registry and stored as computed normalized values. |

The same raw value can therefore produce different behavior depending on its inferred or configured field type.

## View Compatibility

| Compatibility flag | Meaning |
| --- | --- |
| `supportsTable` | Field can be shown in table-like property lists. |
| `supportsKanbanGrouping` | Field can be used as a kanban grouping key. |
| `supportsTimeline` | Field can drive gantt/timeline positioning. |
| `supportsPieGrouping` | Field can become a pie grouping category. |
| `supportsAggregation` | Field can be summed/averaged/count-aggregated. |

This compatibility metadata is why some properties appear in one view's controls but not another.

## Filtering

Filters are implemented in [`database-filters.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-filters.ts). A filter tree is a group with `and` or `or`, containing rules or nested groups.

| Filter element | Meaning |
| --- | --- |
| `DatabaseFilterGroup.id` | Stable UI/runtime identifier. |
| `DatabaseFilterGroup.op` | Combines child rules with `and` or `or`. |
| `DatabaseFilterRule.field` | Attribute key to inspect. |
| `DatabaseFilterRule.op` | Operator such as `contains`, `between`, `is empty`, `any of`, `is true`. |
| `value`, `valueTo` | Primary and optional range boundary values. |

## Operator Families

| Field type | Operator examples |
| --- | --- |
| Text-like | `is`, `is not`, `contains`, `does not contain`, `starts with`, `ends with`, `is empty`. |
| Numeric | `=`, `!=`, `>`, `>=`, `<`, `<=`, `between`, `is empty`. |
| Date/time/datetime | `is`, `before`, `after`, `on or before`, `on or after`, `between`. |
| Select/multiselect | `is`, `is not`, `any of`, `none of`, `is empty`. |
| Tags | `contains any`, `contains all`, `contains none`, `is empty`. |
| Boolean | `is true`, `is false`, `is empty`. |

Search is applied together with configured filters. It operates on visible/searchable field values rather than on raw Markdown body text.

## Sorting

Sorting is implemented in [`database-sorts.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-sorts.ts).

| Sort concept | Behavior |
| --- | --- |
| Empty sort list | Records fall back to natural relative-path ordering. |
| Multi-level sort | Rules are evaluated in order until a non-zero comparison is found. |
| Direction | `asc` or `desc`. |
| Null handling | `nulls: first` or `nulls: last`, defaulting toward last behavior. |
| Natural sort | Optional numeric-aware collation for text/path-like values. |
| Type-aware comparison | Numbers compare numerically; date/time compare by temporal value; text uses collators. |

## Formula And Computed Values

Formula configuration is stored as field definitions in database block config and normalized through formula helpers. The store builder evaluates formulas before filters and sorts, so formula output can participate in later processing.

| Stage | Formula behavior |
| --- | --- |
| Config parsing | Formula definitions are normalized from block YAML. |
| Store build | Formula fields are merged into the attribute registry. |
| Evaluation | Records receive computed normalized field values. |
| Filtering/sorting/views | Formula outputs behave like other normalized fields according to their field type and compatibility. |

## Processing Order

| Order | Operation | Primary module |
| --- | --- | --- |
| 1 | Build inferred attributes from records. | [`database-store.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-store.ts) |
| 2 | Merge explicit field definitions. | [`database-store.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-store.ts) |
| 3 | Normalize/evaluate field values and formulas. | [`database-normalizers.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-normalizers.ts), formula modules. |
| 4 | Resolve visible columns/properties. | [`database-store.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-store.ts) |
| 5 | Apply filter group and search query. | [`database-filters.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-filters.ts) |
| 6 | Apply sort rules. | [`database-sorts.ts`](../../../apps/fmd-desktop/src/features/preview/database/database-sorts.ts) |
| 7 | Render active view. | [`features/preview/database/views/`](../../../apps/fmd-desktop/src/features/preview/database/views) |

## Developer Guidance

| Change goal | Start here |
| --- | --- |
| Add a field type. | `database-types.ts`, `database-normalizers.ts`, filter/sort operators, UI cell renderers, and tests. |
| Change filter behavior. | `database-filters.ts` and `database-filter-panel.tsx`. |
| Change sort behavior. | `database-sorts.ts` and `database-sort-panel.tsx`. |
| Change whether a field appears in a view's controls. | Compatibility metadata in `database-normalizers.ts`. |
| Change formula behavior. | `features/preview/formula/` and formula-related database store code. |

