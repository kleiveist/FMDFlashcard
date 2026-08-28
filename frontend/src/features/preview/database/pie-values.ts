/**
 * @file apps/fmd-desktop/src/features/preview/database/pie-values.ts
 *
 * Shared Pie grouping labels and value-option helpers.
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

export type DatabasePieValueOption = {
  value: string;
  count: number;
};

export const DATABASE_PIE_EMPTY_LABEL = "(leer)";

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

export const normalizeDatabasePieExcludedValues = (
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

export const toDatabasePieLabel = (
  attributeKey: string,
  value: DatabaseNormalizedFieldValue,
  monitoringProfiles: MonitoringRenderProfile[],
): string => {
  const monitoringText = formatMonitoringCompactText(
    renderMonitoringValue({
      attributeKey,
      value,
      profiles: monitoringProfiles,
    }),
    value,
  ).trim();
  if (monitoringText) {
    return monitoringText;
  }
  if (value === null || typeof value === "undefined") {
    return DATABASE_PIE_EMPTY_LABEL;
  }
  if (Array.isArray(value)) {
    const normalized = value
      .map((entry) => String(entry).trim())
      .filter(Boolean);
    return normalized.length > 0 ? normalized.join(", ") : DATABASE_PIE_EMPTY_LABEL;
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "object" && "raw" in value) {
    const raw = String(value.raw ?? "").trim();
    return raw || DATABASE_PIE_EMPTY_LABEL;
  }
  const text = String(value).trim();
  return text || DATABASE_PIE_EMPTY_LABEL;
};

export const getDatabasePieGroupLabels = (
  attributeKey: string,
  groupType: DatabaseAttributeMeta["type"],
  value: DatabaseNormalizedFieldValue,
  monitoringProfiles: MonitoringRenderProfile[],
): string[] => {
  if (groupType === "tags" || groupType === "multiselect") {
    if (Array.isArray(value)) {
      const labels = value
        .map((entry) => String(entry).trim())
        .filter(Boolean);
      return labels.length > 0 ? labels : [DATABASE_PIE_EMPTY_LABEL];
    }
    if (typeof value === "string") {
      const labels = value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
      return labels.length > 0 ? labels : [DATABASE_PIE_EMPTY_LABEL];
    }
    return [DATABASE_PIE_EMPTY_LABEL];
  }
  return [toDatabasePieLabel(attributeKey, value, monitoringProfiles)];
};

export const buildDatabasePieValueOptions = ({
  records,
  groupAttribute,
  monitoringProfiles = [],
}: {
  records: DatabaseRecord[];
  groupAttribute: DatabaseAttributeMeta | null;
  monitoringProfiles?: MonitoringRenderProfile[];
}): DatabasePieValueOption[] => {
  if (!groupAttribute) {
    return [];
  }

  const countsByValue = new Map<string, number>();
  records.forEach((record) => {
    getDatabasePieGroupLabels(
      groupAttribute.key,
      groupAttribute.type,
      getRecordValueByField(record, groupAttribute.key),
      monitoringProfiles,
    ).forEach((label) => {
      countsByValue.set(label, (countsByValue.get(label) ?? 0) + 1);
    });
  });

  return Array.from(countsByValue.entries()).map(([value, count]) => ({
    value,
    count,
  }));
};
