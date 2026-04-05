/**
 * @file apps/fmd-desktop/src/features/preview/database/database-block.tsx
 *
 * Main database block renderer for markdown hybrid editor.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  type CSSProperties,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { parseFrontmatterDocument } from "../frontmatter";
import {
  createDefaultDatabaseBlockConfig,
  parseDatabaseBlockConfigFromRaw,
  serializeDatabaseBlockConfig,
} from "./database-block-parser";
import {
  buildVaultAttributeIndexFromMarkdownDocuments,
  createEmptyVaultAttributeIndex,
} from "./database-attribute-discovery";
import {
  buildNormalizedRecord,
  createSystemFieldsForRecord,
} from "./database-normalizers";
import {
  coerceTimelineZoom,
  formatTimelineValueFromTimestamp,
  getTimelineDefaultZoom,
  normalizeTimelineBaseDate,
} from "./database-time";
import { toggleDatabaseSortRuleByField } from "./database-sort-rules";
import {
  resolveDatabaseSourceFiles,
  type DatabaseSourceResolverContext,
} from "./database-source-resolver";
import { buildDatabaseStoreSnapshot } from "./database-store";
import {
  type DatabaseAttributeMeta,
  type DatabaseFieldDefinition,
  type DatabaseFieldType,
  type DatabaseFilterGroup,
  type DatabaseGanttZoom,
  type DatabaseNormalizedFieldValue,
  type DatabasePropertiesByView,
  type DatabaseProjectMissingPlacement,
  type DatabaseRecord,
  type DatabaseSourceSpec,
  type DatabaseSortRule,
  type DatabaseTimelineMode,
  type DatabaseVaultAttributeIndex,
  type DatabaseViewSpec,
  type DatabaseViewType,
} from "./database-types";
import {
  bulkUpsertDatabaseAttribute,
  coerceDatabaseRecordFieldValue,
  upsertDatabaseRecordField,
} from "./frontmatter-update";
import { compareNaturalPath } from "../../../lib/naturalSort";
import { DatabaseFilterPanel } from "./ui/database-filter-panel";
import { DatabaseGanttPanel } from "./ui/database-gantt-panel";
import { DatabaseProjectPanel } from "./ui/database-project-panel";
import { DatabasePiePanel } from "./ui/database-pie-panel";
import { DatabasePropertiesPanel } from "./ui/database-properties-panel";
import { DatabaseSourcePanel } from "./ui/database-source-panel";
import { DatabaseSortPanel } from "./ui/database-sort-panel";
import { DatabaseToolbar } from "./ui/database-toolbar";
import { DatabaseGanttView } from "./views/gantt-view";
import { DatabaseKanbanView } from "./views/kanban-view";
import { DatabasePieView } from "./views/pie-view";
import { DatabaseProjectView } from "./views/project-view";
import { DatabaseTableView } from "./views/table-view";

type DatabaseBlockProps = {
  raw: string;
  vaultFiles?: Array<{ path: string; relative_path: string }>;
  sourceRelativePath?: string | null;
  onNavigateWikilink?: (wikilink: string) => void;
  onCommitRaw: (nextRaw: string) => void;
  allowCellEditing?: boolean;
};

type DatabaseBlockOpenPanels = {
  source: boolean;
  properties: boolean;
  filter: boolean;
  sort: boolean;
  gantt: boolean;
  project: boolean;
  pie: boolean;
};

type DatabasePanelKey = keyof DatabaseBlockOpenPanels;

type DatabaseCellEditState = {
  recordId: string;
  fieldKey: string;
  draftValue: string | boolean;
};

const getFolderLabel = (source: ReturnType<typeof parseDatabaseBlockConfigFromRaw>["config"]["source"]) => {
  if (source.type === "current-folder") {
    return "Quelle: aktueller Ordner";
  }
  if (source.type === "explicit-folder") {
    return `Quelle: ${source.path || "(Ordner)"}`;
  }
  if (source.type === "multi-folder") {
    return `Quelle: ${source.paths?.join(", ") || "(mehrere Ordner)"}`;
  }
  if (source.type === "tag-query") {
    return "Quelle: tag-query (Phase-1 Stub)";
  }
  if (source.type === "manual-query") {
    return "Quelle: manual-query (Phase-1 Stub)";
  }
  return "Quelle: linked-files (vorbereitet)";
};

const toWikilinkTarget = (relativePath: string) =>
  relativePath.replace(/\.md$/i, "");

const toLower = (value: string) => value.trim().toLowerCase();
const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const cloneFilterGroup = (group: DatabaseFilterGroup): DatabaseFilterGroup => ({
  ...group,
  rules: group.rules.map((entry) =>
    "rules" in entry
      ? cloneFilterGroup(entry)
      : { ...entry }),
});

const cloneSortRules = (rules: DatabaseSortRule[]) => rules.map((rule) => ({ ...rule }));

const cloneSourceSpec = (source: DatabaseSourceSpec): DatabaseSourceSpec => ({
  ...source,
  ...(source.paths ? { paths: [...source.paths] } : {}),
  ...(source.tags ? { tags: [...source.tags] } : {}),
});

const cloneFieldDefinitions = (fields: DatabaseFieldDefinition[]) =>
  fields.map((field) => ({ ...field }));

const ensureFieldDefinition = (
  fields: DatabaseFieldDefinition[],
  field: DatabaseFieldDefinition,
) => {
  const existingIndex = fields.findIndex((entry) => toLower(entry.key) === toLower(field.key));
  if (existingIndex >= 0) {
    const nextFields = [...fields];
    nextFields[existingIndex] = field;
    return nextFields;
  }
  return [...fields, field];
};

const appendVisibleColumnIfMissing = (columns: string[], key: string) =>
  columns.some((entry) => toLower(entry) === toLower(key))
    ? columns
    : [...columns, key];

const DATABASE_VIEW_TYPES: DatabaseViewType[] = ["table", "kanban", "gantt", "project", "pie"];

const dedupeCaseInsensitive = (keys: string[]) => {
  const seen = new Set<string>();
  const next: string[] = [];
  keys.forEach((key) => {
    const trimmed = key.trim();
    const normalized = toLower(trimmed);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push(trimmed);
  });
  return next;
};

const createDefaultPropertiesByView = (tableColumns: string[]): DatabasePropertiesByView => ({
  table: dedupeCaseInsensitive(tableColumns),
  kanban: [],
  gantt: [],
  project: [],
  pie: [],
});

const normalizePropertiesByView = (
  propertiesByView: DatabasePropertiesByView | null | undefined,
  tableColumns: string[],
): DatabasePropertiesByView => {
  const defaults = createDefaultPropertiesByView(tableColumns);
  const source = propertiesByView ?? {};
  const next: DatabasePropertiesByView = { ...defaults };
  DATABASE_VIEW_TYPES.forEach((view) => {
    if (!Array.isArray(source[view])) {
      return;
    }
    next[view] = dedupeCaseInsensitive(source[view] ?? []);
  });
  next.table = dedupeCaseInsensitive(next.table ?? tableColumns);
  return next;
};

const getPropertiesForView = (
  propertiesByView: DatabasePropertiesByView | null | undefined,
  view: DatabaseViewType,
): string[] => dedupeCaseInsensitive(propertiesByView?.[view] ?? []);

const buildCellMutationKey = (recordId: string, fieldKey: string) =>
  `${recordId}::${toLower(fieldKey)}`;

const getRecordValueByField = (record: DatabaseRecord, field: string): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

const getOpenPanelKey = (panels: DatabaseBlockOpenPanels): DatabasePanelKey | null => {
  if (panels.source) {
    return "source";
  }
  if (panels.properties) {
    return "properties";
  }
  if (panels.filter) {
    return "filter";
  }
  if (panels.sort) {
    return "sort";
  }
  if (panels.gantt) {
    return "gantt";
  }
  if (panels.project) {
    return "project";
  }
  if (panels.pie) {
    return "pie";
  }
  return null;
};

const formatDateAsKey = (value: Date) => {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const formatTimeAsKey = (value: Date) =>
  `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;

const normalizeFilterValueSuggestions = (
  value: DatabaseNormalizedFieldValue,
  type: DatabaseFieldType,
): string[] => {
  if (value === null || typeof value === "undefined") {
    return [];
  }
  if (value instanceof Date) {
    if (type === "date") {
      return [formatDateAsKey(value)];
    }
    if (type === "time") {
      return [formatTimeAsKey(value)];
    }
    return [value.toISOString()];
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean);
  }
  if (typeof value === "object") {
    const objectValue = value as {
      value?: unknown;
      raw?: unknown;
      ratio?: unknown;
    };
    if (typeof objectValue.value === "number" && Number.isFinite(objectValue.value)) {
      return [String(objectValue.value)];
    }
    if (typeof objectValue.raw !== "undefined") {
      const raw = String(objectValue.raw ?? "").trim();
      return raw ? [raw] : [];
    }
    if (typeof objectValue.ratio === "number" && Number.isFinite(objectValue.ratio)) {
      return [String(objectValue.ratio)];
    }
    return [];
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? [String(value)] : [];
  }
  if (typeof value === "boolean") {
    return [value ? "true" : "false"];
  }
  const text = String(value).trim();
  return text ? [text] : [];
};

const resolveCellDraftValue = (
  attribute: DatabaseAttributeMeta,
  value: DatabaseNormalizedFieldValue,
): string | boolean => {
  if (attribute.type === "boolean") {
    return typeof value === "boolean" ? value : false;
  }
  if (attribute.type === "percent") {
    if (value && typeof value === "object" && "value" in value) {
      const numeric = Number(value.value ?? Number.NaN);
      return Number.isFinite(numeric) ? String(numeric) : "";
    }
  }
  if (attribute.type === "date") {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    }
  }
  if (attribute.type === "datetime") {
    if (value instanceof Date) {
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, "0");
      const day = String(value.getDate()).padStart(2, "0");
      const hours = String(value.getHours()).padStart(2, "0");
      const minutes = String(value.getMinutes()).padStart(2, "0");
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    }
  }
  if (attribute.type === "time") {
    if (typeof value === "string") {
      return value;
    }
    if (value instanceof Date) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    }
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(", ");
  }
  if (value && typeof value === "object" && "raw" in value) {
    return String(value.raw ?? "");
  }
  return "";
};

const upsertFrontmatterFieldCaseInsensitive = (
  frontmatter: Record<string, unknown>,
  key: string,
  value: unknown,
) => {
  const existingKey = Object.keys(frontmatter)
    .find((entry) => toLower(entry) === toLower(key));
  if (existingKey) {
    return {
      ...frontmatter,
      [existingKey]: value,
    };
  }
  return {
    ...frontmatter,
    [key]: value,
  };
};

const getFlatFilterRules = (group: DatabaseFilterGroup): Array<{ groupId: string; ruleId: string; field: string; op: string; value?: unknown; valueTo?: unknown }> => {
  const entries: Array<{ groupId: string; ruleId: string; field: string; op: string; value?: unknown; valueTo?: unknown }> = [];
  group.rules.forEach((entry) => {
    if ("rules" in entry) {
      entries.push(...getFlatFilterRules(entry));
      return;
    }
    entries.push({
      groupId: group.id,
      ruleId: entry.id,
      field: entry.field,
      op: entry.op,
      value: entry.value,
      valueTo: entry.valueTo,
    });
  });
  return entries;
};

const removeFilterRuleById = (group: DatabaseFilterGroup, ruleId: string): DatabaseFilterGroup => ({
  ...group,
  rules: group.rules
    .map((entry) =>
      "rules" in entry
        ? removeFilterRuleById(entry, ruleId)
        : entry)
    .filter((entry) => ("rules" in entry ? true : entry.id !== ruleId)),
});

const pickKanbanGroupAttribute = (
  attributes: DatabaseAttributeMeta[],
  preferredKey: string | null | undefined,
) => {
  if (preferredKey) {
    const preferred = attributes.find((attribute) => toLower(attribute.key) === toLower(preferredKey)) ?? null;
    if (preferred && preferred.viewCompatibility.supportsKanbanGrouping) {
      return preferred;
    }
  }
  return attributes.find((attribute) => attribute.viewCompatibility.supportsKanbanGrouping) ?? null;
};

const pickTimelineAttribute = (
  attributes: DatabaseAttributeMeta[],
  preferredKey: string | null | undefined,
) => {
  if (preferredKey) {
    const preferred = attributes.find((attribute) => toLower(attribute.key) === toLower(preferredKey)) ?? null;
    if (preferred && preferred.viewCompatibility.supportsTimeline) {
      return preferred;
    }
  }
  return attributes.find((attribute) => attribute.viewCompatibility.supportsTimeline) ?? null;
};

const pickPieGroupAttribute = (
  attributes: DatabaseAttributeMeta[],
  preferredKey: string | null | undefined,
) => {
  if (preferredKey) {
    const preferred = attributes.find((attribute) => toLower(attribute.key) === toLower(preferredKey)) ?? null;
    if (preferred && preferred.viewCompatibility.supportsPieGrouping) {
      return preferred;
    }
  }
  return attributes.find((attribute) => attribute.viewCompatibility.supportsPieGrouping) ?? null;
};

type DatabaseViewBehavior = {
  filterSubject: string;
  sortSubject: string;
};

const VIEW_BEHAVIOR_BY_TYPE: Record<DatabaseViewType, DatabaseViewBehavior> = {
  table: {
    filterSubject: "Tabellenzeilen",
    sortSubject: "Tabellenzeilen",
  },
  kanban: {
    filterSubject: "Kanban-Karten",
    sortSubject: "Karten innerhalb der Spalten",
  },
  gantt: {
    filterSubject: "Timeline-Eintraege links und Balkenzeilen rechts",
    sortSubject: "Timeline-Reihenfolge links und rechts",
  },
  project: {
    filterSubject: "Project-Eintraege links und Blockzeilen rechts",
    sortSubject: "Project-Reihenfolge links und rechts",
  },
  pie: {
    filterSubject: "Pie-Datenbasis",
    sortSubject: "Segmente und Legende",
  },
};

const defaultPanels: DatabaseBlockOpenPanels = {
  source: false,
  properties: false,
  filter: false,
  sort: false,
  gantt: false,
  project: false,
  pie: false,
};

const TITLE_COMMIT_DEBOUNCE_MS = 280;
const DEFAULT_TIMELINE_MODE: DatabaseTimelineMode = "date";
const DEFAULT_PROJECT_START_FIELD = "unitsstart";
const DEFAULT_PROJECT_UNIT_FIELD = "units";
const DEFAULT_PROJECT_BLOCK_RESOLUTION = 100;
const DEFAULT_PROJECT_DEFAULT_UNITS = 1;
const DEFAULT_PROJECT_MISSING_PLACEMENT: DatabaseProjectMissingPlacement = "show-unplaced";
const pad2 = (value: number) => String(value).padStart(2, "0");
const resolveTodayBaseDate = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};
const resolveTimelineBaseDateForMode = (
  mode: DatabaseTimelineMode,
  baseDate: string | null | undefined,
) => {
  const normalized = normalizeTimelineBaseDate(baseDate ?? null);
  if (mode === "time") {
    return normalized ?? resolveTodayBaseDate();
  }
  return normalized;
};

const asPositiveInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 1) {
      return value;
    }
    return null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 1) {
      return parsed;
    }
  }
  return null;
};

const asNonNegativeInteger = (value: unknown): number | null => {
  if (typeof value === "number") {
    if (Number.isInteger(value) && value >= 0) {
      return value;
    }
    return null;
  }
  if (typeof value === "string") {
    const parsed = Number(value.trim());
    if (Number.isInteger(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return null;
};

const isProjectNumericType = (type: DatabaseFieldType) =>
  type === "number" ||
  type === "unit" ||
  type === "percent" ||
  type === "score" ||
  type === "rating" ||
  type === "progress";

const pickProjectNumericAttribute = (
  attributes: DatabaseAttributeMeta[],
  preferredKey: string | null | undefined,
) => {
  if (!preferredKey) {
    return null;
  }
  const preferred = attributes.find((attribute) => toLower(attribute.key) === toLower(preferredKey)) ?? null;
  if (preferred && isProjectNumericType(preferred.type)) {
    return preferred;
  }
  return null;
};

export const MarkdownHybridDatabaseBlock = ({
  raw,
  vaultFiles,
  sourceRelativePath,
  onNavigateWikilink,
  onCommitRaw,
  allowCellEditing = true,
}: DatabaseBlockProps) => {
  const parsed = useMemo(() => parseDatabaseBlockConfigFromRaw(raw), [raw]);
  const defaultConfig = useMemo(() => createDefaultDatabaseBlockConfig(), []);
  const rootRef = useRef<HTMLElement | null>(null);
  const panelLayerRef = useRef<HTMLDivElement | null>(null);
  const panelTriggerRefs = useRef<Record<DatabasePanelKey, HTMLButtonElement | null>>({
    source: null,
    properties: null,
    filter: null,
    sort: null,
    gantt: null,
    project: null,
    pie: null,
  });
  const fileCacheRef = useRef<Map<string, string>>(new Map());
  const titlePersistTimeoutRef = useRef<number | null>(null);

  const [title, setTitle] = useState(parsed.config.title);
  const [source, setSource] = useState<DatabaseSourceSpec>(cloneSourceSpec(parsed.config.source));
  const [fieldDefinitions, setFieldDefinitions] = useState<DatabaseFieldDefinition[]>(
    cloneFieldDefinitions(parsed.config.fields ?? []),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<DatabaseViewType>(parsed.config.view.type);
  const [kanbanGroupBy, setKanbanGroupBy] = useState<string | null>(parsed.config.view.groupBy ?? null);
  const [kanbanShowCover, setKanbanShowCover] = useState<boolean>(parsed.config.view.kanbanShowCover ?? false);
  const [timelineStartField, setTimelineStartField] = useState<string | null>(
    parsed.config.view.timelineStartField ?? null,
  );
  const [timelineEndField, setTimelineEndField] = useState<string | null>(
    parsed.config.view.timelineEndField ?? null,
  );
  const [timelineMode, setTimelineMode] = useState<DatabaseTimelineMode>(
    parsed.config.view.timelineMode ?? DEFAULT_TIMELINE_MODE,
  );
  const initialTimelineMode = parsed.config.view.timelineMode ?? DEFAULT_TIMELINE_MODE;
  const [timelineBaseDate, setTimelineBaseDate] = useState<string | null>(
    resolveTimelineBaseDateForMode(
      initialTimelineMode,
      parsed.config.view.timelineBaseDate ?? null,
    ),
  );
  const [ganttZoom, setGanttZoom] = useState<DatabaseGanttZoom>(
    coerceTimelineZoom(
      parsed.config.view.timelineMode ?? DEFAULT_TIMELINE_MODE,
      parsed.config.view.ganttZoom ?? getTimelineDefaultZoom(parsed.config.view.timelineMode ?? DEFAULT_TIMELINE_MODE),
    ),
  );
  const [projectStartField, setProjectStartField] = useState<string | null>(
    parsed.config.view.projectStartField ?? DEFAULT_PROJECT_START_FIELD,
  );
  const [projectUnitField, setProjectUnitField] = useState<string | null>(
    parsed.config.view.projectUnitField ?? DEFAULT_PROJECT_UNIT_FIELD,
  );
  const [projectBlockResolution, setProjectBlockResolution] = useState<number>(
    asPositiveInteger(parsed.config.view.blockResolution) ?? DEFAULT_PROJECT_BLOCK_RESOLUTION,
  );
  const [projectDefaultUnits, setProjectDefaultUnits] = useState<number>(
    asPositiveInteger(parsed.config.view.defaultUnits) ?? DEFAULT_PROJECT_DEFAULT_UNITS,
  );
  const [projectMissingPlacement, setProjectMissingPlacement] = useState<DatabaseProjectMissingPlacement>(
    parsed.config.view.projectMissingPlacement ?? DEFAULT_PROJECT_MISSING_PLACEMENT,
  );
  const [pieGroupField, setPieGroupField] = useState<string | null>(
    parsed.config.view.pieGroupField ?? null,
  );
  const [pieAggregate, setPieAggregate] = useState<"count" | "sum" | "avg">(
    parsed.config.view.pieAggregate ?? "count",
  );
  const [pieAggregateField, setPieAggregateField] = useState<string | null>(
    parsed.config.view.pieAggregateField ?? null,
  );
  const [propertiesByView, setPropertiesByView] = useState<DatabasePropertiesByView>(
    normalizePropertiesByView(parsed.config.propertiesByView, parsed.config.columns),
  );
  const [activeFilters, setActiveFilters] = useState<DatabaseFilterGroup>(cloneFilterGroup(parsed.config.filters));
  const [activeSorts, setActiveSorts] = useState<DatabaseSortRule[]>(cloneSortRules(parsed.config.sort));
  const [activeCellEdit, setActiveCellEdit] = useState<DatabaseCellEditState | null>(null);
  const [pendingCellMutations, setPendingCellMutations] = useState<string[]>([]);
  const [pendingRecordMutations, setPendingRecordMutations] = useState<string[]>([]);
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationState, setOperationState] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isMutatingFrontmatter, setIsMutatingFrontmatter] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [vaultAttributeRefreshToken, setVaultAttributeRefreshToken] = useState(0);
  const [vaultAttributeIndex, setVaultAttributeIndex] = useState<DatabaseVaultAttributeIndex>(
    createEmptyVaultAttributeIndex(),
  );
  const [panels, setPanels] = useState<DatabaseBlockOpenPanels>(defaultPanels);
  const [panelLayerStyle, setPanelLayerStyle] = useState<CSSProperties | undefined>(undefined);
  const [isCompactPanelLayer, setIsCompactPanelLayer] = useState(false);
  const rollbackRecordSnapshotRef = useRef<Map<string, DatabaseRecord>>(new Map());
  const titleRef = useRef(title);
  const sourceRef = useRef(source);
  const fieldDefinitionsRef = useRef(fieldDefinitions);
  const viewTypeRef = useRef(viewType);
  const kanbanGroupByRef = useRef<string | null>(kanbanGroupBy);
  const kanbanShowCoverRef = useRef<boolean>(kanbanShowCover);
  const timelineStartFieldRef = useRef<string | null>(timelineStartField);
  const timelineEndFieldRef = useRef<string | null>(timelineEndField);
  const timelineModeRef = useRef<DatabaseTimelineMode>(timelineMode);
  const timelineBaseDateRef = useRef<string | null>(timelineBaseDate);
  const ganttZoomRef = useRef<DatabaseGanttZoom>(ganttZoom);
  const projectStartFieldRef = useRef<string | null>(projectStartField);
  const projectUnitFieldRef = useRef<string | null>(projectUnitField);
  const projectBlockResolutionRef = useRef<number>(projectBlockResolution);
  const projectDefaultUnitsRef = useRef<number>(projectDefaultUnits);
  const projectMissingPlacementRef = useRef<DatabaseProjectMissingPlacement>(projectMissingPlacement);
  const pieGroupFieldRef = useRef<string | null>(pieGroupField);
  const pieAggregateRef = useRef<"count" | "sum" | "avg">(pieAggregate);
  const pieAggregateFieldRef = useRef<string | null>(pieAggregateField);
  const propertiesByViewRef = useRef(propertiesByView);
  const activeFiltersRef = useRef(activeFilters);
  const activeSortsRef = useRef(activeSorts);
  const openPanelKey = getOpenPanelKey(panels);

  const scheduleVaultAttributeRefresh = useCallback(() => {
    setVaultAttributeRefreshToken((value) => value + 1);
  }, []);

  const setSourceTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.source = node;
  }, []);

  const setPropertiesTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.properties = node;
  }, []);

  const setFilterTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.filter = node;
  }, []);

  const setSortTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.sort = node;
  }, []);

  const setGanttTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.gantt = node;
  }, []);

  const setProjectTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.project = node;
  }, []);

  const setPieTriggerRef = useCallback((node: HTMLButtonElement | null) => {
    panelTriggerRefs.current.pie = node;
  }, []);

  useEffect(() => {
    if (titlePersistTimeoutRef.current !== null) {
      window.clearTimeout(titlePersistTimeoutRef.current);
      titlePersistTimeoutRef.current = null;
    }
    setTitle(parsed.config.title);
    setSource(cloneSourceSpec(parsed.config.source));
    setFieldDefinitions(cloneFieldDefinitions(parsed.config.fields ?? []));
    setViewType(parsed.config.view.type);
    setKanbanGroupBy(parsed.config.view.groupBy ?? null);
    setKanbanShowCover(parsed.config.view.kanbanShowCover ?? false);
    setTimelineStartField(parsed.config.view.timelineStartField ?? null);
    setTimelineEndField(parsed.config.view.timelineEndField ?? null);
    const nextTimelineMode = parsed.config.view.timelineMode ?? DEFAULT_TIMELINE_MODE;
    const nextTimelineBaseDate = resolveTimelineBaseDateForMode(
      nextTimelineMode,
      parsed.config.view.timelineBaseDate ?? null,
    );
    setTimelineMode(nextTimelineMode);
    setTimelineBaseDate(nextTimelineBaseDate);
    setGanttZoom(
      coerceTimelineZoom(
        nextTimelineMode,
        parsed.config.view.ganttZoom ?? getTimelineDefaultZoom(nextTimelineMode),
      ),
    );
    setProjectStartField(parsed.config.view.projectStartField ?? DEFAULT_PROJECT_START_FIELD);
    setProjectUnitField(parsed.config.view.projectUnitField ?? DEFAULT_PROJECT_UNIT_FIELD);
    setProjectBlockResolution(
      asPositiveInteger(parsed.config.view.blockResolution) ?? DEFAULT_PROJECT_BLOCK_RESOLUTION,
    );
    setProjectDefaultUnits(
      asPositiveInteger(parsed.config.view.defaultUnits) ?? DEFAULT_PROJECT_DEFAULT_UNITS,
    );
    setProjectMissingPlacement(parsed.config.view.projectMissingPlacement ?? DEFAULT_PROJECT_MISSING_PLACEMENT);
    setPieGroupField(parsed.config.view.pieGroupField ?? null);
    setPieAggregate(parsed.config.view.pieAggregate ?? "count");
    setPieAggregateField(parsed.config.view.pieAggregateField ?? null);
    setPropertiesByView(
      normalizePropertiesByView(parsed.config.propertiesByView, parsed.config.columns),
    );
    setActiveFilters(cloneFilterGroup(parsed.config.filters));
    setActiveSorts(cloneSortRules(parsed.config.sort));
    setActiveCellEdit(null);
    setPendingCellMutations([]);
    setPendingRecordMutations([]);
    rollbackRecordSnapshotRef.current.clear();
  }, [parsed.config]);

  useEffect(() => {
    titleRef.current = title;
    sourceRef.current = source;
    fieldDefinitionsRef.current = fieldDefinitions;
    viewTypeRef.current = viewType;
    kanbanGroupByRef.current = kanbanGroupBy;
    kanbanShowCoverRef.current = kanbanShowCover;
    timelineStartFieldRef.current = timelineStartField;
    timelineEndFieldRef.current = timelineEndField;
    timelineModeRef.current = timelineMode;
    timelineBaseDateRef.current = timelineBaseDate;
    ganttZoomRef.current = ganttZoom;
    projectStartFieldRef.current = projectStartField;
    projectUnitFieldRef.current = projectUnitField;
    projectBlockResolutionRef.current = projectBlockResolution;
    projectDefaultUnitsRef.current = projectDefaultUnits;
    projectMissingPlacementRef.current = projectMissingPlacement;
    pieGroupFieldRef.current = pieGroupField;
    pieAggregateRef.current = pieAggregate;
    pieAggregateFieldRef.current = pieAggregateField;
    propertiesByViewRef.current = propertiesByView;
    activeFiltersRef.current = activeFilters;
    activeSortsRef.current = activeSorts;
  }, [
    activeFilters,
    activeSorts,
    fieldDefinitions,
    ganttZoom,
    kanbanGroupBy,
    kanbanShowCover,
    pieAggregate,
    pieAggregateField,
    pieGroupField,
    source,
    timelineEndField,
    timelineBaseDate,
    timelineMode,
    timelineStartField,
    projectBlockResolution,
    projectDefaultUnits,
    projectMissingPlacement,
    projectStartField,
    projectUnitField,
    propertiesByView,
    title,
    viewType,
  ]);

  useEffect(
    () => () => {
      if (titlePersistTimeoutRef.current !== null) {
        window.clearTimeout(titlePersistTimeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      setPanels(defaultPanels);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    const handlePointerDownOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const composedPath = typeof event.composedPath === "function"
        ? event.composedPath()
        : [];
      const clickedInsidePanelLayer = Boolean(
        panelLayerRef.current &&
        (panelLayerRef.current.contains(target) || composedPath.includes(panelLayerRef.current)),
      );
      const clickedPanelTrigger = Object.values(panelTriggerRefs.current)
        .some((trigger) => Boolean(
          trigger &&
          (trigger.contains(target) || composedPath.includes(trigger)),
        ));

      if (!clickedInsidePanelLayer && !clickedPanelTrigger) {
        setPanels(defaultPanels);
      }
    };
    window.addEventListener("pointerdown", handlePointerDownOutside);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDownOutside);
    };
  }, []);

  const sourceContext = useMemo<DatabaseSourceResolverContext>(
    () => ({
      vaultFiles,
      sourceRelativePath,
    }),
    [sourceRelativePath, vaultFiles],
  );

  const sourceResolution = useMemo(
    () => resolveDatabaseSourceFiles(source, sourceContext),
    [source, sourceContext],
  );

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const loadedRecords = await Promise.all(
          sourceResolution.files.map(async (file) => {
            const frontmatterMap: Record<string, unknown> = {};
            try {
              const cached = fileCacheRef.current.get(file.path);
              let markdownSource = cached ?? "";
              if (!cached) {
                markdownSource = await invoke<string>("read_text_file", { path: file.path });
                fileCacheRef.current.set(file.path, markdownSource);
              }

              const frontmatter = parseFrontmatterDocument(markdownSource);
              frontmatter.properties.forEach((property) => {
                frontmatterMap[property.key] = property.value;
              });
            } catch {
              // Keep the record visible even if one file cannot be parsed/read.
            }

            const systemFields = createSystemFieldsForRecord(file.relativePath, file.path);
            return buildNormalizedRecord({
              fileId: file.relativePath,
              filePath: file.path,
              relativePath: file.relativePath,
              frontmatter: frontmatterMap,
              systemFields,
            });
          }),
        );

        if (cancelled) {
          return;
        }
        setRecords(loadedRecords);
      } catch (error) {
        if (cancelled) {
          return;
        }
        const message = error instanceof Error
          ? error.message
          : "Failed to load database records.";
        setLoadError(message);
        setRecords([]);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadToken, sourceResolution.files]);

  useEffect(() => {
    let cancelled = false;

    const buildVaultAttributeIndex = async () => {
      const candidateFiles = (vaultFiles?.length ?? 0) > 0
        ? (vaultFiles ?? []).map((file) => ({
          path: file.path,
          relativePath: file.relative_path,
        }))
        : sourceResolution.files.map((file) => ({
          path: file.path,
          relativePath: file.relativePath,
        }));

      const availableFiles = candidateFiles
        .filter((file) => {
          const filePath = file.path ?? "";
          const relativePath = file.relativePath ?? "";
          return /\.md$/i.test(filePath) || /\.md$/i.test(relativePath);
        });

      if (availableFiles.length === 0) {
        if (!cancelled) {
          setVaultAttributeIndex(createEmptyVaultAttributeIndex());
        }
        return;
      }

      const availablePaths = new Set(availableFiles.map((file) => file.path));
      for (const cachedPath of Array.from(fileCacheRef.current.keys())) {
        if (!availablePaths.has(cachedPath)) {
          fileCacheRef.current.delete(cachedPath);
        }
      }

      const markdownDocuments = await Promise.all(
        availableFiles.map(async (file) => {
          const cached = fileCacheRef.current.get(file.path);
          if (typeof cached === "string") {
            return cached;
          }
          try {
            const markdown = await invoke<string>("read_text_file", { path: file.path });
            fileCacheRef.current.set(file.path, markdown);
            return markdown;
          } catch {
            return "";
          }
        }),
      );

      if (cancelled) {
        return;
      }
      setVaultAttributeIndex(buildVaultAttributeIndexFromMarkdownDocuments(markdownDocuments));
    };

    void buildVaultAttributeIndex();

    return () => {
      cancelled = true;
    };
  }, [sourceResolution.files, vaultAttributeRefreshToken, vaultFiles]);

  useEffect(() => {
    if (!openPanelKey) {
      setPanelLayerStyle(undefined);
      return;
    }

    let frameHandle = 0;
    let observer: ResizeObserver | null = null;

    const updateLayerPosition = () => {
      const compact = window.innerWidth <= 860;
      setIsCompactPanelLayer(compact);
      if (compact) {
        setPanelLayerStyle(undefined);
        return;
      }

      const trigger = panelTriggerRefs.current[openPanelKey];
      if (!trigger) {
        setPanelLayerStyle(undefined);
        return;
      }

      const triggerRect = trigger.getBoundingClientRect();
      const viewportPadding = 12;
      const renderedPanel = panelLayerRef.current?.querySelector<HTMLElement>(".database-block-panel");
      const measuredWidth = renderedPanel ? renderedPanel.getBoundingClientRect().width : Number.NaN;
      const estimatedPanelWidth = Number.isFinite(measuredWidth) && measuredWidth > 0
        ? measuredWidth
        : Math.min(620, Math.max(280, window.innerWidth - 96));
      const minLeft = viewportPadding;
      const maxLeft = Math.max(viewportPadding, window.innerWidth - estimatedPanelWidth - viewportPadding);
      const nextLeft = clamp(triggerRect.left, minLeft, maxLeft);
      const nextTop = Math.max(viewportPadding, triggerRect.bottom + 8);

      setPanelLayerStyle({
        left: `${Math.round(nextLeft)}px`,
        top: `${Math.round(nextTop)}px`,
      });
    };

    updateLayerPosition();
    frameHandle = window.requestAnimationFrame(updateLayerPosition);
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(() => {
        updateLayerPosition();
      });
      const activeTrigger = panelTriggerRefs.current[openPanelKey];
      if (activeTrigger) {
        observer.observe(activeTrigger);
      }
      if (rootRef.current) {
        observer.observe(rootRef.current);
      }
      if (document.body) {
        observer.observe(document.body);
      }
    }
    window.addEventListener("resize", updateLayerPosition);
    window.addEventListener("scroll", updateLayerPosition, true);
    return () => {
      if (frameHandle) {
        window.cancelAnimationFrame(frameHandle);
      }
      observer?.disconnect();
      window.removeEventListener("resize", updateLayerPosition);
      window.removeEventListener("scroll", updateLayerPosition, true);
    };
  }, [openPanelKey]);

  const visibleColumnKeys = useMemo(
    () => getPropertiesForView(propertiesByView, viewType),
    [propertiesByView, viewType],
  );

  const persistConfig = useCallback((next: {
    title?: string;
    source?: DatabaseSourceSpec;
    fields?: DatabaseFieldDefinition[];
    viewType?: DatabaseViewType;
    view?: Partial<DatabaseViewSpec>;
    visibleColumns?: string[];
    propertiesByView?: DatabasePropertiesByView;
    filters?: DatabaseFilterGroup;
    sorts?: DatabaseSortRule[];
  }) => {
    const nextTitle = next.title ?? titleRef.current;
    const nextSource = cloneSourceSpec(next.source ?? sourceRef.current);
    const nextFields = cloneFieldDefinitions(next.fields ?? fieldDefinitionsRef.current);
    const nextViewType = next.viewType ?? viewTypeRef.current;
    const nextView: DatabaseViewSpec = {
      ...parsed.config.view,
      type: nextViewType,
      groupBy: next.view?.groupBy ?? kanbanGroupByRef.current ?? null,
      kanbanShowCover: next.view?.kanbanShowCover ?? kanbanShowCoverRef.current ?? false,
      timelineStartField: next.view?.timelineStartField ?? timelineStartFieldRef.current ?? null,
      timelineEndField: next.view?.timelineEndField ?? timelineEndFieldRef.current ?? null,
      timelineMode: next.view?.timelineMode ?? timelineModeRef.current ?? DEFAULT_TIMELINE_MODE,
      timelineBaseDate: next.view?.timelineBaseDate ?? timelineBaseDateRef.current ?? null,
      ganttZoom: next.view?.ganttZoom ?? ganttZoomRef.current ?? getTimelineDefaultZoom(
        next.view?.timelineMode ?? timelineModeRef.current ?? DEFAULT_TIMELINE_MODE,
      ),
      projectStartField: next.view?.projectStartField ?? projectStartFieldRef.current ?? DEFAULT_PROJECT_START_FIELD,
      projectUnitField: next.view?.projectUnitField ?? projectUnitFieldRef.current ?? DEFAULT_PROJECT_UNIT_FIELD,
      blockResolution: next.view?.blockResolution ??
        projectBlockResolutionRef.current ??
        DEFAULT_PROJECT_BLOCK_RESOLUTION,
      defaultUnits: next.view?.defaultUnits ??
        projectDefaultUnitsRef.current ??
        DEFAULT_PROJECT_DEFAULT_UNITS,
      projectMissingPlacement: next.view?.projectMissingPlacement ??
        projectMissingPlacementRef.current ??
        DEFAULT_PROJECT_MISSING_PLACEMENT,
      pieGroupField: next.view?.pieGroupField ?? pieGroupFieldRef.current ?? null,
      pieAggregate: next.view?.pieAggregate ?? pieAggregateRef.current ?? "count",
      pieAggregateField: next.view?.pieAggregateField ?? pieAggregateFieldRef.current ?? null,
    };
    let nextPropertiesByView = normalizePropertiesByView(
      next.propertiesByView ?? propertiesByViewRef.current,
      parsed.config.columns,
    );
    if (next.visibleColumns) {
      const targetView = next.viewType ?? next.view?.type ?? viewTypeRef.current;
      nextPropertiesByView = {
        ...nextPropertiesByView,
        [targetView]: dedupeCaseInsensitive(next.visibleColumns),
      };
    }
    const tableColumns = dedupeCaseInsensitive(nextPropertiesByView.table ?? parsed.config.columns);
    nextPropertiesByView = {
      ...nextPropertiesByView,
      table: tableColumns,
    };
    const nextFilters = next.filters ?? activeFiltersRef.current;
    const nextSorts = next.sorts ?? activeSortsRef.current;

    const nextConfig = {
      ...parsed.config,
      title: nextTitle,
      source: nextSource,
      fields: nextFields,
      view: nextView,
      columns: tableColumns,
      propertiesByView: nextPropertiesByView,
      filters: cloneFilterGroup(nextFilters),
      sort: cloneSortRules(nextSorts),
    };
    onCommitRaw(serializeDatabaseBlockConfig(nextConfig));
  }, [onCommitRaw, parsed.config]);

  const store = useMemo(
    () => buildDatabaseStoreSnapshot({
      records,
      config: {
        ...parsed.config,
        title,
        source,
        fields: fieldDefinitions,
        view: {
          ...parsed.config.view,
          type: viewType,
          groupBy: kanbanGroupBy,
          kanbanShowCover,
          timelineStartField,
          timelineEndField,
          timelineMode,
          timelineBaseDate,
          ganttZoom,
          projectStartField,
          projectUnitField,
          blockResolution: projectBlockResolution,
          defaultUnits: projectDefaultUnits,
          projectMissingPlacement,
          pieGroupField,
          pieAggregate,
          pieAggregateField,
        },
        columns: getPropertiesForView(propertiesByView, "table"),
        propertiesByView,
        filters: activeFilters,
        sort: activeSorts,
      },
      searchQuery,
      activeFilters,
      activeSorts,
      visibleColumnKeys,
      loading,
      warning: sourceResolution.warning,
      error: loadError,
    }),
    [
      activeFilters,
      activeSorts,
      fieldDefinitions,
      loadError,
      loading,
      parsed.config,
      records,
      searchQuery,
      source,
      sourceResolution.warning,
      title,
      kanbanGroupBy,
      kanbanShowCover,
      viewType,
      timelineStartField,
      timelineEndField,
      timelineMode,
      timelineBaseDate,
      ganttZoom,
      projectStartField,
      projectUnitField,
      projectBlockResolution,
      projectDefaultUnits,
      projectMissingPlacement,
      pieGroupField,
      pieAggregate,
      pieAggregateField,
      propertiesByView,
      visibleColumnKeys,
    ],
  );

  const visibleColumns = useMemo(
    () => store.visibleColumnKeys
      .map((key) => store.attributeRegistry.find((attribute) => attribute.key === key) ?? null)
      .filter((attribute): attribute is DatabaseAttributeMeta => Boolean(attribute)),
    [store.attributeRegistry, store.visibleColumnKeys],
  );
  const tableCellEditingEnabled = allowCellEditing;

  const setPanel = (panel: keyof DatabaseBlockOpenPanels) => {
    setPanels((previous) => {
      if (previous[panel]) {
        return defaultPanels;
      }
      return {
        source: panel === "source",
        properties: panel === "properties",
        filter: panel === "filter",
        sort: panel === "sort",
        gantt: panel === "gantt",
        project: panel === "project",
        pie: panel === "pie",
      };
    });
  };

  const openRecord = (record: DatabaseRecord) => {
    const target = toWikilinkTarget(record.relativePath);
    onNavigateWikilink?.(`[[${target}]]`);
  };

  const commitTitle = useCallback((nextTitle: string) => {
    const normalizedTitle = nextTitle.trim() || "Database";
    if (normalizedTitle === parsed.config.title) {
      return;
    }
    persistConfig({ title: normalizedTitle });
  }, [parsed.config.title, persistConfig]);

  const handleTitleChange = (nextTitle: string) => {
    setTitle(nextTitle);
    if (titlePersistTimeoutRef.current !== null) {
      window.clearTimeout(titlePersistTimeoutRef.current);
    }
    titlePersistTimeoutRef.current = window.setTimeout(() => {
      commitTitle(nextTitle);
      titlePersistTimeoutRef.current = null;
    }, TITLE_COMMIT_DEBOUNCE_MS);
  };

  const handleTitleBlur = (nextTitle: string) => {
    if (titlePersistTimeoutRef.current !== null) {
      window.clearTimeout(titlePersistTimeoutRef.current);
      titlePersistTimeoutRef.current = null;
    }
    const normalizedTitle = nextTitle.trim() || "Database";
    setTitle(normalizedTitle);
    commitTitle(normalizedTitle);
  };

  const handleSourceChange = (nextSource: DatabaseSourceSpec) => {
    const cloned = cloneSourceSpec(nextSource);
    setSource(cloned);
    persistConfig({ source: cloned });
  };

  const handleViewChange = (nextType: DatabaseViewType) => {
    setViewType(nextType);
    persistConfig({ viewType: nextType });
  };

  const handleKanbanGroupByChange = (nextGroupBy: string | null) => {
    setKanbanGroupBy(nextGroupBy);
    persistConfig({
      view: {
        groupBy: nextGroupBy,
      },
    });
  };

  const handleKanbanShowCoverChange = (nextShowCover: boolean) => {
    setKanbanShowCover(nextShowCover);
    persistConfig({
      view: {
        kanbanShowCover: nextShowCover,
      },
    });
  };

  const handleGanttOptionsChange = (next: {
    startField?: string | null;
    endField?: string | null;
    mode?: DatabaseTimelineMode;
    baseDate?: string | null;
    zoom?: DatabaseGanttZoom;
  }) => {
    const nextStart = typeof next.startField === "undefined"
      ? timelineStartFieldRef.current
      : next.startField ?? null;
    const nextEnd = typeof next.endField === "undefined"
      ? timelineEndFieldRef.current
      : next.endField ?? null;
    const nextMode = next.mode ?? timelineModeRef.current ?? DEFAULT_TIMELINE_MODE;
    let nextBaseDate = typeof next.baseDate === "undefined"
      ? timelineBaseDateRef.current ?? null
      : normalizeTimelineBaseDate(next.baseDate ?? null);
    nextBaseDate = resolveTimelineBaseDateForMode(nextMode, nextBaseDate);
    const nextZoom = coerceTimelineZoom(nextMode, next.zoom ?? ganttZoomRef.current);

    setTimelineStartField(nextStart);
    setTimelineEndField(nextEnd);
    setTimelineMode(nextMode);
    setTimelineBaseDate(nextBaseDate);
    setGanttZoom(nextZoom);
    persistConfig({
      view: {
        timelineStartField: nextStart,
        timelineEndField: nextEnd,
        timelineMode: nextMode,
        timelineBaseDate: nextBaseDate,
        ganttZoom: nextZoom,
      },
    });
  };

  const handleProjectOptionsChange = (next: {
    startField?: string | null;
    unitField?: string | null;
    blockResolution?: number;
    defaultUnits?: number;
    missingPlacement?: DatabaseProjectMissingPlacement;
  }) => {
    const nextStart = typeof next.startField === "undefined"
      ? projectStartFieldRef.current ?? DEFAULT_PROJECT_START_FIELD
      : next.startField ?? DEFAULT_PROJECT_START_FIELD;
    const nextUnit = typeof next.unitField === "undefined"
      ? projectUnitFieldRef.current ?? DEFAULT_PROJECT_UNIT_FIELD
      : next.unitField ?? DEFAULT_PROJECT_UNIT_FIELD;
    const previousResolution = projectBlockResolutionRef.current ?? DEFAULT_PROJECT_BLOCK_RESOLUTION;
    const nextResolution = asPositiveInteger(next.blockResolution) ??
      previousResolution;
    const nextDefaultUnitCount = asPositiveInteger(next.defaultUnits) ??
      projectDefaultUnitsRef.current ??
      DEFAULT_PROJECT_DEFAULT_UNITS;
    const nextMissingPlacement = next.missingPlacement ??
      projectMissingPlacementRef.current ??
      DEFAULT_PROJECT_MISSING_PLACEMENT;

    setProjectStartField(nextStart);
    projectStartFieldRef.current = nextStart;
    setProjectUnitField(nextUnit);
    projectUnitFieldRef.current = nextUnit;
    setProjectBlockResolution(nextResolution);
    projectBlockResolutionRef.current = nextResolution;
    setProjectDefaultUnits(nextDefaultUnitCount);
    projectDefaultUnitsRef.current = nextDefaultUnitCount;
    setProjectMissingPlacement(nextMissingPlacement);
    projectMissingPlacementRef.current = nextMissingPlacement;

    persistConfig({
      view: {
        projectStartField: nextStart,
        projectUnitField: nextUnit,
        blockResolution: nextResolution,
        defaultUnits: nextDefaultUnitCount,
        projectMissingPlacement: nextMissingPlacement,
      },
    });

    if (nextResolution !== previousResolution) {
      void remapProjectPlacementsForResolution({
        fromResolution: previousResolution,
        toResolution: nextResolution,
        startKey: nextStart,
        unitKey: nextUnit,
      });
    }
  };

  const handlePieOptionsChange = (next: {
    groupField?: string | null;
    aggregate?: "count" | "sum" | "avg";
    aggregateField?: string | null;
  }) => {
    const nextGroup = typeof next.groupField === "undefined"
      ? pieGroupFieldRef.current
      : next.groupField ?? null;
    const nextAggregate = next.aggregate ?? pieAggregateRef.current ?? "count";
    const nextAggregateField = nextAggregate === "count"
      ? null
      : typeof next.aggregateField === "undefined"
      ? pieAggregateFieldRef.current
      : next.aggregateField ?? null;

    setPieGroupField(nextGroup);
    setPieAggregate(nextAggregate);
    setPieAggregateField(nextAggregateField);
    persistConfig({
      view: {
        pieGroupField: nextGroup,
        pieAggregate: nextAggregate,
        pieAggregateField: nextAggregateField,
      },
    });
  };

  const addPendingCellMutation = (mutationKey: string) => {
    setPendingCellMutations((previous) =>
      previous.includes(mutationKey) ? previous : [...previous, mutationKey]);
  };

  const removePendingCellMutation = (mutationKey: string) => {
    setPendingCellMutations((previous) => previous.filter((entry) => entry !== mutationKey));
  };

  const addPendingRecordMutation = (recordId: string) => {
    setPendingRecordMutations((previous) =>
      previous.includes(recordId) ? previous : [...previous, recordId]);
  };

  const removePendingRecordMutation = (recordId: string) => {
    setPendingRecordMutations((previous) => previous.filter((entry) => entry !== recordId));
  };

  const applyOptimisticRecordFieldValue = (
    record: DatabaseRecord,
    fieldKey: string,
    value: unknown,
  ): DatabaseRecord => {
    const nextFrontmatter = upsertFrontmatterFieldCaseInsensitive(record.frontmatter, fieldKey, value);
    return buildNormalizedRecord({
      fileId: record.fileId,
      filePath: record.filePath,
      relativePath: record.relativePath,
      frontmatter: nextFrontmatter,
      systemFields: record.systemFields,
    });
  };

  const remapProjectPlacementsForResolution = useCallback(
    async ({
      fromResolution,
      toResolution,
      startKey,
      unitKey,
    }: {
      fromResolution: number;
      toResolution: number;
      startKey: string;
      unitKey: string;
    }) => {
      if (!allowCellEditing) {
        return;
      }

      const previousResolution = Math.max(1, Math.round(fromResolution));
      const nextResolution = Math.max(1, Math.round(toResolution));
      if (previousResolution === nextResolution) {
        return;
      }

      const toRemap = records
        .map((record) => {
          const startRaw = getRecordValueByField(record, startKey);
          const unitsRaw = getRecordValueByField(record, unitKey);
          const start = asNonNegativeInteger(startRaw);
          const units = asPositiveInteger(unitsRaw);
          if (start === null || units === null) {
            return null;
          }

          const oldStart = clamp(start, 0, Math.max(0, previousResolution - 1));
          const oldUnits = clamp(units, 1, Math.max(1, previousResolution - oldStart));
          const mappedStart = clamp(
            Math.round((oldStart * nextResolution) / previousResolution),
            0,
            Math.max(0, nextResolution - 1),
          );
          const mappedEnd = clamp(
            Math.round(((oldStart + oldUnits) * nextResolution) / previousResolution),
            mappedStart + 1,
            nextResolution,
          );
          const mappedUnits = Math.max(1, mappedEnd - mappedStart);
          if (mappedStart === oldStart && mappedUnits === oldUnits) {
            return null;
          }

          return {
            record,
            previousStart: oldStart,
            previousUnits: oldUnits,
            nextStart: mappedStart,
            nextUnits: mappedUnits,
          };
        })
        .filter(
          (
            entry,
          ): entry is {
            record: DatabaseRecord;
            previousStart: number;
            previousUnits: number;
            nextStart: number;
            nextUnits: number;
          } => Boolean(entry),
        );

      if (toRemap.length === 0) {
        return;
      }

      const rollbackByRecordId = new Map<string, DatabaseRecord>();
      toRemap.forEach((entry) => {
        rollbackByRecordId.set(entry.record.fileId, entry.record);
      });

      setRecords((previous) =>
        previous.map((record) => {
          const remapped = toRemap.find((entry) => entry.record.fileId === record.fileId);
          if (!remapped) {
            return record;
          }
          return applyOptimisticRecordFieldValue(
            applyOptimisticRecordFieldValue(record, startKey, remapped.nextStart),
            unitKey,
            remapped.nextUnits,
          );
        }));
      toRemap.forEach((entry) => {
        addPendingRecordMutation(entry.record.fileId);
      });
      setOperationError(null);

      let failed = 0;

      for (const remapped of toRemap) {
        try {
          const startResult = await upsertDatabaseRecordField({
            path: remapped.record.filePath,
            relativePath: remapped.record.relativePath,
            key: startKey,
            type: "number",
            value: remapped.nextStart,
          });
          if (startResult.error) {
            throw new Error(startResult.error);
          }

          const unitsResult = await upsertDatabaseRecordField({
            path: remapped.record.filePath,
            relativePath: remapped.record.relativePath,
            key: unitKey,
            type: "unit",
            value: remapped.nextUnits,
          });
          if (unitsResult.error) {
            throw new Error(unitsResult.error);
          }

          fileCacheRef.current.set(remapped.record.filePath, unitsResult.markdown);
        } catch {
          failed += 1;
          const rollback = rollbackByRecordId.get(remapped.record.fileId);
          if (rollback) {
            setRecords((previous) =>
              previous.map((record) =>
                record.fileId === rollback.fileId
                  ? rollback
                  : record));
          }
        } finally {
          removePendingRecordMutation(remapped.record.fileId);
        }
      }

      if (failed > 0) {
        setOperationState(null);
        setOperationError(`${failed} Placement(s) konnten nicht auf die neue Aufloesung gemappt werden.`);
      } else {
        setOperationError(null);
        setOperationState("Project Raster neu skaliert.");
      }
      scheduleVaultAttributeRefresh();
    },
    [allowCellEditing, records, scheduleVaultAttributeRefresh],
  );

  const commitRecordFieldMutation = useCallback(
    async ({
      record,
      attribute,
      draftValue,
      clearEditWhenDone,
    }: {
      record: DatabaseRecord;
      attribute: DatabaseAttributeMeta;
      draftValue: string | boolean;
      clearEditWhenDone: boolean;
    }) => {
      if (!tableCellEditingEnabled || !attribute.editable) {
        return;
      }

      const mutationKey = buildCellMutationKey(record.fileId, attribute.key);
      if (pendingCellMutations.includes(mutationKey)) {
        return;
      }

      const coercion = coerceDatabaseRecordFieldValue(attribute.type, draftValue);
      if (coercion.error) {
        setOperationError(coercion.error);
        return;
      }

      const previousRecord = records.find((entry) => entry.fileId === record.fileId);
      if (!previousRecord) {
        return;
      }

      rollbackRecordSnapshotRef.current.set(mutationKey, previousRecord);
      const optimisticRecord = applyOptimisticRecordFieldValue(
        previousRecord,
        attribute.key,
        coercion.typedValue,
      );
      setRecords((previous) =>
        previous.map((entry) =>
          entry.fileId === record.fileId
            ? optimisticRecord
            : entry));

      addPendingCellMutation(mutationKey);
      addPendingRecordMutation(record.fileId);
      setOperationError(null);
      if (clearEditWhenDone) {
        setActiveCellEdit((previous) =>
          previous && previous.recordId === record.fileId && toLower(previous.fieldKey) === toLower(attribute.key)
            ? null
            : previous);
      }

      try {
        const result = await upsertDatabaseRecordField({
          path: previousRecord.filePath,
          relativePath: previousRecord.relativePath,
          key: attribute.key,
          type: attribute.type,
          value: draftValue,
        });
        if (result.error) {
          throw new Error(result.error);
        }
        fileCacheRef.current.set(previousRecord.filePath, result.markdown);
        setOperationState("Wert gespeichert.");
        scheduleVaultAttributeRefresh();
      } catch (error) {
        const rollback = rollbackRecordSnapshotRef.current.get(mutationKey);
        if (rollback) {
          setRecords((previous) =>
            previous.map((entry) =>
              entry.fileId === rollback.fileId
                ? rollback
                : entry));
        }
        setOperationState(null);
        setOperationError(error instanceof Error ? error.message : "Wert konnte nicht gespeichert werden.");
      } finally {
        rollbackRecordSnapshotRef.current.delete(mutationKey);
        removePendingCellMutation(mutationKey);
        removePendingRecordMutation(record.fileId);
      }
    },
    [pendingCellMutations, records, scheduleVaultAttributeRefresh, tableCellEditingEnabled],
  );

  const ensureTimelineFieldSetup = useCallback(() => {
    const configuredStart = (timelineStartFieldRef.current ?? "").trim();
    const configuredEnd = (timelineEndFieldRef.current ?? "").trim();
    const startKey = configuredStart || "start";
    const endKey = configuredEnd || "end";

    let nextFields = cloneFieldDefinitions(fieldDefinitionsRef.current);
    let fieldsChanged = false;

    const ensureField = (key: string) => {
      const existing = nextFields.some((field) => toLower(field.key) === toLower(key));
      if (existing) {
        return;
      }
      nextFields = [
        ...nextFields,
        {
          key,
          label: key,
          type: "time",
          origin: "frontmatter",
          formula: null,
        },
      ];
      fieldsChanged = true;
    };

    ensureField(startKey);
    ensureField(endKey);

    const currentColumns = getPropertiesForView(propertiesByViewRef.current, "gantt");
    const nextColumns = appendVisibleColumnIfMissing(
      appendVisibleColumnIfMissing(currentColumns, startKey),
      endKey,
    );
    const columnsChanged = nextColumns.length !== currentColumns.length ||
      nextColumns.some((entry, index) => toLower(entry) !== toLower(currentColumns[index] ?? ""));

    const viewPatch: Partial<DatabaseViewSpec> = {};
    if (toLower(configuredStart) !== toLower(startKey)) {
      viewPatch.timelineStartField = startKey;
    }
    if (toLower(configuredEnd) !== toLower(endKey)) {
      viewPatch.timelineEndField = endKey;
    }

    if (fieldsChanged) {
      setFieldDefinitions(nextFields);
      fieldDefinitionsRef.current = nextFields;
    }
    if (columnsChanged) {
      const nextPropertiesByView = {
        ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
        gantt: nextColumns,
      };
      setPropertiesByView(nextPropertiesByView);
      propertiesByViewRef.current = nextPropertiesByView;
    }
    if (viewPatch.timelineStartField) {
      setTimelineStartField(startKey);
      timelineStartFieldRef.current = startKey;
    }
    if (viewPatch.timelineEndField) {
      setTimelineEndField(endKey);
      timelineEndFieldRef.current = endKey;
    }

    if (
      fieldsChanged ||
      columnsChanged ||
      typeof viewPatch.timelineStartField !== "undefined" ||
      typeof viewPatch.timelineEndField !== "undefined"
    ) {
      persistConfig({
        fields: nextFields,
        visibleColumns: nextColumns,
        viewType: "gantt",
        view: {
          ...viewPatch,
        },
      });
    }

    return {
      startKey,
      endKey,
    };
  }, [parsed.config.columns, persistConfig]);

  const ensureProjectFieldSetup = useCallback(() => {
    const configuredStart = (projectStartFieldRef.current ?? "").trim();
    const configuredUnit = (projectUnitFieldRef.current ?? "").trim();
    const startKey = configuredStart || DEFAULT_PROJECT_START_FIELD;
    const unitKey = configuredUnit || DEFAULT_PROJECT_UNIT_FIELD;

    let nextFields = cloneFieldDefinitions(fieldDefinitionsRef.current);
    let fieldsChanged = false;

    const ensureField = (key: string, type: DatabaseFieldType) => {
      const existing = nextFields.find((field) => toLower(field.key) === toLower(key));
      if (existing) {
        if (existing.type !== type) {
          nextFields = nextFields.map((field) =>
            toLower(field.key) === toLower(key)
              ? { ...field, type }
              : field);
          fieldsChanged = true;
        }
        return;
      }
      nextFields = [
        ...nextFields,
        {
          key,
          label: key,
          type,
          origin: "frontmatter",
          formula: null,
        },
      ];
      fieldsChanged = true;
    };

    ensureField(startKey, "number");
    ensureField(unitKey, "unit");

    const currentColumns = getPropertiesForView(propertiesByViewRef.current, "project");
    const nextColumns = appendVisibleColumnIfMissing(
      appendVisibleColumnIfMissing(currentColumns, startKey),
      unitKey,
    );
    const columnsChanged = nextColumns.length !== currentColumns.length ||
      nextColumns.some((entry, index) => toLower(entry) !== toLower(currentColumns[index] ?? ""));

    const viewPatch: Partial<DatabaseViewSpec> = {};
    if (toLower(configuredStart) !== toLower(startKey)) {
      viewPatch.projectStartField = startKey;
    }
    if (toLower(configuredUnit) !== toLower(unitKey)) {
      viewPatch.projectUnitField = unitKey;
    }

    if (fieldsChanged) {
      setFieldDefinitions(nextFields);
      fieldDefinitionsRef.current = nextFields;
    }
    if (columnsChanged) {
      const nextPropertiesByView = {
        ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
        project: nextColumns,
      };
      setPropertiesByView(nextPropertiesByView);
      propertiesByViewRef.current = nextPropertiesByView;
    }
    if (viewPatch.projectStartField) {
      setProjectStartField(startKey);
      projectStartFieldRef.current = startKey;
    }
    if (viewPatch.projectUnitField) {
      setProjectUnitField(unitKey);
      projectUnitFieldRef.current = unitKey;
    }

    if (
      fieldsChanged ||
      columnsChanged ||
      typeof viewPatch.projectStartField !== "undefined" ||
      typeof viewPatch.projectUnitField !== "undefined"
    ) {
      persistConfig({
        fields: nextFields,
        visibleColumns: nextColumns,
        viewType: "project",
        view: {
          ...viewPatch,
        },
      });
    }

    return {
      startKey,
      unitKey,
    };
  }, [parsed.config.columns, persistConfig]);

  const handleCommitTimelineRange = useCallback(async ({
    record,
    startTimestamp,
    endTimestamp,
  }: {
    record: DatabaseRecord;
    startTimestamp: number;
    endTimestamp: number;
  }) => {
    if (!allowCellEditing) {
      return;
    }

    const { startKey, endKey } = ensureTimelineFieldSetup();
    const mode = timelineModeRef.current ?? DEFAULT_TIMELINE_MODE;
    const startValue = formatTimelineValueFromTimestamp(startTimestamp, mode);
    const endValue = formatTimelineValueFromTimestamp(Math.max(startTimestamp, endTimestamp), mode);

    const previousRecord = records.find((entry) => entry.fileId === record.fileId);
    if (!previousRecord) {
      return;
    }

    const optimistic = applyOptimisticRecordFieldValue(
      applyOptimisticRecordFieldValue(previousRecord, startKey, startValue),
      endKey,
      endValue,
    );
    setRecords((previous) =>
      previous.map((entry) => (entry.fileId === record.fileId ? optimistic : entry)));
    addPendingRecordMutation(record.fileId);
    setOperationError(null);

    try {
      const startResult = await upsertDatabaseRecordField({
        path: previousRecord.filePath,
        relativePath: previousRecord.relativePath,
        key: startKey,
        type: "time",
        value: startValue,
      });
      if (startResult.error) {
        throw new Error(startResult.error);
      }

      const endResult = await upsertDatabaseRecordField({
        path: previousRecord.filePath,
        relativePath: previousRecord.relativePath,
        key: endKey,
        type: "time",
        value: endValue,
      });
      if (endResult.error) {
        throw new Error(endResult.error);
      }

      fileCacheRef.current.set(previousRecord.filePath, endResult.markdown);
      setOperationState("Timeline aktualisiert.");
      scheduleVaultAttributeRefresh();
    } catch (error) {
      setRecords((previous) =>
        previous.map((entry) => (entry.fileId === previousRecord.fileId ? previousRecord : entry)));
      setOperationState(null);
      setOperationError(
        error instanceof Error
          ? error.message
          : "Timeline konnte nicht gespeichert werden.",
      );
    } finally {
      removePendingRecordMutation(record.fileId);
    }
  }, [allowCellEditing, ensureTimelineFieldSetup, records, scheduleVaultAttributeRefresh]);

  const handleCommitProjectPlacement = useCallback(async ({
    record,
    startSlot,
    units,
  }: {
    record: DatabaseRecord;
    startSlot: number;
    units: number;
  }) => {
    if (!allowCellEditing) {
      return;
    }

    const { startKey, unitKey } = ensureProjectFieldSetup();
    const resolution = Math.max(1, projectBlockResolutionRef.current ?? DEFAULT_PROJECT_BLOCK_RESOLUTION);
    const boundedStart = clamp(Math.round(startSlot), 0, Math.max(0, resolution - 1));
    const boundedUnits = clamp(Math.round(units), 1, Math.max(1, resolution - boundedStart));

    const previousRecord = records.find((entry) => entry.fileId === record.fileId);
    if (!previousRecord) {
      return;
    }

    const optimistic = applyOptimisticRecordFieldValue(
      applyOptimisticRecordFieldValue(previousRecord, startKey, boundedStart),
      unitKey,
      boundedUnits,
    );
    setRecords((previous) =>
      previous.map((entry) => (entry.fileId === record.fileId ? optimistic : entry)));
    addPendingRecordMutation(record.fileId);
    setOperationError(null);

    try {
      const startResult = await upsertDatabaseRecordField({
        path: previousRecord.filePath,
        relativePath: previousRecord.relativePath,
        key: startKey,
        type: "number",
        value: boundedStart,
      });
      if (startResult.error) {
        throw new Error(startResult.error);
      }

      const unitResult = await upsertDatabaseRecordField({
        path: previousRecord.filePath,
        relativePath: previousRecord.relativePath,
        key: unitKey,
        type: "unit",
        value: boundedUnits,
      });
      if (unitResult.error) {
        throw new Error(unitResult.error);
      }

      fileCacheRef.current.set(previousRecord.filePath, unitResult.markdown);
      setOperationState("Project aktualisiert.");
      scheduleVaultAttributeRefresh();
    } catch (error) {
      setRecords((previous) =>
        previous.map((entry) => (entry.fileId === previousRecord.fileId ? previousRecord : entry)));
      setOperationState(null);
      setOperationError(
        error instanceof Error
          ? error.message
          : "Project Placement konnte nicht gespeichert werden.",
      );
    } finally {
      removePendingRecordMutation(record.fileId);
    }
  }, [allowCellEditing, ensureProjectFieldSetup, records, scheduleVaultAttributeRefresh]);

  const handleToggleVisibility = (key: string, visible: boolean) => {
    const targetView = viewTypeRef.current;
    const nextColumns = visible
      ? appendVisibleColumnIfMissing(visibleColumnKeys, key)
      : visibleColumnKeys.filter((entry) => entry.toLowerCase() !== key.toLowerCase());
    const nextPropertiesByView = {
      ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
      [targetView]: nextColumns,
    };
    setPropertiesByView(nextPropertiesByView);
    propertiesByViewRef.current = nextPropertiesByView;
    persistConfig({ visibleColumns: nextColumns, viewType: targetView });
  };

  const handleReorderVisibleColumns = (fromKey: string, toKey: string) => {
    const targetView = viewTypeRef.current;
    const fromIndex = visibleColumnKeys.findIndex((entry) => entry.toLowerCase() === fromKey.toLowerCase());
    const toIndex = visibleColumnKeys.findIndex((entry) => entry.toLowerCase() === toKey.toLowerCase());
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) {
      return;
    }
    const nextColumns = [...visibleColumnKeys];
    const [moved] = nextColumns.splice(fromIndex, 1);
    if (!moved) {
      return;
    }
    nextColumns.splice(toIndex, 0, moved);
    const nextPropertiesByView = {
      ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
      [targetView]: nextColumns,
    };
    setPropertiesByView(nextPropertiesByView);
    propertiesByViewRef.current = nextPropertiesByView;
    persistConfig({ visibleColumns: nextColumns, viewType: targetView });
  };

  const handleHideAllColumns = () => {
    const targetView = viewTypeRef.current;
    const nextPropertiesByView = {
      ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
      [targetView]: [],
    };
    setPropertiesByView(nextPropertiesByView);
    propertiesByViewRef.current = nextPropertiesByView;
    persistConfig({ visibleColumns: [], viewType: targetView });
  };

  const handleRestoreDefaultColumns = () => {
    const targetView = viewTypeRef.current;
    const parsedPropertiesByView = normalizePropertiesByView(parsed.config.propertiesByView, parsed.config.columns);
    const defaultPropertiesByView = normalizePropertiesByView(defaultConfig.propertiesByView, defaultConfig.columns);
    const parsedDefault = getPropertiesForView(parsedPropertiesByView, targetView);
    const fallbackDefault = getPropertiesForView(defaultPropertiesByView, targetView);
    const nextColumns = parsedDefault.length > 0 ? parsedDefault : fallbackDefault;
    const nextPropertiesByView = {
      ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
      [targetView]: nextColumns,
    };
    setPropertiesByView(nextPropertiesByView);
    propertiesByViewRef.current = nextPropertiesByView;
    persistConfig({ visibleColumns: nextColumns, viewType: targetView });
  };

  const handleFilterChange = (nextGroup: DatabaseFilterGroup) => {
    setActiveFilters(nextGroup);
    persistConfig({ filters: nextGroup });
  };

  const handleSortChange = (nextSorts: DatabaseSortRule[]) => {
    activeSortsRef.current = nextSorts;
    setActiveSorts(nextSorts);
    persistConfig({ sorts: nextSorts });
  };

  const handleToggleColumnSort = (columnKey: string) => {
    const nextSorts = toggleDatabaseSortRuleByField(activeSortsRef.current, columnKey);
    activeSortsRef.current = nextSorts;
    setActiveSorts(nextSorts);
    persistConfig({ sorts: nextSorts });
  };

  const handleStartCellEdit = (record: DatabaseRecord, attribute: DatabaseAttributeMeta) => {
    if (!tableCellEditingEnabled || !attribute.editable) {
      return;
    }
    const value = getRecordValueByField(record, attribute.key);
    setActiveCellEdit({
      recordId: record.fileId,
      fieldKey: attribute.key,
      draftValue: resolveCellDraftValue(attribute, value),
    });
  };

  const handleCellEditDraftChange = (nextDraft: string | boolean) => {
    setActiveCellEdit((previous) =>
      previous
        ? {
          ...previous,
          draftValue: nextDraft,
        }
        : previous);
  };

  const handleCancelCellEdit = () => {
    setActiveCellEdit(null);
  };

  const handleCommitCellEdit = async (
    record: DatabaseRecord,
    attribute: DatabaseAttributeMeta,
    draftOverride?: string | boolean,
  ) => {
    const activeDraft = draftOverride ?? activeCellEdit?.draftValue;
    if (typeof activeDraft === "undefined") {
      return;
    }
    await commitRecordFieldMutation({
      record,
      attribute,
      draftValue: activeDraft,
      clearEditWhenDone: true,
    });
  };

  const handleMoveKanbanRecord = async (
    record: DatabaseRecord,
    nextGroupValue: string,
  ) => {
    const groupAttribute = pickKanbanGroupAttribute(store.attributeRegistry, kanbanGroupBy);
    if (!groupAttribute) {
      return;
    }
    await commitRecordFieldMutation({
      record,
      attribute: groupAttribute,
      draftValue: nextGroupValue,
      clearEditWhenDone: false,
    });
  };

  const handleCreateFormulaField = ({
    key,
    label,
    type,
    formula,
  }: {
    key: string;
    label?: string;
    type: DatabaseFieldType;
    formula: string;
  }) => {
    const nextField: DatabaseFieldDefinition = {
      key,
      label,
      type,
      origin: "formula",
      formula,
    };
    const targetView = viewTypeRef.current;
    const nextFields = ensureFieldDefinition(fieldDefinitionsRef.current, nextField);
    const currentColumns = getPropertiesForView(propertiesByViewRef.current, targetView);
    const nextColumns = appendVisibleColumnIfMissing(currentColumns, key);
    const nextPropertiesByView = {
      ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
      [targetView]: nextColumns,
    };
    setFieldDefinitions(nextFields);
    setPropertiesByView(nextPropertiesByView);
    propertiesByViewRef.current = nextPropertiesByView;
    persistConfig({
      fields: nextFields,
      visibleColumns: nextColumns,
      viewType: targetView,
    });
  };

  const handleCreateAttribute = async ({
    key,
    type,
    initialValue,
    overwriteExisting,
  }: {
    key: string;
    type: DatabaseFieldType;
    initialValue: string;
    overwriteExisting: boolean;
  }) => {
    setIsMutatingFrontmatter(true);
    setOperationState(null);
    setOperationError(null);
    try {
      const result = await bulkUpsertDatabaseAttribute({
        files: sourceResolution.files,
        key,
        type,
        initialValue,
        overwriteExisting,
      });

      if (result.failed.length > 0) {
        setOperationError(`${result.failed.length} Datei(en) konnten nicht aktualisiert werden.`);
      } else {
        setOperationError(null);
      }
      setOperationState(
        `${result.updated} aktualisiert, ${result.skipped} uebersprungen.`,
      );

      const nextField: DatabaseFieldDefinition = {
        key,
        label: key,
        type,
        origin: "frontmatter",
        formula: null,
      };
      const targetView = viewTypeRef.current;
      const nextFields = ensureFieldDefinition(fieldDefinitionsRef.current, nextField);
      const currentColumns = getPropertiesForView(propertiesByViewRef.current, targetView);
      const nextColumns = appendVisibleColumnIfMissing(currentColumns, key);
      const nextPropertiesByView = {
        ...normalizePropertiesByView(propertiesByViewRef.current, parsed.config.columns),
        [targetView]: nextColumns,
      };
      setFieldDefinitions(nextFields);
      setPropertiesByView(nextPropertiesByView);
      propertiesByViewRef.current = nextPropertiesByView;
      persistConfig({
        fields: nextFields,
        visibleColumns: nextColumns,
        viewType: targetView,
      });

      fileCacheRef.current.clear();
      setReloadToken((value) => value + 1);
      scheduleVaultAttributeRefresh();
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : "Attribute konnten nicht gespeichert werden.");
    } finally {
      setIsMutatingFrontmatter(false);
    }
  };

  const handleRemoveFilterRule = (ruleId: string) => {
    const nextGroup = removeFilterRuleById(activeFilters, ruleId);
    setActiveFilters(nextGroup);
    persistConfig({ filters: nextGroup });
  };

  const handleClearAllFilters = () => {
    const nextGroup: DatabaseFilterGroup = {
      ...activeFilters,
      rules: [],
    };
    setActiveFilters(nextGroup);
    persistConfig({ filters: nextGroup });
  };

  const handleRemoveSortRule = (ruleId: string) => {
    const nextSorts = activeSorts.filter((rule) => rule.id !== ruleId);
    activeSortsRef.current = nextSorts;
    setActiveSorts(nextSorts);
    persistConfig({ sorts: nextSorts });
  };

  const handleClearAllSorts = () => {
    const nextSorts: DatabaseSortRule[] = [];
    activeSortsRef.current = nextSorts;
    setActiveSorts(nextSorts);
    persistConfig({ sorts: nextSorts });
  };

  const flatFilterRules = useMemo(() => getFlatFilterRules(activeFilters), [activeFilters]);
  const hasActiveFilters = flatFilterRules.length > 0;
  const hasActiveSorts = activeSorts.length > 0;
  const viewBehavior = VIEW_BEHAVIOR_BY_TYPE[viewType];

  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    (vaultFiles ?? []).forEach((file) => {
      const normalized = file.relative_path.replace(/\\/g, "/").replace(/^\/+/, "");
      const slashIndex = normalized.lastIndexOf("/");
      const folder = slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
      folders.add(folder);
    });
    return Array.from(folders).sort((left, right) => compareNaturalPath(left, right));
  }, [vaultFiles]);

  const filterValueSuggestionsByField = useMemo(() => {
    const next: Record<string, DatabaseVaultAttributeIndex["suggestions"]> = {};

    store.attributeRegistry.forEach((attribute) => {
      const countsByNormalized = new Map<string, { key: string; count: number }>();
      store.normalizedRecords.forEach((record) => {
        const values = normalizeFilterValueSuggestions(
          getRecordValueByField(record, attribute.key),
          attribute.type,
        );
        values.forEach((entry) => {
          const normalized = toLower(entry);
          if (!normalized) {
            return;
          }
          const current = countsByNormalized.get(normalized);
          if (current) {
            current.count += 1;
            return;
          }
          countsByNormalized.set(normalized, {
            key: entry,
            count: 1,
          });
        });
      });
      next[toLower(attribute.key)] = Array.from(countsByNormalized.entries())
        .map(([normalizedKey, value]) => ({
          key: value.key,
          normalizedKey,
          count: value.count,
        }))
        .sort((left, right) => {
          if (left.count !== right.count) {
            return right.count - left.count;
          }
          return left.key.localeCompare(right.key, undefined, { sensitivity: "base" });
        });
    });

    return next;
  }, [store.attributeRegistry, store.normalizedRecords]);

  const kanbanGroupAttribute = pickKanbanGroupAttribute(
    store.attributeRegistry,
    kanbanGroupBy,
  );
  const kanbanGroupByOptions = useMemo(
    () => store.attributeRegistry
      .filter((attribute) => attribute.viewCompatibility.supportsKanbanGrouping)
      .map((attribute) => ({
        key: attribute.key,
        label: attribute.label || attribute.key,
      })),
    [store.attributeRegistry],
  );
  const timelineStartAttribute = pickTimelineAttribute(
    store.attributeRegistry,
    timelineStartField,
  );
  const timelineEndAttribute = pickTimelineAttribute(
    store.attributeRegistry,
    timelineEndField,
  );
  const projectStartAttribute = pickProjectNumericAttribute(
    store.attributeRegistry,
    projectStartField,
  );
  const projectUnitAttribute = pickProjectNumericAttribute(
    store.attributeRegistry,
    projectUnitField,
  );
  const pieGroupAttribute = pickPieGroupAttribute(
    store.attributeRegistry,
    pieGroupField,
  );
  const pieAggregateAttribute = useMemo(
    () => {
      if (!pieAggregateField) {
        return null;
      }
      return store.attributeRegistry.find((attribute) =>
        toLower(attribute.key) === toLower(pieAggregateField)) ?? null;
    },
    [pieAggregateField, store.attributeRegistry],
  );
  const hasOpenPanel = panels.source ||
    panels.properties ||
    panels.filter ||
    panels.sort ||
    panels.gantt ||
    panels.project ||
    panels.pie;

  const openPanelContent = panels.source ? (
    <DatabaseSourcePanel
      source={source}
      availableFolders={availableFolders}
      onChange={handleSourceChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.properties ? (
    <DatabasePropertiesPanel
      attributes={store.attributeRegistry}
      attributeSuggestions={vaultAttributeIndex.suggestions}
      viewType={viewType}
      visibleColumnKeys={visibleColumnKeys}
      kanbanShowCover={kanbanShowCover}
      onKanbanShowCoverChange={handleKanbanShowCoverChange}
      onToggleVisibility={handleToggleVisibility}
      onReorderVisibleColumns={handleReorderVisibleColumns}
      onHideAll={handleHideAllColumns}
      onRestoreDefault={handleRestoreDefaultColumns}
      onCreateAttribute={handleCreateAttribute}
      onCreateFormula={handleCreateFormulaField}
      isMutatingFrontmatter={isMutatingFrontmatter}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.filter ? (
    <DatabaseFilterPanel
      attributes={store.attributeRegistry}
      attributeSuggestions={vaultAttributeIndex.suggestions}
      valueSuggestionsByField={filterValueSuggestionsByField}
      viewType={viewType}
      filterGroup={activeFilters}
      onChange={handleFilterChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.sort ? (
    <DatabaseSortPanel
      attributes={store.attributeRegistry}
      attributeSuggestions={vaultAttributeIndex.suggestions}
      viewType={viewType}
      sortRules={activeSorts}
      onChange={handleSortChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.gantt ? (
    <DatabaseGanttPanel
      attributes={store.attributeRegistry}
      startField={timelineStartField}
      endField={timelineEndField}
      mode={timelineMode}
      baseDate={timelineBaseDate}
      zoom={ganttZoom}
      onChange={handleGanttOptionsChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.project ? (
    <DatabaseProjectPanel
      attributes={store.attributeRegistry}
      startField={projectStartField}
      unitField={projectUnitField}
      blockResolution={projectBlockResolution}
      defaultUnits={projectDefaultUnits}
      missingPlacement={projectMissingPlacement}
      onChange={handleProjectOptionsChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : panels.pie ? (
    <DatabasePiePanel
      attributes={store.attributeRegistry}
      groupField={pieGroupField}
      aggregate={pieAggregate}
      aggregateField={pieAggregateField}
      onChange={handlePieOptionsChange}
      onClose={() => setPanels(defaultPanels)}
    />
  ) : null;

  const panelLayerNode = hasOpenPanel ? (
    <div
      ref={panelLayerRef}
      className={`database-block-panel-layer${hasOpenPanel ? " is-open" : ""}`}
      style={isCompactPanelLayer ? undefined : (panelLayerStyle ?? { visibility: "hidden" })}
      data-md-block-control="true"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          setPanels(defaultPanels);
        }
      }}
    >
      {openPanelContent}
    </div>
  ) : null;

  return (
    <section className="database-block" ref={rootRef} data-md-block-control="true">
      <div className="database-block-header" data-md-block-control="true">
        {parsed.config.options.showToolbar ? (
          <DatabaseToolbar
            title={title}
            sourceLabel={getFolderLabel(source)}
            viewType={viewType}
            kanbanGroupBy={kanbanGroupBy}
            kanbanGroupByOptions={kanbanGroupByOptions}
            searchQuery={searchQuery}
            showSearch={parsed.config.options.showSearch}
            onTitleChange={handleTitleChange}
            onTitleBlur={handleTitleBlur}
            onSearchChange={setSearchQuery}
            onViewTypeChange={handleViewChange}
            onKanbanGroupByChange={handleKanbanGroupByChange}
            isSourcePanelOpen={panels.source}
            isFilterPanelOpen={panels.filter}
            isSortPanelOpen={panels.sort}
            isPropertiesPanelOpen={panels.properties}
            isGanttPanelOpen={panels.gantt}
            isProjectPanelOpen={panels.project}
            isPiePanelOpen={panels.pie}
            onToggleSourcePanel={() => setPanel("source")}
            onToggleFilterPanel={() => setPanel("filter")}
            onToggleSortPanel={() => setPanel("sort")}
            onTogglePropertiesPanel={() => setPanel("properties")}
            onToggleGanttPanel={() => setPanel("gantt")}
            onToggleProjectPanel={() => setPanel("project")}
            onTogglePiePanel={() => setPanel("pie")}
            sourceButtonRef={setSourceTriggerRef}
            sortButtonRef={setSortTriggerRef}
            filterButtonRef={setFilterTriggerRef}
            propertiesButtonRef={setPropertiesTriggerRef}
            ganttButtonRef={setGanttTriggerRef}
            projectButtonRef={setProjectTriggerRef}
            pieButtonRef={setPieTriggerRef}
          />
        ) : null}

        {hasActiveFilters || hasActiveSorts ? (
          <div className="database-block-rule-chips" data-md-block-control="true">
            <p className="database-block-rule-context">
              {`Filter: ${viewBehavior.filterSubject}. Sortierung: ${viewBehavior.sortSubject}.`}
            </p>
            {hasActiveFilters ? (
              <div className="database-block-filter-chips">
                {flatFilterRules.map((entry) => {
                  const valueText = typeof entry.value !== "undefined" ? ` ${String(entry.value)}` : "";
                  const rangeText = entry.op === "between" && typeof entry.valueTo !== "undefined"
                    ? ` .. ${String(entry.valueTo)}`
                    : "";
                  return (
                    <button
                      key={entry.ruleId}
                      type="button"
                      className="database-block-filter-chip"
                      onClick={() => handleRemoveFilterRule(entry.ruleId)}
                      title="Filter entfernen"
                    >
                      {`${entry.field} ${entry.op}${valueText}${rangeText}`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  className="database-block-filter-chip database-block-filter-chip-clear"
                  onClick={handleClearAllFilters}
                >
                  Alle Filter loeschen
                </button>
              </div>
            ) : null}
            {hasActiveSorts ? (
              <div className="database-block-sort-chips">
                {activeSorts.map((rule, index) => (
                  <button
                    key={rule.id}
                    type="button"
                    className="database-block-filter-chip database-block-sort-chip"
                    onClick={() => handleRemoveSortRule(rule.id)}
                    title="Sortierung entfernen"
                  >
                    {`${index + 1}. ${rule.field} ${rule.dir === "asc" ? "ASC" : "DESC"}`}
                  </button>
                ))}
                <button
                  type="button"
                  className="database-block-filter-chip database-block-filter-chip-clear"
                  onClick={handleClearAllSorts}
                >
                  Sortierung loeschen
                </button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {typeof document !== "undefined" ? createPortal(panelLayerNode, document.body) : panelLayerNode}

      <div className="database-block-content">
        {viewType === "table" ? (
          <DatabaseTableView
            records={store.visibleRecords}
            columns={visibleColumns}
            sortRules={activeSorts}
            editable={tableCellEditingEnabled}
            activeEditCell={activeCellEdit}
            pendingCellMutations={pendingCellMutations}
            onOpenRecord={openRecord}
            onToggleColumnSort={handleToggleColumnSort}
            onReorderColumns={handleReorderVisibleColumns}
            onStartCellEdit={handleStartCellEdit}
            onEditCellDraftChange={handleCellEditDraftChange}
            onCommitCellEdit={handleCommitCellEdit}
            onCancelCellEdit={handleCancelCellEdit}
          />
        ) : viewType === "kanban" ? (
          <DatabaseKanbanView
            records={store.visibleRecords}
            groupAttribute={kanbanGroupAttribute}
            attributes={store.attributeRegistry}
            visibleProperties={visibleColumns}
            showCover={kanbanShowCover}
            pendingRecordIds={pendingRecordMutations}
            onMoveRecord={handleMoveKanbanRecord}
            onOpenRecord={openRecord}
          />
        ) : viewType === "gantt" ? (
          <DatabaseGanttView
            records={store.visibleRecords}
            startAttribute={timelineStartAttribute}
            endAttribute={timelineEndAttribute}
            mode={timelineMode}
            baseDate={timelineBaseDate}
            zoom={ganttZoom}
            visibleProperties={visibleColumns}
            editable={allowCellEditing}
            pendingRecordIds={pendingRecordMutations}
            onCommitRange={handleCommitTimelineRange}
            onOpenRecord={openRecord}
          />
        ) : viewType === "project" ? (
          <DatabaseProjectView
            records={store.visibleRecords}
            startField={projectStartAttribute?.key ?? projectStartField ?? DEFAULT_PROJECT_START_FIELD}
            unitField={projectUnitAttribute?.key ?? projectUnitField ?? DEFAULT_PROJECT_UNIT_FIELD}
            resolution={projectBlockResolution}
            defaultUnits={projectDefaultUnits}
            missingPlacement={projectMissingPlacement}
            visibleProperties={visibleColumns}
            editable={allowCellEditing}
            pendingRecordIds={pendingRecordMutations}
            onCommitPlacement={handleCommitProjectPlacement}
            onOpenRecord={openRecord}
          />
        ) : (
          <DatabasePieView
            records={store.visibleRecords}
            groupAttribute={pieGroupAttribute}
            aggregate={pieAggregate}
            aggregateAttribute={pieAggregateAttribute}
            visibleProperties={visibleColumns}
          />
        )}
      </div>

      {store.uiState.loading ? <p className="database-block-state">Lade Daten...</p> : null}
      {store.uiState.warning ? <p className="database-block-state">{store.uiState.warning}</p> : null}
      {store.uiState.error ? <p className="database-block-state is-error">{store.uiState.error}</p> : null}
      {operationState ? <p className="database-block-state">{operationState}</p> : null}
      {operationError ? <p className="database-block-state is-error">{operationError}</p> : null}
      {parsed.errors.length > 0 ? (
        <p className="database-block-state is-error">{parsed.errors.join(" ")}</p>
      ) : null}
    </section>
  );
};
