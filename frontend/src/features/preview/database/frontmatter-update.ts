/**
 * @file frontend/src/features/preview/database/frontmatter-update.ts
 *
 * Safe frontmatter upsert helpers used by the database block.
 */

import { invoke } from "@tauri-apps/api/core";
import {
  addFrontmatterProperty,
  normalizeWikilinkValue,
  parseFrontmatterDocument,
  type FrontmatterPropertyKind,
  type FrontmatterPropertyValue,
  updateFrontmatterProperty,
} from "../frontmatter";
import { type DatabaseFieldType } from "./database-types";
import {
  normalizeDateTimeValue,
  normalizeDateValue,
  normalizeTimeValue,
} from "./database-time";

export type DatabaseFrontmatterUpsertAction = "added" | "updated" | "skipped" | "failed";

export type DatabaseFrontmatterUpsertResult = {
  markdown: string;
  action: DatabaseFrontmatterUpsertAction;
  changed: boolean;
  error: string | null;
};

export type BulkUpsertDatabaseAttributeParams = {
  files: Array<{ path: string; relativePath: string }>;
  key: string;
  type: DatabaseFieldType;
  initialValue: string;
  overwriteExisting: boolean;
  io?: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, contents: string) => Promise<void>;
  };
};

export type BulkUpsertDatabaseAttributeResult = {
  updated: number;
  skipped: number;
  failed: Array<{ path: string; error: string }>;
};

export type DatabaseRecordFieldDraftValue = string | number | boolean | null;

export type DatabaseRecordFieldCoercionResult = {
  kind: FrontmatterPropertyKind;
  typedValue: FrontmatterPropertyValue;
  addDraftValue: string;
  error: string | null;
};

export type UpsertDatabaseRecordFieldInMarkdownResult = {
  markdown: string;
  action: "updated" | "added" | "skipped" | "failed";
  changed: boolean;
  persistedKey: string;
  persistedValue: FrontmatterPropertyValue;
  error: string | null;
};

export type UpsertDatabaseRecordFieldParams = {
  path: string;
  relativePath: string;
  key: string;
  type: DatabaseFieldType;
  value: DatabaseRecordFieldDraftValue;
  io?: {
    readFile: (path: string) => Promise<string>;
    writeFile: (path: string, contents: string) => Promise<void>;
  };
};

export const mapDatabaseFieldTypeToFrontmatterKind = (
  type: DatabaseFieldType,
): FrontmatterPropertyKind => {
  if (type === "number" || type === "unit") {
    return "number";
  }
  if (type === "boolean") {
    return "boolean";
  }
  if (type === "tags" || type === "multiselect") {
    return "tags";
  }
  if (type === "link") {
    return "link";
  }
  if (type === "time") {
    return "time";
  }
  return "text";
};

const parseFrontmatterValueForKind = (
  rawValue: string,
  kind: FrontmatterPropertyKind,
): FrontmatterPropertyValue => {
  const trimmed = rawValue.trim();

  if (kind === "number") {
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }

  if (kind === "boolean") {
    if (!trimmed) {
      return null;
    }
    if (/^(true|false)$/i.test(trimmed)) {
      return trimmed.toLowerCase() === "true";
    }
    return null;
  }

  if (kind === "tags") {
    if (!trimmed) {
      return null;
    }
    const tags = rawValue
      .split(/[\n,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
    return tags.length > 0 ? tags : null;
  }

  if (kind === "link") {
    if (!trimmed) {
      return null;
    }
    return normalizeWikilinkValue(trimmed);
  }

  if (!trimmed) {
    return null;
  }
  return rawValue;
};

const normalizeDraftStringForAdd = (rawValue: string, kind: FrontmatterPropertyKind) => {
  if (kind === "link") {
    return rawValue.trim() ? normalizeWikilinkValue(rawValue.trim()) : "";
  }
  return rawValue;
};

const toFiniteNumber = (value: DatabaseRecordFieldDraftValue) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
};

const toUnitNumber = (value: DatabaseRecordFieldDraftValue): number | null => {
  const numeric = toFiniteNumber(value);
  if (numeric === null || !Number.isInteger(numeric) || numeric < 1) {
    return null;
  }
  return numeric;
};

const toBooleanOrNull = (value: DatabaseRecordFieldDraftValue): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim().toLowerCase();
  if (normalized === "true" || normalized === "1") {
    return true;
  }
  if (normalized === "false" || normalized === "0") {
    return false;
  }
  if (!normalized) {
    return null;
  }
  return null;
};

