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
  type DatabaseFilterGroup,
  type DatabaseRecord,
  type DatabaseSortRule,
  type DatabaseViewType,
} from "./database-types";
import { DatabaseFilterPanel } from "./ui/database-filter-panel";
import { DatabasePropertiesPanel } from "./ui/database-properties-panel";
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

const cloneFilterGroup = (group: DatabaseFilterGroup): DatabaseFilterGroup => ({
  ...group,
  rules: group.rules.map((entry) =>
    "rules" in entry
      ? cloneFilterGroup(entry)
      : { ...entry }),
});

const cloneSortRules = (rules: DatabaseSortRule[]) => rules.map((rule) => ({ ...rule }));

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
  properties: false,
  filter: false,
  sort: false,
};

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

  const [searchQuery, setSearchQuery] = useState("");
  const [viewType, setViewType] = useState<DatabaseViewType>(parsed.config.view.type);
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<string[]>(parsed.config.columns);
  const [activeFilters, setActiveFilters] = useState<DatabaseFilterGroup>(cloneFilterGroup(parsed.config.filters));
  const [activeSorts, setActiveSorts] = useState<DatabaseSortRule[]>(cloneSortRules(parsed.config.sort));
  const [records, setRecords] = useState<DatabaseRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [panels, setPanels] = useState<DatabaseBlockOpenPanels>(defaultPanels);

  useEffect(() => {
    setViewType(parsed.config.view.type);
    setVisibleColumnKeys(parsed.config.columns);
    setActiveFilters(cloneFilterGroup(parsed.config.filters));
    setActiveSorts(cloneSortRules(parsed.config.sort));
  }, [parsed.config]);

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
    const handleClickOutside = (event: MouseEvent) => {
      if (!rootRef.current) {
        return;
      }
      if (event.target instanceof Node && !rootRef.current.contains(event.target)) {
        setPanels(defaultPanels);
      }
    };
    window.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("mousedown", handleClickOutside);
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
    () => resolveDatabaseSourceFiles(parsed.config.source, sourceContext),
    [parsed.config.source, sourceContext],
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
  }, [sourceResolution.files]);

  const persistConfig = useCallback((next: {
    viewType?: DatabaseViewType;
    visibleColumns?: string[];
    filters?: DatabaseFilterGroup;
    sorts?: DatabaseSortRule[];
  }) => {
    const nextConfig = {
      ...parsed.config,
      view: {
        ...parsed.config.view,
        type: next.viewType ?? viewType,
      },
      columns: next.visibleColumns ?? visibleColumnKeys,
      filters: next.filters ? cloneFilterGroup(next.filters) : cloneFilterGroup(activeFilters),
      sort: next.sorts ? cloneSortRules(next.sorts) : cloneSortRules(activeSorts),
    };
    onCommitRaw(serializeDatabaseBlockConfig(nextConfig));
  }, [activeFilters, activeSorts, onCommitRaw, parsed.config, viewType, visibleColumnKeys]);

  const store = useMemo(
    () => buildDatabaseStoreSnapshot({
      records,
      config: {
        ...parsed.config,
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
      loadError,
      loading,
      parsed.config,
      records,
      searchQuery,
      sourceResolution.warning,
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
    setPanels((current) => ({
      properties: panel === "properties" ? !current.properties : false,
      filter: panel === "filter" ? !current.filter : false,
      sort: panel === "sort" ? !current.sort : false,
    }));
  };

  const openRecord = (record: DatabaseRecord) => {
    const target = toWikilinkTarget(record.relativePath);
    onNavigateWikilink?.(`[[${target}]]`);
  };

  const handleViewChange = (nextType: DatabaseViewType) => {
    setViewType(nextType);
    persistConfig({ viewType: nextType });
  };

  const handleToggleVisibility = (key: string, visible: boolean) => {
    const nextColumns = visible
      ? [...visibleColumnKeys, key]
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
      ? parsed.config.columns
      : defaultConfig.columns;
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

  return (
    <section className="database-block" ref={rootRef} data-md-block-control="true">
      {parsed.config.options.showToolbar ? (
        <DatabaseToolbar
          title={parsed.config.title}
          sourceLabel={getFolderLabel(parsed.config.source)}
          viewType={viewType}
          searchQuery={searchQuery}
          showSearch={parsed.config.options.showSearch}
          onSearchChange={setSearchQuery}
          onViewTypeChange={handleViewChange}
          onToggleFilterPanel={() => setPanel("filter")}
          onToggleSortPanel={() => setPanel("sort")}
          onTogglePropertiesPanel={() => setPanel("properties")}
        />
      ) : null}

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
      {parsed.errors.length > 0 ? (
        <p className="database-block-state is-error">{parsed.errors.join(" ")}</p>
      ) : null}

      <div className="database-block-panel-layer" data-md-block-control="true">
        {panels.properties ? (
          <DatabasePropertiesPanel
            attributes={store.attributeRegistry}
            visibleColumnKeys={visibleColumnKeys}
            onToggleVisibility={handleToggleVisibility}
            onReorderVisibleColumns={handleReorderVisibleColumns}
            onHideAll={handleHideAllColumns}
            onRestoreDefault={handleRestoreDefaultColumns}
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
    </section>
  );
};
