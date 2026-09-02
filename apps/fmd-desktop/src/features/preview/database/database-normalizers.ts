/**
 * @file apps/fmd-desktop/src/features/preview/database/database-normalizers.ts
 *
 * Field type inference and value normalization for database records.
 */

import { normalizeRelativePath } from "../../../lib/path";
import {
  type DatabaseFieldType,
  type DatabaseNormalizedFieldValue,
  type DatabasePercentValue,
  type DatabaseRecord,
  type DatabaseScoreValue,
  type DatabaseStatusValue,
  type DatabaseViewCompatibility,
} from "./database-types";
import {
  normalizeDatabaseFormulaDefinitionV1,
  type DatabaseFormulaGroupedCountEntry,
} from "../formula/database-formula-types";
import {
  isDateTimeValue,
  isDateValue,
  isTimeValue,
  normalizeDateTimeValue,
  normalizeDateValue,
  normalizeTimeValue,
} from "./database-time";
import { resolveMonitoringAliasType } from "../../monitoring/monitoring-render-rules";

const scorePattern = /^\s*(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)\s*$/;
const percentPattern = /^\s*(-?\d+(?:\.\d+)?)\s*%?\s*$/;
const statusPattern = /^\s*([0-9A-Za-z!]+)(?:\s+(.+))?$/u;
const wikilinkPattern = /^\s*\[\[[^\]]+\]\]\s*$/;
const imageExtensionPattern = /\.(png|jpe?g|webp|gif|svg)$/i;

const textCompatibility: DatabaseViewCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: true,
  supportsTimeline: false,
  supportsPieGrouping: true,
  supportsAggregation: false,
};

const numericCompatibility: DatabaseViewCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: false,
  supportsTimeline: false,
  supportsPieGrouping: false,
  supportsAggregation: true,
};

const dateCompatibility: DatabaseViewCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: false,
  supportsTimeline: true,
  supportsPieGrouping: false,
  supportsAggregation: false,
};

const tagCompatibility: DatabaseViewCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: true,
  supportsTimeline: false,
  supportsPieGrouping: true,
  supportsAggregation: false,
};

const linkCompatibility: DatabaseViewCompatibility = {
  supportsTable: true,
  supportsKanbanGrouping: false,
  supportsTimeline: false,
  supportsPieGrouping: false,
  supportsAggregation: false,
};

export const parseScoreValue = (value: unknown): DatabaseScoreValue | null => {
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(scorePattern);
  if (!match) {
    return null;
  }
  const numerator = Number(match[1] ?? "");
  const denominator = Number(match[2] ?? "");
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return null;
  }
  return {
    raw: value,
    value: numerator,
    max: denominator,
    ratio: numerator / denominator,
  };
};

export const parsePercentValue = (value: unknown): DatabasePercentValue | null => {
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? {
          raw: String(value),
          value,
        }
      : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.match(percentPattern);
  if (!match) {
    return null;
  }
  const parsed = Number(match[1] ?? "");
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return {
    raw: value,
    value: parsed,
  };
};

export const parseStatusValue = (value: unknown): DatabaseStatusValue | null => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    const rank = Math.floor(value);
    return {
      raw: String(value),
      code: String(rank),
      rank,
      label: String(rank),
    };
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(statusPattern);
  if (!match) {
    return {
      raw: value,
      code: trimmed,
      label: trimmed,
    };
  }
  const code = String(match[1] ?? "").trim();
  const rank = /^\d+$/.test(code) ? Number(code) : Number.NaN;
  const label = (match[2] ?? "").trim() || code;
  const emojiMatch = label.match(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/u);
  return {
    raw: value,
    code,
    rank: Number.isFinite(rank) ? rank : undefined,
    label,
    emoji: emojiMatch?.[0],
  };
};