const toDateStringOrNull = (value: DatabaseRecordFieldDraftValue): string | null => {
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return null;
  }
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  return normalizeDateValue(trimmed);
};

const toDateTimeStringOrNull = (value: DatabaseRecordFieldDraftValue): string | null => {
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return null;
  }
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  return normalizeDateTimeValue(trimmed);
};

const toTemporalStringOrNull = (value: DatabaseRecordFieldDraftValue): string | null => {
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return null;
  }
  const text = typeof value === "string" ? value : String(value);
  const trimmed = text.trim();
  if (!trimmed) {
    return null;
  }
  return normalizeDateTimeValue(trimmed) ??
    normalizeDateValue(trimmed) ??
    normalizeTimeValue(trimmed);
};

const toPercentStringOrNull = (value: DatabaseRecordFieldDraftValue): string | null => {
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : null;
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const normalized = trimmed.endsWith("%")
    ? trimmed.slice(0, -1).trim()
    : trimmed;
  if (!normalized) {
    return null;
  }
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return String(parsed);
};

const toStatusCodeOrNull = (value: DatabaseRecordFieldDraftValue): string | null => {
  if (value === null) {
    return null;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return null;
    }
    return String(Math.trunc(value));
  }
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const match = trimmed.match(/^([0-9A-Za-z!]+)/u);
  if (!match?.[1]) {
    return null;
  }
  return match[1];
};

const stringifyAddDraftValue = (value: FrontmatterPropertyValue): string => {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  if (Array.isArray(value)) {
    return value.join(", ");
  }
  return "";
};

