/**
 * @file apps/fmd-desktop/src/features/preview/database/frontmatter-update.ts
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

export const mapDatabaseFieldTypeToFrontmatterKind = (
  type: DatabaseFieldType,
): FrontmatterPropertyKind => {
  if (type === "number") {
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
      value: parseFrontmatterValueForKind(initialValue, kind),
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
    value: normalizeDraftStringForAdd(initialValue, kind),
  });

  return {
    markdown: addResult.markdown,
    action: addResult.error ? "failed" : "added",
    changed: !addResult.error && addResult.markdown !== markdown,
    error: addResult.error,
  };
};

const defaultReadFile = async (path: string) => invoke<string>("read_text_file", { path });
const defaultWriteFile = async (path: string, contents: string) =>
  invoke<void>("write_text_file", { path, contents });

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
