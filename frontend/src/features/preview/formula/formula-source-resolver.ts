/**
 * @file frontend/src/features/preview/formula/formula-source-resolver.ts
 *
 * Shared source scoping for aggregation formulas.
 */

import { type DatabaseRecord } from "../database/database-types";
import { type DatabaseFormulaSourceSpec } from "./database-formula-types";

const toNormalizedPath = (value: string) =>
  value.trim().replace(/\\+/g, "/").replace(/^\/+/, "").replace(/\/+$/, "");

const fileBelongsToFolder = (relativePath: string, folder: string) => {
  const normalizedFilePath = toNormalizedPath(relativePath);
  const normalizedFolder = toNormalizedPath(folder);
  if (!normalizedFolder) {
    return true;
  }
  return normalizedFilePath === normalizedFolder || normalizedFilePath.startsWith(`${normalizedFolder}/`);
};

export const resolveFormulaSourceRecords = ({
  source,
  records,
  currentRecord,
  historyRecords,
}: {
  source: DatabaseFormulaSourceSpec;
  records: DatabaseRecord[];
  currentRecord: DatabaseRecord;
  historyRecords?: DatabaseRecord[];
}) => {
  if (source.type === "current-folder") {
    return records.filter((record) => fileBelongsToFolder(record.relativePath, currentRecord.folder));
  }

  if (source.type === "explicit-folder") {
    const folderPath = source.path?.trim() ?? "";
    if (!folderPath) {
      return records;
    }
    return records.filter((record) => fileBelongsToFolder(record.relativePath, folderPath));
  }

  if (source.type === "multi-folder") {
    const folders = (source.paths ?? [])
      .map((path) => path.trim())
      .filter((path) => path.length > 0);
    if (folders.length === 0) {
      return records;
    }
    return records.filter((record) =>
      folders.some((path) => fileBelongsToFolder(record.relativePath, path)));
  }

  if (source.type === "history") {
    return historyRecords ?? [];
  }

  return records;
};
