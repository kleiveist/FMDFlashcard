/**
 * @file apps/fmd-desktop/src/features/preview/database/database-types.ts
 *
 * Shared type system for the markdown database block (phase 1).
 */

export type DatabaseViewType = "table" | "kanban" | "gantt" | "pie" | "project";
export type DatabaseTimelineMode = "date" | "time" | "datetime";
export type DatabaseGanttZoom = "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute";
export type DatabaseProjectMissingPlacement = "show-unplaced" | "hide-unplaced";

export type DatabaseSourceType =
  | "current-folder"
  | "explicit-folder"
  | "multi-folder"
  | "tag-query"
  | "manual-query"
  | "linked-files";

export type DatabaseFieldType =
  | "text"
  | "longtext"
  | "number"
  | "unit"
  | "percent"
  | "boolean"
  | "time"
  | "date"
  | "datetime"
  | "select"
  | "multiselect"
  | "tags"
  | "link"
  | "file"
  | "image"
  | "status"
  | "rating"
  | "relation"
  | "formula"
  | "duration"
  | "progress"
  | "score";

export type DatabaseAttributeOrigin = "frontmatter" | "system" | "computed" | "formula";

export type DatabaseSortDirection = "asc" | "desc";

export type DatabaseFilterGroupOp = "and" | "or";

export type DatabaseFilterRule = {
  id: string;
  field: string;
  op: string;
  value?: unknown;
  valueTo?: unknown;
};

export type DatabaseFilterGroup = {
  id: string;
  op: DatabaseFilterGroupOp;
  rules: Array<DatabaseFilterRule | DatabaseFilterGroup>;
};

export type DatabaseSortRule = {
  id: string;
  field: string;
  dir: DatabaseSortDirection;
  nulls?: "first" | "last";
  natural?: boolean;
};

export type DatabaseViewCompatibility = {
  supportsTable: boolean;
  supportsKanbanGrouping: boolean;
  supportsTimeline: boolean;
  supportsPieGrouping: boolean;
  supportsAggregation: boolean;
};

export type DatabaseAttributeMeta = {
  key: string;
  label: string;
  type: DatabaseFieldType;
  origin: DatabaseAttributeOrigin;
  formula?: string | null;
  editable: boolean;
  sortable: boolean;
  filterable: boolean;
  aggregatable: boolean;
  viewCompatibility: DatabaseViewCompatibility;
};

export type DatabaseFieldDefinition = {
  key: string;
  label?: string;
  type: DatabaseFieldType;
  origin: DatabaseAttributeOrigin;
  formula?: string | null;
};

export type DatabaseSourceSpec = {
  type: DatabaseSourceType;
  path?: string;
  paths?: string[];
  tags?: string[];
  query?: string;
};

export type DatabaseViewSpec = {
  type: DatabaseViewType;
  groupBy?: string | null;
  timelineStartField?: string | null;
  timelineEndField?: string | null;
  timelineMode?: DatabaseTimelineMode;
  timelineBaseDate?: string | null;
  ganttZoom?: DatabaseGanttZoom;
  projectStartField?: string | null;
  projectUnitField?: string | null;
  blockResolution?: number;
  defaultUnits?: number;
  projectMissingPlacement?: DatabaseProjectMissingPlacement;
  pieGroupField?: string | null;
  pieAggregate?: "count" | "sum" | "avg";
  pieAggregateField?: string | null;
};

export type DatabaseBlockOptions = {
  editable: boolean;
  showSearch: boolean;
  showToolbar: boolean;
};

export type DatabaseBlockConfig = {
  title: string;
  source: DatabaseSourceSpec;
  view: DatabaseViewSpec;
  fields?: DatabaseFieldDefinition[];
  columns: string[];
  filters: DatabaseFilterGroup;
  sort: DatabaseSortRule[];
  options: DatabaseBlockOptions;
};

export type DatabaseScoreValue = {
  raw: string;
  value: number;
  max: number;
  ratio: number;
};

export type DatabasePercentValue = {
  raw: string;
  value: number;
};

export type DatabaseStatusValue = {
  raw: string;
  rank?: number;
  label?: string;
  emoji?: string;
};

export type DatabaseNormalizedFieldValue =
  | string
  | number
  | boolean
  | string[]
  | Date
  | DatabaseScoreValue
  | DatabasePercentValue
  | DatabaseStatusValue
  | null;

export type DatabaseRecord = {
  fileId: string;
  filePath: string;
  relativePath: string;
  fileName: string;
  folder: string;
  extension: string;
  frontmatter: Record<string, unknown>;
  systemFields: Record<string, unknown>;
  normalizedFields: Record<string, DatabaseNormalizedFieldValue>;
};

export type DatabaseStoreUiState = {
  searchQuery: string;
  loading: boolean;
  error: string | null;
  warning: string | null;
};

export type DatabaseStoreSelectionState = {
  selectedRecordIds: string[];
};

export type DatabaseStoreSnapshot = {
  rawRecords: DatabaseRecord[];
  normalizedRecords: DatabaseRecord[];
  visibleRecords: DatabaseRecord[];
  attributeRegistry: DatabaseAttributeMeta[];
  activeFilters: DatabaseFilterGroup;
  activeSorts: DatabaseSortRule[];
  visibleColumnKeys: string[];
  currentView: DatabaseViewType;
  selectionState: DatabaseStoreSelectionState;
  uiState: DatabaseStoreUiState;
};

export type DatabaseSourceResolutionResult = {
  files: Array<{ path: string; relativePath: string }>;
  warning: string | null;
};
