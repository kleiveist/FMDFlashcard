/**
 * @file apps/fmd-desktop/src/features/preview/database/database-formulas.ts
 *
 * Aggregation-only formula engine for structured formula definitions.
 */

import {
  type DatabaseFormulaDefinitionV1,
  type DatabaseFormulaGroupedCountEntry,
  type DatabaseFormulaShortTextRule,
} from "../formula/database-formula-types";
import { resolveFormulaSourceRecords } from "../formula/formula-source-resolver";
import { type DatabaseNormalizedFieldValue, type DatabaseRecord } from "./database-types";

export const LEGACY_DATABASE_FORMULA_INCOMPATIBLE_MESSAGE = "Legacy-Formel inkompatibel";

type EvaluateDatabaseAggregationFormulaParams = {
  definition: DatabaseFormulaDefinitionV1;
  records: DatabaseRecord[];
  currentRecord: DatabaseRecord;
  historyRecords?: DatabaseRecord[];
  getFieldValue?: (record: DatabaseRecord, key: string) => DatabaseNormalizedFieldValue;
};

const numericPattern = /^[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)$/;
const numericCorePattern = /[-+]?(?:\d+(?:[.,]\d+)?|\.\d+)/g;

const toLower = (value: string) => value.trim().toLowerCase();

const defaultGetFieldValue = (
  record: DatabaseRecord,
  key: string,
): DatabaseNormalizedFieldValue => {
  if (key in record.normalizedFields) {
    return record.normalizedFields[key] ?? null;
  }
  const normalizedKey = toLower(key);
  const matchedKey = Object.keys(record.normalizedFields).find(
    (entryKey) => toLower(entryKey) === normalizedKey,
  );
  return matchedKey ? (record.normalizedFields[matchedKey] ?? null) : null;
};

const toFlatValues = (value: DatabaseNormalizedFieldValue): DatabaseNormalizedFieldValue[] => {
  if (value === null || typeof value === "undefined") {
    return [];
  }
  if (Array.isArray(value)) {
    return value as DatabaseNormalizedFieldValue[];
  }
  return [value];
};

const collectFormulaValues = ({
  records,
  definition,
  getFieldValue,
}: {
  records: DatabaseRecord[];
  definition: DatabaseFormulaDefinitionV1;
  getFieldValue: (record: DatabaseRecord, key: string) => DatabaseNormalizedFieldValue;
}) => {
  const values: DatabaseNormalizedFieldValue[] = [];
  records.forEach((record) => {
    definition.attributeKeys.forEach((attributeKey) => {
      toFlatValues(getFieldValue(record, attributeKey)).forEach((entry) => {
        values.push(entry);
      });
    });
  });
  return values;
};

const isGroupedCountEntry = (value: unknown): value is DatabaseFormulaGroupedCountEntry =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as { value?: unknown }).value === "string" &&
  typeof (value as { count?: unknown }).count === "number";

const toGroupableText = (value: DatabaseNormalizedFieldValue): string => {
  if (value === null || typeof value === "undefined") {
    return "";
  }
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (Array.isArray(value)) {
    return value
      .map((entry) => toGroupableText(entry as DatabaseNormalizedFieldValue))
      .filter((entry) => entry.length > 0)
      .join(" ");
  }
  if (typeof value === "object") {
    if (isGroupedCountEntry(value)) {
      return value.value;
    }
    if ("raw" in value) {
      const raw = String((value as { raw?: unknown }).raw ?? "").trim();
      if (raw) {
        return raw;
      }
    }
    return JSON.stringify(value);
  }
  return String(value).trim();
};