export const coerceDatabaseRecordFieldValue = (
  type: DatabaseFieldType,
  value: DatabaseRecordFieldDraftValue,
): DatabaseRecordFieldCoercionResult => {
  if (type === "number") {
    const numeric = toFiniteNumber(value);
    if (numeric === null && typeof value === "string" && value.trim().length > 0) {
      return {
        kind: "number",
        typedValue: null,
        addDraftValue: "",
        error: "Number value must be numeric.",
      };
    }
    return {
      kind: "number",
      typedValue: numeric,
      addDraftValue: numeric === null ? "" : String(numeric),
      error: null,
    };
  }

  if (type === "unit") {
    const unit = toUnitNumber(value);
    if (unit === null && typeof value === "string" && value.trim().length > 0) {
      return {
        kind: "number",
        typedValue: null,
        addDraftValue: "",
        error: "Unit value must be an integer >= 1.",
      };
    }
    if (unit === null && typeof value === "number" && Number.isFinite(value)) {
      return {
        kind: "number",
        typedValue: null,
        addDraftValue: "",
        error: "Unit value must be an integer >= 1.",
      };
    }
    return {
      kind: "number",
      typedValue: unit,
      addDraftValue: unit === null ? "" : String(unit),
      error: null,
    };
  }

  if (type === "boolean") {
    const booleanValue = toBooleanOrNull(value);
    if (booleanValue === null && typeof value === "string" && value.trim().length > 0) {
      return {
        kind: "boolean",
        typedValue: null,
        addDraftValue: "",
        error: "Boolean value must be true or false.",
      };
    }
    return {
      kind: "boolean",
      typedValue: booleanValue,
      addDraftValue: booleanValue === null ? "" : booleanValue ? "true" : "false",
      error: null,
    };
  }

  if (type === "date") {
    const dateValue = toDateStringOrNull(value);
    if (value !== null && typeof value === "string" && value.trim().length > 0 && !dateValue) {
      return {
        kind: "text",
        typedValue: null,
        addDraftValue: "",
        error: "Date value must be a valid date.",
      };
    }
    return {
      kind: "text",
      typedValue: dateValue,
      addDraftValue: dateValue ?? "",
      error: null,
    };
  }

  if (type === "datetime") {
    const datetimeValue = toDateTimeStringOrNull(value);
    if (value !== null && typeof value === "string" && value.trim().length > 0 && !datetimeValue) {
      return {
        kind: "text",
        typedValue: null,
        addDraftValue: "",
        error: "Datetime value must match YYYY-MM-DDTHH:mm.",
      };
    }
    return {
      kind: "text",
      typedValue: datetimeValue,
      addDraftValue: datetimeValue ?? "",
      error: null,
    };
  }

  if (type === "time") {
    const timeValue = toTemporalStringOrNull(value);
    if (value !== null && typeof value === "string" && value.trim().length > 0 && !timeValue) {
      return {
        kind: "time",
        typedValue: null,
        addDraftValue: "",
        error: "Time value must match YYYY-MM-DD, HH:mm, or YYYY-MM-DDTHH:mm.",
      };
    }
    return {
      kind: "time",
      typedValue: timeValue,
      addDraftValue: timeValue ?? "",
      error: null,
    };
  }

  if (type === "percent") {
    const percent = toPercentStringOrNull(value);
    if (value !== null && (typeof value !== "string" || value.trim().length > 0) && !percent) {
      return {
        kind: "text",
        typedValue: null,
        addDraftValue: "",
        error: "Percent value must be numeric.",
      };
    }
    return {
      kind: "text",
      typedValue: percent,
      addDraftValue: percent ?? "",
      error: null,
    };
  }

  if (type === "status") {
    const statusCode = toStatusCodeOrNull(value);
    const hasUserInput = typeof value === "string"
      ? value.trim().length > 0
      : value !== null;
    if (
      hasUserInput &&
      !statusCode
    ) {
      return {
        kind: "text",
        typedValue: null,
        addDraftValue: "",
        error: "Status value must start with a code token.",
      };
    }
    return {
      kind: "text",
      typedValue: statusCode,
      addDraftValue: statusCode ?? "",
      error: null,
    };
  }

  if (type === "link") {
    const raw = typeof value === "string" ? value.trim() : "";
    const normalized = raw ? normalizeWikilinkValue(raw) : null;
    return {
      kind: "link",
      typedValue: normalized,
      addDraftValue: normalized ?? "",
      error: null,
    };
  }

  const text = value === null
    ? null
    : typeof value === "string"
    ? value
    : String(value);
  return {
    kind: "text",
    typedValue: text,
    addDraftValue: stringifyAddDraftValue(text),
    error: null,
  };
};

export const upsertFrontmatterAttributeInMarkdown = ({
  markdown,
  key,
  type,
  initialValue,
  overwriteExisting,
}: {
  markdown: string;
  key: string;
  type: DatabaseFieldType;
  initialValue: string;
  overwriteExisting: boolean;
}): DatabaseFrontmatterUpsertResult => {
  const nextKey = key.trim();
  if (!nextKey) {
    return {
      markdown,
      action: "failed",
      changed: false,
      error: "Attribute key is required.",
    };
  }

  const parsed = parseFrontmatterDocument(markdown);
  const existing = parsed.properties.find(
    (property) => property.key.trim().toLowerCase() === nextKey.toLowerCase(),
  );

  const kind = mapDatabaseFieldTypeToFrontmatterKind(type);
  if (type === "unit") {
    const unit = toUnitNumber(initialValue);
    if (initialValue.trim().length > 0 && unit === null) {
      return {
        markdown,
        action: "failed",
        changed: false,
        error: "Unit value must be an integer >= 1.",
      };
    }
  }

  if (existing) {
    if (!overwriteExisting) {
      return {
        markdown,
        action: "skipped",
        changed: false,
        error: null,
      };
    }

    const updateResult = updateFrontmatterProperty({
      markdown,
      key: existing.key,
      kind,
      value: type === "unit"
        ? toUnitNumber(initialValue)
        : parseFrontmatterValueForKind(initialValue, kind),
    });

    return {
      markdown: updateResult.markdown,
      action: updateResult.error ? "failed" : "updated",
      changed: !updateResult.error && updateResult.markdown !== markdown,
      error: updateResult.error,
    };
  }

  const addResult = addFrontmatterProperty({
    markdown,
    key: nextKey,
    kind,
    value: type === "unit"
      ? stringifyAddDraftValue(toUnitNumber(initialValue))
      : normalizeDraftStringForAdd(initialValue, kind),
  });

  return {
    markdown: addResult.markdown,
    action: addResult.error ? "failed" : "added",
    changed: !addResult.error && addResult.markdown !== markdown,
    error: addResult.error,
  };
};

