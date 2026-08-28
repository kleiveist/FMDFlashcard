/**
 * @file apps/fmd-desktop/src/features/preview/database/database-source-resolver.ts
 *
 * Resolves markdown files for database block source scopes.
 */

import { normalizeRelativePath } from "../../../lib/path";
import { type VaultFile } from "../../../lib/tree";
import {
  type DatabaseSourceResolutionResult,
  type DatabaseSourceSpec,
} from "./database-types";

export type DatabaseSourceResolverContext = {
  vaultFiles?: VaultFile[];
  sourceRelativePath?: string | null;
  historyFiles?: Array<{
    path: string;
    relativePath: string;
    created_at?: number | null;
    last_modified?: number | null;
    size_bytes?: number | null;
  }>;
  historyWarning?: string | null;
};

const toNormalizedPath = (value: string) =>
  normalizeRelativePath(value).replace(/^\/+/, "").replace(/\/+$/, "");

const isMarkdownFile = (relativePath: string) => /\.md$/i.test(relativePath);

const fileBelongsToFolder = (relativePath: string, folder: string) => {
  const normalizedFilePath = toNormalizedPath(relativePath);
  const normalizedFolder = toNormalizedPath(folder);
  if (!normalizedFolder) {
    return true;
  }
  return normalizedFilePath === normalizedFolder || normalizedFilePath.startsWith(`${normalizedFolder}/`);
};

const getFolderFromRelativePath = (relativePath: string | null | undefined) => {
  if (!relativePath) {
    return "";
  }
  const normalized = toNormalizedPath(relativePath);
  const slashIndex = normalized.lastIndexOf("/");
  if (slashIndex < 0) {
    return "";
  }
  return normalized.slice(0, slashIndex);
};

const mapToResolutionFiles = (files: VaultFile[]) =>
  files.map((file) => ({
    path: file.path,
    relativePath: normalizeRelativePath(file.relative_path),
    created_at: file.created_at ?? null,
    last_modified: file.last_modified ?? null,
    size_bytes: file.size_bytes ?? null,
  }));

const dedupeResolutionFilesByPath = (
  files: Array<{
    path: string;
    relativePath: string;
    created_at?: number | null;
    last_modified?: number | null;
    size_bytes?: number | null;
  }>,
) => {
  const seen = new Set<string>();
  const next: Array<{
    path: string;
    relativePath: string;
    created_at?: number | null;
    last_modified?: number | null;
    size_bytes?: number | null;
  }> = [];
  files.forEach((file) => {
    const key = file.path;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    next.push(file);
  });
  return next;
};

const resolveCurrentFolderFiles = (
  files: VaultFile[],
  sourceRelativePath: string | null | undefined,
) => {
  const folder = getFolderFromRelativePath(sourceRelativePath);
  return files.filter((file) => fileBelongsToFolder(file.relative_path, folder));
};

const resolveExplicitFolderFiles = (files: VaultFile[], path: string | undefined) => {
  if (!path) {
    return files;
  }
  return files.filter((file) => fileBelongsToFolder(file.relative_path, path));
};

const resolveMultiFolderFiles = (files: VaultFile[], paths: string[] | undefined) => {
  if (!paths || paths.length === 0) {
    return files;
  }
  const normalizedPaths = paths
    .map((path) => toNormalizedPath(path))
    .filter((path) => path.length > 0);
  if (normalizedPaths.length === 0) {
    return files;
  }
  return files.filter((file) =>
    normalizedPaths.some((path) => fileBelongsToFolder(file.relative_path, path)));
};

export const resolveDatabaseSourceFiles = (
  source: DatabaseSourceSpec,
  context: DatabaseSourceResolverContext,
): DatabaseSourceResolutionResult => {
  const vaultFiles = (context.vaultFiles ?? []).filter((file) => isMarkdownFile(file.relative_path));

  if (source.type === "current-folder") {
    return {
      files: mapToResolutionFiles(resolveCurrentFolderFiles(vaultFiles, context.sourceRelativePath)),
      warning: null,
    };
  }

  if (source.type === "explicit-folder") {
    return {
      files: mapToResolutionFiles(resolveExplicitFolderFiles(vaultFiles, source.path)),
      warning: null,
    };
  }

  if (source.type === "multi-folder") {
    const includeHistory = source.includeHistory === true;
    const resolvedVaultFiles = mapToResolutionFiles(resolveMultiFolderFiles(vaultFiles, source.paths));
    if (!includeHistory) {
      return {
        files: resolvedVaultFiles,
        warning: null,
      };
    }

    const hasExplicitFolderSelection = (source.paths ?? []).length > 0;
    const scopedVaultFiles = hasExplicitFolderSelection ? resolvedVaultFiles : [];
    return {
      files: dedupeResolutionFilesByPath([
        ...scopedVaultFiles,
        ...(context.historyFiles ?? []),
      ]),
      warning: context.historyWarning ?? null,
    };
  }

  if (source.type === "tag-query") {
    return {
      files: [],
      warning: "tag-query is parsed in phase 1 but query execution is not enabled yet.",
    };
  }

  if (source.type === "manual-query") {
    return {
      files: [],
      warning: "manual-query is parsed in phase 1 but query execution is not enabled yet.",
    };
  }

  if (source.type === "history-folder") {
    return {
      files: context.historyFiles ?? [],
      warning: context.historyWarning ?? null,
    };
  }

  return {
    files: [],
    warning: "linked-files source is reserved for a later phase.",
  };
};