const parseDateLikeValue = (value: unknown) => {
  if (value instanceof Date) {
    const timestamp = value.getTime();
    return Number.isFinite(timestamp) ? new Date(timestamp) : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalizedDate = normalizeDateValue(trimmed);
  if (normalizedDate) {
    const [yearText, monthText, dayText] = normalizedDate.split("-");
    const year = Number(yearText ?? Number.NaN);
    const month = Number(monthText ?? Number.NaN);
    const day = Number(dayText ?? Number.NaN);
    return new Date(year, month - 1, day, 0, 0, 0, 0);
  }
  const normalizedDateTime = normalizeDateTimeValue(trimmed);
  if (normalizedDateTime) {
    const [datePart, timePart] = normalizedDateTime.split("T");
    const [yearText, monthText, dayText] = (datePart ?? "").split("-");
    const [hourText, minuteText] = (timePart ?? "").split(":");
    const year = Number(yearText ?? Number.NaN);
    const month = Number(monthText ?? Number.NaN);
    const day = Number(dayText ?? Number.NaN);
    const hours = Number(hourText ?? Number.NaN);
    const minutes = Number(minuteText ?? Number.NaN);
    return new Date(year, month - 1, day, hours, minutes, 0, 0);
  }
  return null;
};

const looksLikeLongText = (value: string) => value.length > 160 || value.includes("\n");

const isBooleanLike = (value: unknown): value is boolean => typeof value === "boolean";

const isTagsField = (key: string) => key.trim().toLowerCase() === "tags";
const isFormulaField = (key: string) => key.trim().toLowerCase().startsWith("f-");

const isLinkField = (value: unknown) => typeof value === "string" && wikilinkPattern.test(value);

const isImageField = (value: unknown) =>
  typeof value === "string" && imageExtensionPattern.test(value);

const asArrayOfStrings = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  const next = value
    .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
    .filter((entry) => entry.length > 0);
  return next.length > 0 ? next : [];
};

const isFormulaGroupedCountEntry = (value: unknown): value is DatabaseFormulaGroupedCountEntry =>
  Boolean(value) &&
  typeof value === "object" &&
  typeof (value as { value?: unknown }).value === "string" &&
  typeof (value as { count?: unknown }).count === "number";

export const inferFieldType = (key: string, value: unknown): DatabaseFieldType => {
  if (normalizeDatabaseFormulaDefinitionV1(value)) {
    return "formula";
  }
  if (isFormulaField(key)) {
    return "formula";
  }

  const monitoringAliasType = resolveMonitoringAliasType(key);

  const arrayValue = asArrayOfStrings(value);
  if (arrayValue) {
    return isTagsField(key) ? "tags" : "multiselect";
  }

  if (monitoringAliasType === "score") {
    return "score";
  }
  if (monitoringAliasType === "percent") {
    return "percent";
  }
  if (monitoringAliasType === "status") {
    return "status";
  }

  if (isBooleanLike(value)) {
    return "boolean";
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return "number";
  }

  if (parseScoreValue(value)) {
    return "score";
  }

  if (typeof value === "string" && value.includes("%") && parsePercentValue(value)) {
    return "percent";
  }

  if (parseStatusValue(value)?.rank !== undefined) {
    return "status";
  }

  const dateLike = parseDateLikeValue(value);
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (isTimeValue(trimmed)) {
      return "time";
    }
    if (isDateTimeValue(trimmed)) {
      return "datetime";
    }
    if (isDateValue(trimmed)) {
      return "date";
    }
  }
  if (dateLike) {
    return "datetime";
  }

  if (isLinkField(value)) {
    return "link";
  }

  if (isImageField(value)) {
    return "image";
  }

  if (typeof value === "string" && looksLikeLongText(value)) {
    return "longtext";
  }

  return "text";
};

export const resolveFieldCompatibility = (type: DatabaseFieldType): DatabaseViewCompatibility => {
  switch (type) {
    case "number":
    case "unit":
    case "percent":
    case "score":
    case "rating":
    case "progress":
      return numericCompatibility;
    case "date":
    case "time":
    case "datetime":
    case "duration":
      return dateCompatibility;
    case "tags":
    case "multiselect":
    case "select":
    case "status":
      return tagCompatibility;
    case "link":
    case "file":
    case "image":
    case "relation":
      return linkCompatibility;
    default:
      return textCompatibility;
  }
};

