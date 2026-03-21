/**
 * @file apps/fmd-desktop/src/features/preview/database/database-block.tsx
 *
 * Main database block renderer for markdown hybrid editor.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { parseFrontmatterDocument } from "../frontmatter";
import {
  createDefaultDatabaseBlockConfig,
  parseDatabaseBlockConfigFromRaw,
  serializeDatabaseBlockConfig,
} from "./database-block-parser";
import {
  buildNormalizedRecord,
  createSystemFieldsForRecord,
} from "./database-normalizers";
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
  type DatabaseRecord,
  type DatabaseSourceSpec,
  type DatabaseSortRule,
  type DatabaseViewType,
} from "./database-types";
import {
  bulkUpsertDatabaseAttribute,
} from "./frontmatter-update";
import { DatabaseFilterPanel } from "./ui/database-filter-panel";
import { DatabasePropertiesPanel } from "./ui/database-properties-panel";
import { DatabaseSourcePanel } from "./ui/database-source-panel";
import { DatabaseSortPanel } from "./ui/database-sort-panel";
import { DatabaseToolbar } from "./ui/database-toolbar";
import { DatabaseGanttView } from "./views/gantt-view";
import { DatabaseKanbanView } from "./views/kanban-view";
import { DatabasePieView } from "./views/pie-view";
import { DatabaseTableView } from "./views/table-view";

type DatabaseBlockProps = {
  raw: string;
  vaultFiles?: Array<{ path: string; relative_path: string }>;
  sourceRelativePath?: string | null;
  onNavigateWikilink?: (wikilink: string) => void;
  onCommitRaw: (nextRaw: string) => void;
};

type DatabaseBlockOpenPanels = {
  source: boolean;
  properties: boolean;
  filter: boolean;
  sort: boolean;
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
    const preferred = attributes.find((attribute) => attribute.key === preferredKey) ?? null;
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
    const preferred = attributes.find((attribute) => attribute.key === preferredKey) ?? null;
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
    const preferred = attributes.find((attribute) => attribute.key === preferredKey) ?? null;
    if (preferred && preferred.viewCompatibility.supportsPieGrouping) {
      return preferred;
    }
  }
  return attributes.find((attribute) => attribute.viewCompatibility.supportsPieGrouping) ?? null;
};

const defaultPanels: DatabaseBlockOpenPanels = {
  source: false,
  properties: false,
  filter: false,
  sort: false,
};

const TITLE_COMMIT_DEBOUNCE_MS = 280;

export const MarkdownHybridDatabaseBlock = ({
  raw,
  vaultFiles,
  sourceRelativePath,
  onNavigateWikilink,
  onCommitRaw,
}: DatabaseBlockProps) => {
  const parsed = useMemo(() => parseDatabaseBlockConfigFromRaw(raw), [raw]);
  const defaultConfig = useMemo(() => createDefaultDatabaseBlockConfig(), []);
  const rootRef = useRef<HTMLElement | null>(null);
  const fileCacheRef = useRef<Map<string, string>>(new Map());
  const titlePersistTimeoutRef = useRef<number | null>(null);

  const [title, setTitle] = useState(parsed.config.title);
  const [source, setSource] = useState<DatabaseSourceSpec>(cloneSourceSpec(parsed.config.source));
  const [fieldDefinitions, setFieldDefinitions] = useState<DatabaseFieldDefinition[]>(
    cloneFieldDefinitions(parsed.config.fields ?? []),
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<DatabaseViewType>(parsed.config.view.type);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(parsed.config.columns);
  const [activeFilters, setActiveFilters] = useState<DatabaseFilterGroup>(cloneFilterGroup(parsed.config.filters));
  const [activeSorts, setActiveSorts] = useState<DatabaseSortRule[]>(cloneSortRules(parsed.config.sort));
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationState, setOperationState] = useState<string | null>(null);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [isMutatingFrontmatter, setIsMutatingFrontmatter] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const [panels, setPanels] = useState<DatabaseBlockOpenPanels>(defaultPanels);
  const titleRef = useRef(title);
  const sourceRef = useRef(source);
  const fieldDefinitionsRef = useRef(fieldDefinitions);
  const viewTypeRef = useRef(viewType);
  const visibleColumnKeysRef = useRef(visibleColumnKeys);
  const activeFiltersRef = useRef(activeFilters);
  const activeSortsRef = useRef(activeSorts);

  useEffect(() => {
    if (titlePersistTimeoutRef.current !== null) {
      window.clearTimeout(titlePersistTimeoutRef.current);
      titlePersistTimeoutRef.current = null;
    }
    setTitle(parsed.config.title);
    setSource(cloneSourceSpec(parsed.config.source));
    setFieldDefinitions(cloneFieldDefinitions(parsed.config.fields ?? []));
    setViewType(parsed.config.view.type);
    setVisibleColumnKeys(parsed.config.columns);
    setActiveFilters(cloneFilterGroup(parsed.config.filters));
    setActiveSorts(cloneSortRules(parsed.config.sort));
  }, [parsed.config]);

  useEffect(() => {
    titleRef.current = title;
    sourceRef.current = source;
    fieldDefinitionsRef.current = fieldDefinitions;
    viewTypeRef.current = viewType;
    visibleColumnKeysRef.current = visibleColumnKeys;
    activeFiltersRef.current = activeFilters;
    activeSortsRef.current = activeSorts;
  }, [activeFilters, activeSorts, fieldDefinitions, source, title, viewType, visibleColumnKeys]);

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
      if (!rootRef.current) {
        return;
      }
      const target = event.target;
      if (!(target instanceof Node)) {
        return;
      }
      const composedPath = typeof event.composedPath === "function"
        ? event.composedPath()
        : [];
      const clickedInside = rootRef.current.contains(target) || composedPath.includes(rootRef.current);
      if (!clickedInside) {
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

  const persistConfig = useCallback((next: {
    title?: string;
    source?: DatabaseSourceSpec;
    fields?: DatabaseFieldDefinition[];
    viewType?: DatabaseViewType;
    visibleColumns?: string[];
    filters?: DatabaseFilterGroup;
    sorts?: DatabaseSortRule[];
  }) => {
    const nextTitle = next.title ?? titleRef.current;
    const nextSource = cloneSourceSpec(next.source ?? sourceRef.current);
    const nextFields = cloneFieldDefinitions(next.fields ?? fieldDefinitionsRef.current);
    const nextViewType = next.viewType ?? viewTypeRef.current;
    const nextVisibleColumns = next.visibleColumns ?? visibleColumnKeysRef.current;
    const nextFilters = next.filters ?? activeFiltersRef.current;
    const nextSorts = next.sorts ?? activeSortsRef.current;

    const nextConfig = {
      ...parsed.config,
      title: nextTitle,
      source: nextSource,
      fields: nextFields,
      view: {
        ...parsed.config.view,
        type: nextViewType,
      },
      columns: nextVisibleColumns,
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
        },
        columns: visibleColumnKeys,
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
      viewType,
      visibleColumnKeys,
    ],
  );

  const visibleColumns = useMemo(
    () => store.visibleColumnKeys
      .map((key) => store.attributeRegistry.find((attribute) => attribute.key === key) ?? null)
      .filter((attribute): attribute is DatabaseAttributeMeta => Boolean(attribute)),
    [store.attributeRegistry, store.visibleColumnKeys],
  );

  const setPanel = (panel: keyof DatabaseBlockOpenPanels) => {
    setPanels({
      source: panel === "source",
      properties: panel === "properties",
      filter: panel === "filter",
      sort: panel === "sort",
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

  const handleToggleVisibility = (key: string, visible: boolean) => {
    const nextColumns = visible
      ? appendVisibleColumnIfMissing(visibleColumnKeys, key)
      : visibleColumnKeys.filter((entry) => entry.toLowerCase() !== key.toLowerCase());
    setVisibleColumnKeys(nextColumns);
    persistConfig({ visibleColumns: nextColumns });
  };

  const handleReorderVisibleColumns = (fromKey: string, toKey: string) => {
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
    setVisibleColumnKeys(nextColumns);
    persistConfig({ visibleColumns: nextColumns });
  };

  const handleHideAllColumns = () => {
    setVisibleColumnKeys([]);
    persistConfig({ visibleColumns: [] });
  };

  const handleRestoreDefaultColumns = () => {
    const nextColumns = parsed.config.columns.length > 0
      ? [...parsed.config.columns]
      : [...defaultConfig.columns];
    setVisibleColumnKeys(nextColumns);
    persistConfig({ visibleColumns: nextColumns });
  };

  const handleFilterChange = (nextGroup: DatabaseFilterGroup) => {
    setActiveFilters(nextGroup);
    persistConfig({ filters: nextGroup });
  };

  const handleSortChange = (nextSorts: DatabaseSortRule[]) => {
    setActiveSorts(nextSorts);
    persistConfig({ sorts: nextSorts });
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
    const nextFields = ensureFieldDefinition(fieldDefinitionsRef.current, nextField);
    const nextColumns = appendVisibleColumnIfMissing(visibleColumnKeysRef.current, key);
    setFieldDefinitions(nextFields);
    setVisibleColumnKeys(nextColumns);
    persistConfig({
      fields: nextFields,
      visibleColumns: nextColumns,
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
      const nextFields = ensureFieldDefinition(fieldDefinitionsRef.current, nextField);
      const nextColumns = appendVisibleColumnIfMissing(visibleColumnKeysRef.current, key);
      setFieldDefinitions(nextFields);
      setVisibleColumnKeys(nextColumns);
      persistConfig({
        fields: nextFields,
        visibleColumns: nextColumns,
      });

      fileCacheRef.current.clear();
      setReloadToken((value) => value + 1);
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

  const flatFilterRules = useMemo(() => getFlatFilterRules(activeFilters), [activeFilters]);

  const availableFolders = useMemo(() => {
    const folders = new Set<string>();
    (vaultFiles ?? []).forEach((file) => {
      const normalized = file.relative_path.replace(/\\/g, "/").replace(/^\/+/, "");
      const slashIndex = normalized.lastIndexOf("/");
      const folder = slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
      folders.add(folder);
    });
    return Array.from(folders).sort((left, right) => left.localeCompare(right));
  }, [vaultFiles]);

  const kanbanGroupAttribute = pickKanbanGroupAttribute(
    store.attributeRegistry,
    parsed.config.view.groupBy,
  );
  const timelineStartAttribute = pickTimelineAttribute(
    store.attributeRegistry,
    parsed.config.view.timelineStartField,
  );
  const timelineEndAttribute = pickTimelineAttribute(
    store.attributeRegistry,
    parsed.config.view.timelineEndField,
  );
  const pieGroupAttribute = pickPieGroupAttribute(
    store.attributeRegistry,
    parsed.config.view.pieGroupField,
  );
  const hasOpenPanel = panels.source || panels.properties || panels.filter || panels.sort;

  return (
    <section className="database-block" ref={rootRef} data-md-block-control="true">
      <div className="database-block-header" data-md-block-control="true">
        {parsed.config.options.showToolbar ? (
          <DatabaseToolbar
            title={title}
            sourceLabel={getFolderLabel(source)}
            viewType={viewType}
            searchQuery={searchQuery}
            showSearch={parsed.config.options.showSearch}
            onTitleChange={handleTitleChange}
            onTitleBlur={handleTitleBlur}
            onSearchChange={setSearchQuery}
            onViewTypeChange={handleViewChange}
            isSourcePanelOpen={panels.source}
            isFilterPanelOpen={panels.filter}
            isSortPanelOpen={panels.sort}
            isPropertiesPanelOpen={panels.properties}
            onToggleSourcePanel={() => setPanel("source")}
            onToggleFilterPanel={() => setPanel("filter")}
            onToggleSortPanel={() => setPanel("sort")}
            onTogglePropertiesPanel={() => setPanel("properties")}
          />
        ) : null}

        {flatFilterRules.length > 0 ? (
          <div className="database-block-filter-chips" data-md-block-control="true">
            {flatFilterRules.map((entry) => (
              <button
                key={entry.ruleId}
                type="button"
                className="database-block-filter-chip"
                onClick={() => handleRemoveFilterRule(entry.ruleId)}
                title="Filter entfernen"
              >
                {`${entry.field} ${entry.op}${typeof entry.value !== "undefined" ? ` ${String(entry.value)}` : ""}`}
              </button>
            ))}
            <button
              type="button"
              className="database-block-filter-chip database-block-filter-chip-clear"
              onClick={handleClearAllFilters}
            >
              Alle Filter loeschen
            </button>
          </div>
        ) : null}

        <div
          className={`database-block-panel-layer${hasOpenPanel ? " is-open" : ""}`}
          data-md-block-control="true"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setPanels(defaultPanels);
            }
          }}
        >
          {panels.source ? (
            <DatabaseSourcePanel
              source={source}
              availableFolders={availableFolders}
              onChange={handleSourceChange}
              onClose={() => setPanels(defaultPanels)}
            />
          ) : null}
          {panels.properties ? (
            <DatabasePropertiesPanel
              attributes={store.attributeRegistry}
              visibleColumnKeys={visibleColumnKeys}
              onToggleVisibility={handleToggleVisibility}
              onReorderVisibleColumns={handleReorderVisibleColumns}
              onHideAll={handleHideAllColumns}
              onRestoreDefault={handleRestoreDefaultColumns}
              onCreateAttribute={handleCreateAttribute}
              onCreateFormula={handleCreateFormulaField}
              isMutatingFrontmatter={isMutatingFrontmatter}
              onClose={() => setPanels(defaultPanels)}
            />
          ) : null}
          {panels.filter ? (
            <DatabaseFilterPanel
              attributes={store.attributeRegistry}
              filterGroup={activeFilters}
              onChange={handleFilterChange}
              onClose={() => setPanels(defaultPanels)}
            />
          ) : null}
          {panels.sort ? (
            <DatabaseSortPanel
              attributes={store.attributeRegistry}
              sortRules={activeSorts}
              onChange={handleSortChange}
              onClose={() => setPanels(defaultPanels)}
            />
          ) : null}
        </div>
      </div>

      <div className="database-block-content">
        {viewType === "table" ? (
          <DatabaseTableView
            records={store.visibleRecords}
            columns={visibleColumns}
            onOpenRecord={openRecord}
          />
        ) : viewType === "kanban" ? (
          <DatabaseKanbanView
            records={store.visibleRecords}
            groupAttribute={kanbanGroupAttribute}
          />
        ) : viewType === "gantt" ? (
          <DatabaseGanttView
            records={store.visibleRecords}
            startAttribute={timelineStartAttribute}
            endAttribute={timelineEndAttribute}
          />
        ) : (
          <DatabasePieView
            records={store.visibleRecords}
            groupAttribute={pieGroupAttribute}
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