const parseNumericFromStringWithRule = (
  raw: string,
  shortTextRule: DatabaseFormulaShortTextRule,
): number | null => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  if (numericPattern.test(trimmed)) {
    const numeric = Number(trimmed.replace(",", "."));
    return Number.isFinite(numeric) ? numeric : null;
  }

  if (trimmed.length > shortTextRule.maxChars) {
    return null;
  }
  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > shortTextRule.maxTokens) {
    return null;
  }

  const numericMatches = trimmed.match(numericCorePattern) ?? [];
  if (shortTextRule.requireSingleNumericCore && numericMatches.length !== 1) {
    return null;
  }
  if (numericMatches.length === 0) {
    return null;
  }

  const numeric = Number((numericMatches[0] ?? "").replace(",", "."));
  return Number.isFinite(numeric) ? numeric : null;
};

const toNumericValue = (
  value: DatabaseNormalizedFieldValue,
  shortTextRule: DatabaseFormulaShortTextRule,
): number | null => {
  if (value === null || typeof value === "undefined") {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === "string") {
    return parseNumericFromStringWithRule(value, shortTextRule);
  }
  if (value instanceof Date) {
    return null;
  }
  if (Array.isArray(value)) {
    return null;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (typeof value === "object") {
    const withValue = value as { value?: unknown; rank?: unknown; raw?: unknown };
    if (typeof withValue.value === "number" && Number.isFinite(withValue.value)) {
      return withValue.value;
    }
    if (typeof withValue.rank === "number" && Number.isFinite(withValue.rank)) {
      return withValue.rank;
    }
    if (typeof withValue.raw === "string") {
      return parseNumericFromStringWithRule(withValue.raw, shortTextRule);
    }
    return null;
  }
  return null;
};

const evaluateCount = (values: DatabaseNormalizedFieldValue[]) =>
  values.reduce<number>((count, value) => {
    const text = toGroupableText(value);
    return text ? count + 1 : count;
  }, 0);

const evaluateGroupCount = (
  values: DatabaseNormalizedFieldValue[],
): DatabaseFormulaGroupedCountEntry[] => {
  const buckets = new Map<string, { count: number; index: number }>();
  values.forEach((value, index) => {
    const normalized = toGroupableText(value);
    if (!normalized) {
      return;
    }
    const existing = buckets.get(normalized);
    if (existing) {
      existing.count += 1;
      return;
    }
    buckets.set(normalized, {
      count: 1,
      index,
    });
  });

  return Array.from(buckets.entries())
    .map(([value, bucket]) => ({
      value,
      count: bucket.count,
      index: bucket.index,
    }))
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return left.index - right.index;
    })
    .map(({ value, count }) => ({ value, count }));
};

const evaluateSum = (
  values: DatabaseNormalizedFieldValue[],
  shortTextRule: DatabaseFormulaShortTextRule,
) => {
  const numericValues = values
    .map((value) => toNumericValue(value, shortTextRule))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length === 0) {
    return null;
  }

  return numericValues.reduce((sum, value) => sum + value, 0);
};

const evaluateAvg = (
  values: DatabaseNormalizedFieldValue[],
  shortTextRule: DatabaseFormulaShortTextRule,
) => {
  const numericValues = values
    .map((value) => toNumericValue(value, shortTextRule))
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (numericValues.length === 0) {
    return null;
  }

  const total = numericValues.reduce((sum, value) => sum + value, 0);
  return total / numericValues.length;
};

export const evaluateDatabaseAggregationFormula = ({
  definition,
  records,
  currentRecord,
  historyRecords,
  getFieldValue,
}: EvaluateDatabaseAggregationFormulaParams): DatabaseNormalizedFieldValue => {
  const scopedRecords = resolveFormulaSourceRecords({
    source: definition.source,
    records,
    currentRecord,
    historyRecords,
  });

  const readValue = getFieldValue ?? defaultGetFieldValue;
  const values = collectFormulaValues({
    records: scopedRecords,
    definition,
    getFieldValue: readValue,
  });

  switch (definition.operation) {
    case "sum":
      return evaluateSum(values, definition.shortTextRule);
    case "avg":
      return evaluateAvg(values, definition.shortTextRule);
    case "group_count":
      return evaluateGroupCount(values);
    case "count":
    default:
      return evaluateCount(values);
  }
};
