/**
 * @file frontend/src/features/preview/database/kanban-values.ts
 *
 * Shared Kanban grouping labels and value-option helpers.
 */

import {
  formatMonitoringCompactText,
  renderMonitoringValue,
  type MonitoringRenderProfile,
} from "../../monitoring/monitoring-render-rules";
import {
  type DatabaseAttributeMeta,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "./database-types";

export type DatabaseKanbanValueOption = {
  value: string;
  label: string;
  count: number;
};

export const DATABASE_KANBAN_EMPTY_LABEL = "(leer)";

const toLower = (value: string) => value.trim().toLowerCase();

const getRecordValueByField = (
  record: DatabaseRecord,
  field: string,
): DatabaseNormalizedFieldValue => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = toLower(field);
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => toLower(key) === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

export const normalizeDatabaseKanbanExcludedValues = (
  values: string[] | null | undefined,
): string[] => {
  const seen = new Set<string>();
  const next: string[] = [];
  (values ?? []).forEach((value) => {
    const trimmed = String(value ?? "").trim();
    if (!trimmed || seen.has(trimmed)) {
      return;
    }
    seen.add(trimmed);
    next.push(trimmed);
  });
  return next;
};

export const stringifyDatabaseKanbanGroupValue = (
  value: DatabaseNormalizedFieldValue,
) => {
  if (value === null || typeof value === "undefined") {
    return DATABASE_KANBAN_EMPTY_LABEL;
  }
  if (Array.isArray(value)) {
    return value.length > 0
      ? value.map((entry) => String(entry).trim()).filter(Boolean).join(", ")
      : DATABASE_KANBAN_EMPTY_LABEL;
  }
  if (typeof value === "object" && "raw" in value) {
    const raw = String(value.raw ?? "").trim();
    return raw || DATABASE_KANBAN_EMPTY_LABEL;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  const text = String(value).trim();
  return text || DATABASE_KANBAN_EMPTY_LABEL;
};

export const formatDatabaseKanbanGroupLabel = (
  key: string,
  rawValue: string,
  monitoringProfiles: MonitoringRenderProfile[],
) => {
  const monitoringText = formatMonitoringCompactText(
    renderMonitoringValue({
      attributeKey: key,
      value: rawValue === DATABASE_KANBAN_EMPTY_LABEL ? "" : rawValue,
      profiles: monitoringProfiles,
    }),
    rawValue,
  );
  const trimmed = monitoringText.trim();
  return trimmed || rawValue;
};

export const buildDatabaseKanbanValueOptions = ({
  records,
  groupAttribute,
  monitoringProfiles = [],
}: {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  monitoringProfiles?: MonitoringRenderProfile[];
}): DatabaseKanbanValueOption[] => {
  if (!groupAttribute) {
    return [];
  }

  const countsByValue = new Map<string, number>();
  records.forEach((record) => {
    const value = stringifyDatabaseKanbanGroupValue(
      getRecordValueByField(record, groupAttribute.key),
    );
    countsByValue.set(value, (countsByValue.get(value) ?? 0) + 1);
  });

  return Array.from(countsByValue.entries())
    .map(([value, count]) => ({
      value,
      label: formatDatabaseKanbanGroupLabel(
        groupAttribute.key,
        value,
        monitoringProfiles,
      ),
      count,
    }))
    .sort((left, right) =>
      left.label.localeCompare(right.label, undefined, { sensitivity: "base" }));
};
