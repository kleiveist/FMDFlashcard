/**
 * @file apps/fmd-desktop/src/features/preview/database/database-store.ts
 *
 * Derives database registry and visible rows from records + config/UI state.
 */

import {
  applyDatabaseFilters,
} from "./database-filters";
import {
  evaluateDatabaseAggregationFormula,
  LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE,
} from "./database-formulas";
import {
  inferFieldType,
  normalizeFieldValueByType,
  resolveFieldCompatibility,
} from "./database-normalizers";
import { normalizeDatabaseFormulaDefinitionV1 } from "../formula/database-formula-types";
import { applyDatabaseSorts } from "./database-sorts";
import {
  type DatabaseAttributeMeta,
  type DatabaseBlockConfig,
  type DatabaseFieldDefinition,
  type DatabaseFilterGroup,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
  type DatabaseSortRule,
  type DatabaseStoreSnapshot,
} from "./database-types";

type BuildDatabaseStoreSnapshotParams = {
  records: DatabaseRecord[];
  historyRecords?: DatabaseRecord[];
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
    formulaDefinition: null,
    formula: null,
    legacyFormulaIncompatible: false,
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

const buildInferredAttributeRegistry = (records: DatabaseRecord[]): DatabaseAttributeMeta[] => {
  const systemKeys = getSystemKeys(records);
  const frontmatterKeys = getFrontmatterKeys(records)
    .filter((key) => !systemKeys.some((systemKey) => toLowerKey(systemKey) === toLowerKey(key)));

  return [
    ...systemKeys.map((key) => buildAttributeMeta(key, "system", records)),
    ...frontmatterKeys.map((key) => buildAttributeMeta(key, "frontmatter", records)),
  ];
};

const mergeConfiguredFieldDefinitions = (
  attributes: DatabaseAttributeMeta[],
  fieldDefinitions: DatabaseFieldDefinition[],
): DatabaseAttributeMeta[] => {
  const merged = [...attributes];

  fieldDefinitions.forEach((definition) => {
    const normalizedKey = toLowerKey(definition.key);
    if (!normalizedKey) {
      return;
    }

    const existingIndex = merged.findIndex((attribute) => toLowerKey(attribute.key) === normalizedKey);
    const compatibility = resolveFieldCompatibility(definition.type);

    const nextMeta: DatabaseAttributeMeta = {
      key: definition.key,
      label: definition.label?.trim() || definition.key,
      type: definition.type,
      origin: definition.origin,
      formulaDefinition: definition.formulaDefinition ?? null,
      formula: definition.formula ?? null,
      legacyFormulaIncompatible: Boolean(
        definition.type === "formula" &&
          definition.formula &&
          !definition.formulaDefinition,
      ),
      editable: definition.origin === "frontmatter",
      sortable: true,
      filterable: true,
      aggregatable: compatibility.supportsAggregation,
      viewCompatibility: compatibility,
    };

    if (existingIndex >= 0) {
      merged[existingIndex] = {
        ...merged[existingIndex],
        ...nextMeta,
      };
      return;
    }

    merged.push(nextMeta);
  });

  return merged;
};

const sortAttributeRegistry = (
  attributes: DatabaseAttributeMeta[],
  preferredColumnOrder: string[],
) => {
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
      if (left.origin === "system") {
        return -1;
      }
      if (right.origin === "system") {
        return 1;
      }
      if (left.origin === "formula") {
        return 1;
      }
      if (right.origin === "formula") {
        return -1;
      }
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

const getCaseInsensitiveFieldValue = (
  normalizedFields: Record<string, DatabaseNormalizedFieldValue>,
  field: string,
) => {
  if (field in normalizedFields) {
    return normalizedFields[field];
  }
  const normalizedField = toLowerKey(field);
  const matchedKey = Object.keys(normalizedFields)
    .find((key) => toLowerKey(key) === normalizedField);
  return matchedKey ? normalizedFields[matchedKey] : null;
};

const evaluateFormulaFields = (
  records: DatabaseRecord[],
  fieldDefinitions: DatabaseFieldDefinition[],
  historyRecords?: DatabaseRecord[],
): DatabaseRecord[] => {
  const formulaKeysFromConfig = new Set(
    fieldDefinitions
      .filter((definition) => definition.type === "formula")
      .map((definition) => toLowerKey(definition.key)),
  );

  const frontmatterFormulaEvaluatedRecords = records.map((record) => {
    const nextNormalizedFields: Record<string, DatabaseNormalizedFieldValue> = {
      ...record.normalizedFields,
    };

    Object.entries(record.frontmatter).forEach(([key, rawValue]) => {
      const parsedDefinition = normalizeDatabaseFormulaDefinitionV1(rawValue);
      const normalizedKey = toLowerKey(key);
      const isFormulaByKey = normalizedKey.startsWith("f-");

      if (!parsedDefinition && !isFormulaByKey) {
        return;
      }
      if (formulaKeysFromConfig.has(normalizedKey)) {
        return;
      }

      if (parsedDefinition) {
        const evaluated = evaluateDatabaseAggregationFormula({
          definition: parsedDefinition,
          records,
          currentRecord: {
            ...record,
            normalizedFields: nextNormalizedFields,
          },
          historyRecords,
          getFieldValue: (targetRecord, candidateKey) =>
            getCaseInsensitiveFieldValue(targetRecord.normalizedFields, candidateKey),
        });
        nextNormalizedFields[key] = normalizeFieldValueByType("formula", evaluated);
        return;
      }

      if (typeof rawValue === "string" && rawValue.trim().length > 0) {
        nextNormalizedFields[key] = LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE;
      } else {
        nextNormalizedFields[key] = null;
      }
    });

    return {
      ...record,
      normalizedFields: nextNormalizedFields,
    };
  });

  if (fieldDefinitions.length === 0) {
    return frontmatterFormulaEvaluatedRecords;
  }

  const formulaDefinitions = fieldDefinitions.filter((definition) => definition.type === "formula");

  if (formulaDefinitions.length === 0) {
    return frontmatterFormulaEvaluatedRecords;
  }

  return frontmatterFormulaEvaluatedRecords.map((record) => {
    const nextNormalizedFields: Record<string, DatabaseNormalizedFieldValue> = {
      ...record.normalizedFields,
    };

    formulaDefinitions.forEach((definition) => {
      if (definition.formulaDefinition) {
        const evaluated = evaluateDatabaseAggregationFormula({
          definition: definition.formulaDefinition,
          records: frontmatterFormulaEvaluatedRecords,
          currentRecord: {
            ...record,
            normalizedFields: nextNormalizedFields,
          },
          historyRecords,
          getFieldValue: (targetRecord, key) =>
            getCaseInsensitiveFieldValue(targetRecord.normalizedFields, key),
        });
        nextNormalizedFields[definition.key] = normalizeFieldValueByType(definition.type, evaluated);
        return;
      }

      if (definition.formula && definition.formula.trim().length > 0) {
        nextNormalizedFields[definition.key] = LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE;
        return;
      }

      nextNormalizedFields[definition.key] = null;
    });

    return {
      ...record,
      normalizedFields: nextNormalizedFields,
    };
  });
};

export const buildDatabaseStoreSnapshot = (
  params: BuildDatabaseStoreSnapshotParams,
): DatabaseStoreSnapshot => {
  const rawRecords = params.records;
  const preferredOrder = dedupeByCaseInsensitiveKey([
    ...params.config.columns,
    ...(params.visibleColumnKeys ?? []),
  ]);

  const inferredAttributes = buildInferredAttributeRegistry(params.records);
  const configuredFields = params.config.fields ?? [];
  const mergedAttributes = mergeConfiguredFieldDefinitions(inferredAttributes, configuredFields);
  const attributeRegistry = sortAttributeRegistry(mergedAttributes, preferredOrder);

  const normalizedRecords = evaluateFormulaFields(
    params.records,
    configuredFields,
    params.historyRecords,
  );

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
