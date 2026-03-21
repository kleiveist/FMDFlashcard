/**
 * @file apps/fmd-desktop/src/features/preview/database/database-filters.ts
 *
 * Type-aware filtering for database block records.
 */

import {
  type DatabaseAttributeMeta,
  type DatabaseFieldType,
  type DatabaseFilterGroup,
  type DatabaseFilterRule,
  type DatabaseNormalizedFieldValue,
  type DatabaseRecord,
} from "./database-types";

export type DatabaseFilterOperator = {
  value: string;
  label: string;
};

const textOperators: DatabaseFilterOperator[] = [
  { value: "is", label: "is" },
  { value: "is not", label: "is not" },
  { value: "contains", label: "contains" },
  { value: "does not contain", label: "does not contain" },
  { value: "starts with", label: "starts with" },
  { value: "ends with", label: "ends with" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const numberOperators: DatabaseFilterOperator[] = [
  { value: "=", label: "=" },
  { value: "!=", label: "!=" },
  { value: ">", label: ">" },
  { value: ">=", label: ">=" },
  { value: "<", label: "<" },
  { value: "<=", label: "<=" },
  { value: "between", label: "between" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const dateOperators: DatabaseFilterOperator[] = [
  { value: "is", label: "is" },
  { value: "before", label: "before" },
  { value: "after", label: "after" },
  { value: "on or before", label: "on or before" },
  { value: "on or after", label: "on or after" },
  { value: "between", label: "between" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const selectOperators: DatabaseFilterOperator[] = [
  { value: "is", label: "is" },
  { value: "is not", label: "is not" },
  { value: "any of", label: "any of" },
  { value: "none of", label: "none of" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const tagsOperators: DatabaseFilterOperator[] = [
  { value: "contains any", label: "contains any" },
  { value: "contains all", label: "contains all" },
  { value: "contains none", label: "contains none" },
  { value: "is empty", label: "is empty" },
  { value: "is not empty", label: "is not empty" },
];

const booleanOperators: DatabaseFilterOperator[] = [
  { value: "is true", label: "is true" },
  { value: "is false", label: "is false" },
  { value: "is empty", label: "is empty" },
];

const getDateTimestamp = (value: unknown) => {
  if (value instanceof Date) {
    return value.getTime();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
};

const isFilterGroupEntry = (entry: DatabaseFilterRule | DatabaseFilterGroup): entry is DatabaseFilterGroup =>
  "rules" in entry;

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
    return value.map((item) => String(item)).join(" ");
  }
  if (typeof value === "object") {
    if ("raw" in (value as Record<string, unknown>)) {
      return String((value as { raw?: unknown }).raw ?? "");
    }
    return JSON.stringify(value);
  }
  return String(value);
};

const toLower = (value: unknown) => toText(value).trim().toLowerCase();

const isEmptyValue = (value: unknown) => {
  if (value === null || typeof value === "undefined") {
    return true;
  }
  if (typeof value === "string") {
    return value.trim().length === 0;
  }
  if (Array.isArray(value)) {
    return value.length === 0;
  }
  return false;
};

const toNumericValue = (value: unknown) => {
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

const toStringList = (value: unknown) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((entry) => toText(entry).trim())
    .filter((entry) => entry.length > 0);
};

const compareNumber = (
  left: number,
  right: number,
  op: string,
  rightBoundary: number = Number.NaN,
) => {
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }
  switch (op) {
    case "=":
      return left === right;
    case "!=":
      return left !== right;
    case ">":
      return left > right;
    case ">=":
      return left >= right;
    case "<":
      return left < right;
    case "<=":
      return left <= right;
    case "between": {
      if (!Number.isFinite(rightBoundary)) {
        return false;
      }
      const min = Math.min(right, rightBoundary);
      const max = Math.max(right, rightBoundary);
      return left >= min && left <= max;
    }
    default:
      return false;
  }
};

const evaluateTextRule = (value: unknown, rule: DatabaseFilterRule) => {
  const left = toLower(value);
  const right = toLower(rule.value);
  switch (rule.op) {
    case "is":
      return left === right;
    case "is not":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "does not contain":
      return !left.includes(right);
    case "starts with":
      return left.startsWith(right);
    case "ends with":
      return left.endsWith(right);
    case "is empty":
      return isEmptyValue(value);
    case "is not empty":
      return !isEmptyValue(value);
    default:
      return true;
  }
};

const evaluateNumberRule = (value: unknown, rule: DatabaseFilterRule) => {
  if (rule.op === "is empty") {
    return isEmptyValue(value);
  }
  if (rule.op === "is not empty") {
    return !isEmptyValue(value);
  }
  const left = toNumericValue(value);
  const right = toNumericValue(rule.value);
  const rightBoundary = typeof rule.valueTo === "undefined"
    ? Number.NaN
    : toNumericValue(rule.valueTo);
  return compareNumber(left, right, rule.op, rightBoundary);
};

const evaluateDateRule = (value: unknown, rule: DatabaseFilterRule) => {
  if (rule.op === "is empty") {
    return isEmptyValue(value);
  }
  if (rule.op === "is not empty") {
    return !isEmptyValue(value);
  }

  const left = getDateTimestamp(value);
  const right = getDateTimestamp(rule.value);
  const rightBoundary = getDateTimestamp(rule.valueTo);
  if (!Number.isFinite(left) || !Number.isFinite(right)) {
    return false;
  }

  switch (rule.op) {
    case "is":
      return left === right;
    case "before":
      return left < right;
    case "after":
      return left > right;
    case "on or before":
      return left <= right;
    case "on or after":
      return left >= right;
    case "between": {
      if (!Number.isFinite(rightBoundary)) {
        return false;
      }
      const min = Math.min(right, rightBoundary);
      const max = Math.max(right, rightBoundary);
      return left >= min && left <= max;
    }
    default:
      return true;
  }
};

const evaluateSelectRule = (value: unknown, rule: DatabaseFilterRule) => {
  const left = toLower(value);
  if (rule.op === "is empty") {
    return isEmptyValue(value);
  }
  if (rule.op === "is not empty") {
    return !isEmptyValue(value);
  }

  if (rule.op === "any of" || rule.op === "none of") {
    const options = Array.isArray(rule.value)
      ? rule.value.map((entry) => toLower(entry))
      : toLower(rule.value)
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean);
    const hasMatch = options.includes(left);
    return rule.op === "any of" ? hasMatch : !hasMatch;
  }

  if (rule.op === "is") {
    return left === toLower(rule.value);
  }
  if (rule.op === "is not") {
    return left !== toLower(rule.value);
  }

  return true;
};

const evaluateTagsRule = (value: unknown, rule: DatabaseFilterRule) => {
  const leftItems = toStringList(value).map((entry) => entry.toLowerCase());
  if (rule.op === "is empty") {
    return leftItems.length === 0;
  }
  if (rule.op === "is not empty") {
    return leftItems.length > 0;
  }

  const rightItems = Array.isArray(rule.value)
    ? rule.value.map((entry) => toText(entry).trim().toLowerCase()).filter(Boolean)
    : toText(rule.value)
      .split(",")
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);

  if (rightItems.length === 0) {
    return true;
  }

  if (rule.op === "contains any") {
    return rightItems.some((entry) => leftItems.includes(entry));
  }
  if (rule.op === "contains all") {
    return rightItems.every((entry) => leftItems.includes(entry));
  }
  if (rule.op === "contains none") {
    return rightItems.every((entry) => !leftItems.includes(entry));
  }
  return true;
};

const evaluateBooleanRule = (value: unknown, rule: DatabaseFilterRule) => {
  if (rule.op === "is empty") {
    return isEmptyValue(value);
  }
  const boolValue = typeof value === "boolean"
    ? value
    : typeof value === "string"
      ? value.trim().toLowerCase() === "true"
      : false;
  if (rule.op === "is true") {
    return boolValue;
  }
  if (rule.op === "is false") {
    return !boolValue;
  }
  return true;
};

const evaluateRuleByType = (
  value: DatabaseNormalizedFieldValue,
  fieldType: DatabaseFieldType,
  rule: DatabaseFilterRule,
) => {
  switch (fieldType) {
    case "number":
    case "percent":
    case "score":
    case "rating":
    case "progress":
      return evaluateNumberRule(value, rule);
    case "date":
    case "datetime":
      return evaluateDateRule(value, rule);
    case "select":
    case "status":
      return evaluateSelectRule(value, rule);
    case "tags":
    case "multiselect":
      return evaluateTagsRule(value, rule);
    case "boolean":
      return evaluateBooleanRule(value, rule);
    default:
      return evaluateTextRule(value, rule);
  }
};

const getNormalizedFieldValue = (record: DatabaseRecord, field: string) => {
  if (field in record.normalizedFields) {
    return record.normalizedFields[field] ?? null;
  }
  const normalizedField = field.trim().toLowerCase();
  const matchedKey = Object.keys(record.normalizedFields)
    .find((key) => key.trim().toLowerCase() === normalizedField);
  return matchedKey ? record.normalizedFields[matchedKey] ?? null : null;
};

export const getFilterOperatorsForType = (type: DatabaseFieldType): DatabaseFilterOperator[] => {
  switch (type) {
    case "number":
    case "percent":
    case "score":
    case "rating":
    case "progress":
      return numberOperators;
    case "date":
    case "datetime":
      return dateOperators;
    case "select":
    case "status":
      return selectOperators;
    case "tags":
    case "multiselect":
      return tagsOperators;
    case "boolean":
      return booleanOperators;
    default:
      return textOperators;
  }
};

const evaluateFilterRule = (
  record: DatabaseRecord,
  rule: DatabaseFilterRule,
  attributeByKey: Map<string, DatabaseAttributeMeta>,
) => {
  const attribute = attributeByKey.get(rule.field.trim().toLowerCase());
  const value = getNormalizedFieldValue(record, rule.field);
  const fieldType = attribute?.type ?? "text";
  return evaluateRuleByType(value, fieldType, rule);
};

const evaluateFilterGroup = (
  record: DatabaseRecord,
  group: DatabaseFilterGroup,
  attributeByKey: Map<string, DatabaseAttributeMeta>,
): boolean => {
  if (group.rules.length === 0) {
    return true;
  }

  const evaluator = group.op === "or" ? "some" : "every";

  return group.rules[evaluator]((entry) =>
    isFilterGroupEntry(entry)
      ? evaluateFilterGroup(record, entry, attributeByKey)
      : evaluateFilterRule(record, entry, attributeByKey));
};

export const applyDatabaseFilters = (
  records: DatabaseRecord[],
  filterGroup: DatabaseFilterGroup,
  attributes: DatabaseAttributeMeta[],
  searchQuery: string,
  searchableFields?: string[],
) => {
  const attributeByKey = new Map(
    attributes.map((attribute) => [attribute.key.trim().toLowerCase(), attribute]),
  );
  const normalizedQuery = searchQuery.trim().toLowerCase();

  return records.filter((record) => {
    if (!evaluateFilterGroup(record, filterGroup, attributeByKey)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const searchFields = searchableFields && searchableFields.length > 0
      ? searchableFields
      : attributes.map((attribute) => attribute.key);

    return searchFields.some((field) =>
      toLower(getNormalizedFieldValue(record, field)).includes(normalizedQuery));
  });
};
