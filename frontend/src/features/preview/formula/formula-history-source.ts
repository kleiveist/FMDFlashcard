/**
 * @file frontend/src/features/preview/formula/formula-history-source.ts
 *
 * Shared loader for History formula source files.
 */

import { invoke } from "@tauri-apps/api/core";
import { joinPath, normalizeRelativePath } from "../../../lib/path";

export type FormulaHistoryFileEntry = {
  path: string;
  relativePath: string;
};

export type FormulaHistoryLoadResult = {
  historyFolderPath: string | null;
  files: FormulaHistoryFileEntry[];
  warning: string | null;
};

const toKey = (value: string) => value.trim().replace(/\\+/g, "/").toLowerCase();

const dedupeByPath = (files: FormulaHistoryFileEntry[]) => {
  const seen = new Set<string>();
  const next: FormulaHistoryFileEntry[] = [];
  files.forEach((file) => {
    const key = toKey(file.path);
    if (!key || seen.has(key)) {
      return;
    }
    seen.add(key);
    next.push(file);
  });
  return next;
};

const defaultListFiles = (path: string) => invoke<string[]>("list_files", { path });

export const resolveFormulaHistoryFolderPath = (vaultPath?: string | null) =>
  vaultPath ? joinPath(vaultPath, ".profile", "exam-runs") : null;

export const normalizeFormulaHistoryFiles = (
  historyFolderPath: string,
  entries: string[],
): FormulaHistoryFileEntry[] => {
  const normalizedHistoryDir = historyFolderPath.replace(/\\+/g, "/").replace(/\/+$/, "");
  const historyPrefix = `${normalizedHistoryDir}/`;

  return dedupeByPath(
    entries
      .filter((entryPath) => entryPath.toLowerCase().endsWith(".md"))
      .map((entryPath) => {
        const normalizedPath = entryPath.replace(/\\+/g, "/");
        const relativeWithinHistory = normalizedPath.startsWith(historyPrefix)
          ? normalizedPath.slice(historyPrefix.length)
          : (normalizedPath.split("/").pop() ?? normalizedPath);
        const normalizedRelativeWithinHistory = normalizeRelativePath(relativeWithinHistory).replace(/^\/+/, "");
        return {
          path: entryPath,
          relativePath: normalizeRelativePath(
            `.profile/exam-runs/${normalizedRelativeWithinHistory || (normalizedPath.split("/").pop() ?? "")}`,
          ),
        };
      })
      .filter((entry) => entry.relativePath.toLowerCase().endsWith(".md")),
  );
};

export const loadFormulaHistoryFiles = async ({
  vaultPath,
  listFiles = defaultListFiles,
}: {
  vaultPath?: string | null;
  listFiles?: (path: string) => Promise<string[]>;
}): Promise<FormulaHistoryLoadResult> => {
  const historyFolderPath = resolveFormulaHistoryFolderPath(vaultPath);
  if (!historyFolderPath) {
    return {
      historyFolderPath: null,
      files: [],
      warning: "History folder unavailable (no vault path).",
    };
  }

  try {
    const listedRaw = await listFiles(historyFolderPath);
    const listed = Array.isArray(listedRaw) ? listedRaw : [];
    const files = normalizeFormulaHistoryFiles(historyFolderPath, listed);
    return {
      historyFolderPath,
      files,
      warning: files.length === 0 ? `History folder is empty: ${historyFolderPath}` : null,
    };
  } catch (error) {
    const baseMessage = error instanceof Error ? error.message : "History folder not found.";
    return {
      historyFolderPath,
      files: [],
      warning: `${baseMessage} (${historyFolderPath})`,
    };
  }
};
