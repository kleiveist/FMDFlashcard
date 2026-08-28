/**
 * @file frontend/src/features/preview/database/database-types.ts
 *
 * Shared type system for the markdown database block (phase 1).
 */

import {
  type DatabaseFormulaDefinitionV1,
  type DatabaseFormulaGroupedCountEntry,
} from "../formula/database-formula-types";

export type DatabaseViewType = "table" | "kanban" | "gantt" | "pie" | "project";
export type DatabaseTimelineMode = "date" | "time" | "datetime";
export type DatabaseGanttZoom = "year" | "quarter" | "month" | "week" | "day" | "hour" | "minute";
export type DatabaseProjectMissingPlacement = "show-unplaced" | "hide-unplaced";
export type DatabaseProjectBarFillMode = "numeric" | "text-code";
export type DatabasePieColorSpectrum = "standard" | "ocean" | "sunset" | "forest" | "pastel";

export type DatabaseProjectBarFillMapping = {
  from: string;
  to: number;
};

export type DatabaseProjectBarFillConfig = {
  recordId: string;
  attributeKey: string;
  mode: DatabaseProjectBarFillMode;
  min?: number;
  max?: number;
  mappings?: DatabaseProjectBarFillMapping[];
};

export type DatabaseSourceType =
  | "current-folder"
  | "explicit-folder"
  | "multi-folder"
  | "history-folder"
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
  formulaDefinition?: DatabaseFormulaDefinitionV1 | null;
  formula?: string | null;
  legacyFormulaIncompatible?: boolean;
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
  formulaDefinition?: DatabaseFormulaDefinitionV1 | null;
  formula?: string | null;
};

export type DatabaseSourceSpec = {
  type: DatabaseSourceType;
  path?: string;
  paths?: string[];
  includeHistory?: boolean;
  tags?: string[];
  query?: string;
};

export type DatabasePropertiesByView = Partial<Record<DatabaseViewType, string[]>>;

export type DatabaseViewSpec = {
  type: DatabaseViewType;
  groupBy?: string | null;
  kanbanShowCover?: boolean;
  kanbanOrderByGroup?: Record<string, string[]>;
  kanbanExcludedValues?: string[];
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
  projectBarFillConfigs?: DatabaseProjectBarFillConfig[];
  pieGroupField?: string | null;
  pieAggregate?: "count" | "sum" | "avg";
  pieAggregateField?: string | null;
  pieExcludedValues?: string[];
  pieColorSpectrum?: DatabasePieColorSpectrum;
};

export type DatabaseBlockOptions = {
  editable: boolean;
  showSearch: boolean;
  showToolbar: boolean;
};

export type DatabaseSavedViewConfig = {
  id: string;
  name: string;
  view: DatabaseViewSpec;
  properties: string[];
  filters: DatabaseFilterGroup;
  sort: DatabaseSortRule[];
};

export type DatabaseSavedViewsConfig = {
  activeViewId: string;
  items: DatabaseSavedViewConfig[];
};

export type DatabaseBlockConfig = {
  title: string;
  source: DatabaseSourceSpec;
  /**
   * Compatibility mirror of the active saved view.
   * Persisted source of truth lives in `views`.
   */
  view: DatabaseViewSpec;
  fields?: DatabaseFieldDefinition[];
  /**
   * Compatibility mirror of the active saved view properties.
   * Persisted source of truth lives in `views`.
   */
  columns: string[];
  /**
   * Compatibility mirror retained for legacy runtime paths.
   * Persisted source of truth lives in `views`.
   */
  propertiesByView?: DatabasePropertiesByView;
  /**
   * Compatibility mirror of the active saved view filters.
   * Persisted source of truth lives in `views`.
   */
  filters: DatabaseFilterGroup;
  /**
   * Compatibility mirror of the active saved view sort rules.
   * Persisted source of truth lives in `views`.
   */
  sort: DatabaseSortRule[];
  options: DatabaseBlockOptions;
  views: DatabaseSavedViewsConfig;
};

export type DatabaseVaultAttributeSuggestion = {
  key: string;
  normalizedKey: string;
  count: number;
};

export type DatabaseVaultAttributeIndex = {
  suggestions: DatabaseVaultAttributeSuggestion[];
  byNormalizedKey: Record<string, DatabaseVaultAttributeSuggestion>;
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
  code?: string;
  rank?: number;
  label?: string;
  emoji?: string;
};

export type DatabaseNormalizedFieldValue =
  | string
  | number
  | boolean
  | string[]
  | DatabaseFormulaGroupedCountEntry[]
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
  files: Array<{
    path: string;
    relativePath: string;
    created_at?: number | null;
    last_modified?: number | null;
    size_bytes?: number | null;
  }>;
  warning: string | null;
};
