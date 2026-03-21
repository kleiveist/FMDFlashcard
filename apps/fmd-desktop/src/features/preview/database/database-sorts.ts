/**
 * @file apps/fmd-desktop/src/features/preview/database/database-sorts.ts
 *
 * Type-aware multi-level sorting for database records.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
  type DatabaseSortRule,
} from "./database-types";

const defaultCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: false,
});

const naturalCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

const isEmptyValue = (value: unknown) =>
  value === null ||
  typeof value === "undefined" ||
  (typeof value === "string" && value.trim().length === 0) ||
  (Array.isArray(value) && value.length === 0);

const toNumeric = (value: unknown) => {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  if (value && typeof value === "object") {
    if ("ratio" in value && typeof (value as { ratio?: unknown }).ratio === "number") {
      return (value as { ratio: number }).ratio;
    }
    if ("value" in value && typeof (value as { value?: unknown }).value === "number") {
      return (value as { value: number }).value;
    }
    if ("rank" in value && typeof (value as { rank?: unknown }).rank === "number") {
      return (value as { rank: number }).rank;
    }
  }
  return Number.NaN;
};

const toTimestamp = (value: unknown) => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

const toText = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry)).join(" ");
  }
  if (typeof value === "object") {
    if ("raw" in (value as Record<string, unknown>)) {
      return String((value as { raw?: unknown }).raw ?? "");
    }
    return JSON.stringify(value);
  }
  return String(value);
};

const compareByType = (
  left: DatabaseNormalizedFieldValue,
  right: DatabaseNormalizedFieldValue,
  type: DatabaseFieldType,
  natural: boolean,
) => {
  switch (type) {
    case "number":
    case "percent":
    case "score":
    case "rating":
    case "progress": {
      const leftNumber = toNumeric(left);
      const rightNumber = toNumeric(right);
      if (!Number.isFinite(leftNumber) && !Number.isFinite(rightNumber)) {
        return 0;
      }
      if (!Number.isFinite(leftNumber)) {
        return -1;
      }
      if (!Number.isFinite(rightNumber)) {
        return 1;
      }
      return leftNumber - rightNumber;
    }
    case "date":
    case "datetime": {
      const leftTime = toTimestamp(left);
      const rightTime = toTimestamp(right);
      if (!Number.isFinite(leftTime) && !Number.isFinite(rightTime)) {
        return 0;
      }
      if (!Number.isFinite(leftTime)) {
        return -1;
      }
      if (!Number.isFinite(rightTime)) {
        return 1;
      }
      return leftTime - rightTime;
    }
    default: {
      const leftText = toText(left);
      const rightText = toText(right);
      return (natural ? naturalCollator : defaultCollator).compare(leftText, rightText);
    }
  }
};

const compareWithNullHandling = (
  left: DatabaseNormalizedFieldValue,
  right: DatabaseNormalizedFieldValue,
  nulls: "first" | "last" | undefined,
) => {
  const leftEmpty = isEmptyValue(left);
  const rightEmpty = isEmptyValue(right);
  if (!leftEmpty && !rightEmpty) {
    return 0;
  }
  if (leftEmpty && rightEmpty) {
    return 0;
  }
  if (nulls === "first") {
    return leftEmpty ? -1 : 1;
  }
  return leftEmpty ? 1 : -1;
};

const getFieldValue = (record: DatabaseRecord, field: string) =>
  record.normalizedFields[field] ?? null;

const compareByRule = (
  leftRecord: DatabaseRecord,
  rightRecord: DatabaseRecord,
  rule: DatabaseSortRule,
  attributeByKey: Map<string, DatabaseAttributeMeta>,
) => {
  const left = getFieldValue(leftRecord, rule.field);
  const right = getFieldValue(rightRecord, rule.field);

  const nullCompare = compareWithNullHandling(left, right, rule.nulls);
  if (nullCompare !== 0) {
    return rule.dir === "desc" ? -nullCompare : nullCompare;
  }

  const type = attributeByKey.get(rule.field)?.type ?? "text";
  const compare = compareByType(left, right, type, Boolean(rule.natural));
  if (compare === 0) {
    return 0;
  }
  return rule.dir === "desc" ? -compare : compare;
};

export const applyDatabaseSorts = (
  records: DatabaseRecord[],
  sortRules: DatabaseSortRule[],
  attributes: DatabaseAttributeMeta[],
) => {
  if (sortRules.length === 0) {
    return records;
  }

  const attributeByKey = new Map(attributes.map((attribute) => [attribute.key, attribute]));

  return [...records].sort((left, right) => {
    for (const rule of sortRules) {
      const compare = compareByRule(left, right, rule, attributeByKey);
      if (compare !== 0) {
        return compare;
      }
    }
    return left.relativePath.localeCompare(right.relativePath);
  });
};