export const normalizeFieldValueByType = (
  type: DatabaseFieldType,
  value: unknown,
): DatabaseNormalizedFieldValue => {
  if (value === null || typeof value === "undefined") {
    return null;
  }

  if (type === "score") {
    return parseScoreValue(value);
  }

  if (type === "percent") {
    return parsePercentValue(value);
  }

  if (type === "status") {
    return parseStatusValue(value);
  }

  if (type === "date" || type === "datetime") {
    return parseDateLikeValue(value);
  }

  if (type === "time") {
    if (typeof value === "string") {
      return normalizeTimeValue(value) ?? value;
    }
    if (value instanceof Date && Number.isFinite(value.getTime())) {
      return `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}`;
    }
    return String(value);
  }

  if (type === "multiselect" || type === "tags") {
    const list = asArrayOfStrings(value);
    return list ?? [];
  }

  if (type === "formula") {
    if (normalizeDatabaseFormulaDefinitionV1(value)) {
      return null;
    }
    if (Array.isArray(value)) {
      const groupedEntries = value
        .filter((entry) => isFormulaGroupedCountEntry(entry))
        .map((entry) => ({
          value: entry.value,
          count: entry.count,
        }));
      if (groupedEntries.length === value.length) {
        return groupedEntries;
      }
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "string") {
      return value;
    }
    if (value === null || typeof value === "undefined") {
      return null;
    }
    return String(value);
  }

  if ((type === "number" || type === "unit") && typeof value === "number") {
    return value;
  }

  if (type === "boolean" && typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  return String(value);
};

const getFileNameFromPath = (relativePath: string) => {
  const normalized = normalizeRelativePath(relativePath);
  const segments = normalized.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? normalized;
};

const getFileStem = (fileName: string) => {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex <= 0) {
    return fileName;
  }
  return fileName.slice(0, extensionIndex);
};

const getFileExtension = (fileName: string) => {
  const extensionIndex = fileName.lastIndexOf(".");
  if (extensionIndex < 0) {
    return "";
  }
  return fileName.slice(extensionIndex + 1).toLowerCase();
};

const getFileFolder = (relativePath: string) => {
  const normalized = normalizeRelativePath(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return "";
  }
  return normalized.slice(0, slashIndex);
};

export const createSystemFieldsForRecord = (
  relativePath: string,
  fullPath: string,
  options?: {
    isExamRunnable?: boolean;
    createdAt?: number | null;
    lastModified?: number | null;
    sizeBytes?: number | null;
  },
) => {
  const toDateOrNull = (value: number | null | undefined): Date | null => {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return null;
    }
    const next = new Date(value);
    return Number.isFinite(next.getTime()) ? next : null;
  };
  const toSizeOrNull = (value: number | null | undefined): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;

  const fileName = getFileNameFromPath(relativePath);
  return {
    Dateiname: getFileStem(fileName),
    "Dateiname mit Endung": fileName,
    Dateiendung: getFileExtension(fileName),
    Dateipfad: normalizeRelativePath(relativePath),
    Ordner: getFileFolder(relativePath),
    Dateisystempfad: fullPath,
    Erstellt: toDateOrNull(options?.createdAt),
    Geaendert: toDateOrNull(options?.lastModified),
    Dateigroesse: toSizeOrNull(options?.sizeBytes),
    Exam: Boolean(options?.isExamRunnable),
  };
};

const toLowerKey = (key: string) => key.trim().toLowerCase();

export const buildNormalizedRecord = (
  record: Omit<DatabaseRecord, "normalizedFields" | "fileName" | "folder" | "extension">,
): DatabaseRecord => {
  const systemFields = record.systemFields;
  const fileNameWithExtension = String(systemFields["Dateiname mit Endung"] ?? "");
  const normalizedFields: Record<string, DatabaseNormalizedFieldValue> = {};

  Object.entries(systemFields).forEach(([key, value]) => {
    const type = inferFieldType(key, value);
    normalizedFields[key] = normalizeFieldValueByType(type, value);
  });

  Object.entries(record.frontmatter).forEach(([key, value]) => {
    const normalizedKey = toLowerKey(key);
    const hasCaseInsensitiveDuplicate = Object.keys(normalizedFields).some(
      (existingKey) => toLowerKey(existingKey) === normalizedKey,
    );
    if (hasCaseInsensitiveDuplicate) {
      return;
    }
    const type = inferFieldType(key, value);
    normalizedFields[key] = normalizeFieldValueByType(type, value);
  });

  return {
    ...record,
    fileName: fileNameWithExtension,
    folder: String(systemFields.Ordner ?? ""),
    extension: String(systemFields.Dateiendung ?? ""),
    normalizedFields,
  };
};
