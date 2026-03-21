/**
 * @file apps/fmd-desktop/src/features/preview/database/database-store.ts
 *
 * Derives database registry and visible rows from records + config/UI state.
 */

import {
  applyDatabaseFilters,
} from "./database-filters";
import {
  inferFieldType,
  resolveFieldCompatibility,
} from "./database-normalizers";
import { applyDatabaseSorts } from "./database-sorts";
import {
  type DatabaseAttributeMeta,
  type DatabaseBlockConfig,
  type DatabaseFilterGroup,
  type DatabaseRecord,
  type DatabaseSortRule,
  type DatabaseStoreSnapshot,
} from "./database-types";

type BuildDatabaseStoreSnapshotParams = {
  records: DatabaseRecord[];
  config: DatabaseBlockConfig;
  searchQuery: string;
  activeFilters?: DatabaseFilterGroup;
  activeSorts?: DatabaseSortRule[];
  visibleColumnKeys?: string[];
  loading?: boolean;
  warning?: string | null;
  error?: string | null;
};

const toLowerKey = (key: string) => key.trim().toLowerCase();

const dedupeByCaseInsensitiveKey = (keys: string[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  keys.forEach((key) => {
    const normalized = toLowerKey(key);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    ordered.push(key);
  });

  return ordered;
};

const buildAttributeMeta = (
  key: string,
  origin: DatabaseAttributeMeta["origin"],
  records: DatabaseRecord[],
): DatabaseAttributeMeta => {
  const rawValue = records
    .map((record) =>
      origin === "system"
        ? record.systemFields[key]
        : record.frontmatter[key])
    .find((value) => value !== null && typeof value !== "undefined");

  const type = inferFieldType(key, rawValue);

  return {
    key,
    label: key,
    type,
    origin,
    editable: origin === "frontmatter",
    sortable: true,
    filterable: true,
    aggregatable: resolveFieldCompatibility(type).supportsAggregation,
    viewCompatibility: resolveFieldCompatibility(type),
  };
};

const getSystemKeys = (records: DatabaseRecord[]) => {
  const keys = records.flatMap((record) => Object.keys(record.systemFields));
  return dedupeByCaseInsensitiveKey(keys);
};

const getFrontmatterKeys = (records: DatabaseRecord[]) => {
  const keys = records.flatMap((record) => Object.keys(record.frontmatter));
  return dedupeByCaseInsensitiveKey(keys);
};

const buildAttributeRegistry = (
  records: DatabaseRecord[],
  preferredColumnOrder: string[],
): DatabaseAttributeMeta[] => {
  const systemKeys = getSystemKeys(records);
  const frontmatterKeys = getFrontmatterKeys(records)
    .filter((key) => !systemKeys.some((systemKey) => toLowerKey(systemKey) === toLowerKey(key)));

  const attributes: DatabaseAttributeMeta[] = [
    ...systemKeys.map((key) => buildAttributeMeta(key, "system", records)),
    ...frontmatterKeys.map((key) => buildAttributeMeta(key, "frontmatter", records)),
  ];

  if (attributes.length === 0) {
    return [];
  }

  const orderIndex = new Map<string, number>();
  preferredColumnOrder.forEach((key, index) => {
    orderIndex.set(toLowerKey(key), index);
  });

  return [...attributes].sort((left, right) => {
    const leftOrder = orderIndex.get(toLowerKey(left.key));
    const rightOrder = orderIndex.get(toLowerKey(right.key));
    if (typeof leftOrder === "number" && typeof rightOrder === "number") {
      return leftOrder - rightOrder;
    }
    if (typeof leftOrder === "number") {
      return -1;
    }
    if (typeof rightOrder === "number") {
      return 1;
    }
    if (left.origin !== right.origin) {
      return left.origin === "system" ? -1 : 1;
    }
    return left.label.localeCompare(right.label);
  });
};

const resolveVisibleColumns = (
  attributes: DatabaseAttributeMeta[],
  configColumns: string[],
  visibleColumnKeys?: string[],
) => {
  const available = new Map(attributes.map((attribute) => [toLowerKey(attribute.key), attribute.key]));
  if (visibleColumnKeys) {
    return dedupeByCaseInsensitiveKey(
      visibleColumnKeys
        .map((key) => available.get(toLowerKey(key)) ?? null)
        .filter((key): key is string => Boolean(key)),
    );
  }

  const requestedFromConfig = configColumns
    .map((key) => available.get(toLowerKey(key)) ?? null)
    .filter((key): key is string => Boolean(key));

  if (requestedFromConfig.length > 0) {
    return dedupeByCaseInsensitiveKey(requestedFromConfig);
  }

  const defaultColumns = attributes
    .slice(0, 6)
    .map((attribute) => attribute.key);
  return dedupeByCaseInsensitiveKey(defaultColumns);
};

const cloneFilterGroup = (group: DatabaseFilterGroup): DatabaseFilterGroup => ({
  ...group,
  rules: group.rules.map((entry) =>
    "rules" in entry
      ? cloneFilterGroup(entry)
      : { ...entry }),
});

export const buildDatabaseStoreSnapshot = (
  params: BuildDatabaseStoreSnapshotParams,
): DatabaseStoreSnapshot => {
  const rawRecords = params.records;
  const normalizedRecords = params.records;
  const preferredOrder = dedupeByCaseInsensitiveKey([
    ...params.config.columns,
    ...(params.visibleColumnKeys ?? []),
  ]);

  const attributeRegistry = buildAttributeRegistry(params.records, preferredOrder);
  const activeFilters = params.activeFilters
    ? cloneFilterGroup(params.activeFilters)
    : cloneFilterGroup(params.config.filters);
  const activeSorts = [...(params.activeSorts ?? params.config.sort)].map((rule) => ({ ...rule }));
  const visibleColumnKeys = resolveVisibleColumns(
    attributeRegistry,
    params.config.columns,
    params.visibleColumnKeys,
  );

  const filteredRecords = applyDatabaseFilters(
    normalizedRecords,
    activeFilters,
    attributeRegistry,
    params.searchQuery,
    visibleColumnKeys,
  );

  const visibleRecords = applyDatabaseSorts(
    filteredRecords,
    activeSorts,
    attributeRegistry,
  );

  return {
    rawRecords,
    normalizedRecords,
    visibleRecords,
    attributeRegistry,
    activeFilters,
    activeSorts,
    visibleColumnKeys,
    currentView: params.config.view.type,
    selectionState: {
      selectedRecordIds: [],
    },
    uiState: {
      searchQuery: params.searchQuery,
      loading: Boolean(params.loading),
      warning: params.warning ?? null,
      error: params.error ?? null,
    },
  };
};