export const upsertDatabaseRecordFieldInMarkdown = ({
  markdown,
  key,
  type,
  value,
}: {
  markdown: string;
  key: string;
  type: DatabaseFieldType;
  value: DatabaseRecordFieldDraftValue;
}): UpsertDatabaseRecordFieldInMarkdownResult => {
  const nextKey = key.trim();
  if (!nextKey) {
    return {
      markdown,
      action: "failed",
      changed: false,
      persistedKey: key,
      persistedValue: null,
      error: "Attribute key is required.",
    };
  }

  const coercion = coerceDatabaseRecordFieldValue(type, value);
  if (coercion.error) {
    return {
      markdown,
      action: "failed",
      changed: false,
      persistedKey: nextKey,
      persistedValue: null,
      error: coercion.error,
    };
  }

  const parsed = parseFrontmatterDocument(markdown);
  const existing = parsed.properties.find(
    (property) => property.key.trim().toLowerCase() === nextKey.toLowerCase(),
  );

  if (existing) {
    const updated = updateFrontmatterProperty({
      markdown,
      key: existing.key,
      kind: coercion.kind,
      value: coercion.typedValue,
    });
    return {
      markdown: updated.markdown,
      action: updated.error ? "failed" : "updated",
      changed: !updated.error && updated.markdown !== markdown,
      persistedKey: existing.key,
      persistedValue: coercion.typedValue,
      error: updated.error,
    };
  }

  const added = addFrontmatterProperty({
    markdown,
    key: nextKey,
    value: coercion.addDraftValue,
    kind: coercion.kind,
  });
  return {
    markdown: added.markdown,
    action: added.error ? "failed" : "added",
    changed: !added.error && added.markdown !== markdown,
    persistedKey: nextKey,
    persistedValue: coercion.typedValue,
    error: added.error,
  };
};

const defaultReadFile = async (path: string) => invoke<string>("read_text_file", { path });
const defaultWriteFile = async (path: string, contents: string) =>
  invoke<void>("write_text_file", { path, contents });

export const upsertDatabaseRecordField = async (
  params: UpsertDatabaseRecordFieldParams,
) => {
  const readFile = params.io?.readFile ?? defaultReadFile;
  const writeFile = params.io?.writeFile ?? defaultWriteFile;

  const source = await readFile(params.path);
  const result = upsertDatabaseRecordFieldInMarkdown({
    markdown: source,
    key: params.key,
    type: params.type,
    value: params.value,
  });

  if (!result.error && result.changed) {
    await writeFile(params.path, result.markdown);
  }

  return {
    ...result,
    path: params.path,
    relativePath: params.relativePath,
  };
};

export const bulkUpsertDatabaseAttribute = async (
  params: BulkUpsertDatabaseAttributeParams,
): Promise<BulkUpsertDatabaseAttributeResult> => {
  const readFile = params.io?.readFile ?? defaultReadFile;
  const writeFile = params.io?.writeFile ?? defaultWriteFile;

  let updated = 0;
  let skipped = 0;
  const failed: Array<{ path: string; error: string }> = [];

  for (const file of params.files) {
    try {
      const source = await readFile(file.path);
      const result = upsertFrontmatterAttributeInMarkdown({
        markdown: source,
        key: params.key,
        type: params.type,
        initialValue: params.initialValue,
        overwriteExisting: params.overwriteExisting,
      });

      if (result.error) {
        failed.push({ path: file.relativePath, error: result.error });
        continue;
      }

      if (!result.changed) {
        skipped += 1;
        continue;
      }

      await writeFile(file.path, result.markdown);
      updated += 1;
    } catch (error) {
      failed.push({
        path: file.relativePath,
        error: error instanceof Error ? error.message : "Failed to update frontmatter.",
      });
    }
  }

  return {
    updated,
    skipped,
    failed,
  };
};
