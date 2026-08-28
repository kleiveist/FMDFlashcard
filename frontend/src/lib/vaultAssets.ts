/**
 * @file apps/fmd-desktop/src/lib/vaultAssets.ts
 *
 * Zweck:
 * - Hilfsfunktionen zur robusten Aufloesung von Vault-Asset-Pfaden und Bildquellen.
 */

import * as tauriCore from "@tauri-apps/api/core";
import { normalizeRelativePath } from "./path";

const TAURI_CONVERT_FILE_SRC = (() => {
  const candidate = (tauriCore as unknown as Record<string, unknown>).convertFileSrc;
  return typeof candidate === "function"
    ? (candidate as (path: string, protocol?: string) => string)
    : null;
})();

const stripWrappingQuotes = (value: string) => {
  const trimmed = value.trim();
  if (trimmed.length < 2) {
    return trimmed;
  }
  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];
  if ((first === "'" && last === "'") || (first === "\"" && last === "\"")) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
};

const extractWikilinkTargetLoose = (value: string) => {
  const trimmed = value.trim();
  const normalized = trimmed.startsWith("![[") ? trimmed.slice(1) : trimmed;
  if (!normalized.startsWith("[[") || !normalized.endsWith("]]")) {
    return null;
  }
  const inner = normalized.slice(2, -2).trim();
  if (!inner) {
    return null;
  }
  const [targetRaw] = inner.split("|");
  const target = targetRaw?.trim() ?? "";
  return target || null;
};

const toFileUrl = (absolutePath: string) => {
  const normalized = absolutePath.replace(/\\/g, "/");
  const encoded = normalized
    .split("/")
    .map((segment, index) => {
      if (index === 0 && /^[a-zA-Z]:$/.test(segment)) {
        return segment;
      }
      return encodeURIComponent(segment);
    })
    .join("/");
  if (/^[a-zA-Z]:\//.test(normalized)) {
    return `file:///${encoded}`;
  }
  if (normalized.startsWith("/")) {
    return `file://${encoded}`;
  }
  if (normalized.startsWith("//")) {
    return `file:${encoded}`;
  }
  return encoded;
};

export const normalizeVaultAssetRelativePath = (value: string | null | undefined) => {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (/^[A-Za-z]:[\\/]/.test(trimmed) || /^[\\/]{1,2}/.test(trimmed)) {
    return null;
  }
  const normalized = normalizeRelativePath(trimmed).replace(/^\/+/, "");
  if (!normalized) {
    return null;
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) {
    return null;
  }
  return normalized;
};

const hasAbsolutePathPrefix = (value: string) =>
  /^[A-Za-z]:[\\/]/.test(value) || /^[\\/]{1,2}/.test(value);

const splitResolvePathSegments = (value: string) =>
  normalizeRelativePath(value)
    .replace(/^\/+/, "")
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);

const resolveDotSegmentsWithinVault = (baseSegments: string[], targetSegments: string[]) => {
  const resolved = [...baseSegments];
  for (const segment of targetSegments) {
    if (!segment || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        return null;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }
  return resolved;
};

export const buildVaultRelativePathCandidates = (
  target: string | null | undefined,
  sourceRelativePath?: string | null,
) => {
  const rawTarget = target?.trim() ?? "";
  if (!rawTarget || hasAbsolutePathPrefix(rawTarget)) {
    return [] as string[];
  }

  const candidates = new Set<string>();
  const directNormalized = normalizeVaultAssetRelativePath(rawTarget);
  if (directNormalized) {
    candidates.add(directNormalized);
  }

  const sourceNormalized = normalizeVaultAssetRelativePath(sourceRelativePath ?? "");
  if (!sourceNormalized) {
    return Array.from(candidates);
  }

  const sourceDirSegments = sourceNormalized.split("/");
  sourceDirSegments.pop();
  const targetSegments = splitResolvePathSegments(rawTarget);
  if (targetSegments.length === 0) {
    return Array.from(candidates);
  }
  const resolvedSegments = resolveDotSegmentsWithinVault(sourceDirSegments, targetSegments);
  if (!resolvedSegments || resolvedSegments.length === 0) {
    return Array.from(candidates);
  }
  const resolvedPath = normalizeVaultAssetRelativePath(resolvedSegments.join("/"));
  if (resolvedPath) {
    candidates.add(resolvedPath);
  }
  return Array.from(candidates);
};

const joinVaultAndRelativePath = (vaultPath: string, relativePath: string) => {
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRelative = normalizeVaultAssetRelativePath(relativePath) ?? "";
  if (!normalizedVault) {
    return normalizedRelative;
  }
  if (!normalizedRelative) {
    return normalizedVault;
  }
  return `${normalizedVault}/${normalizedRelative}`;
};

export const extractVaultAssetRelativePath = (rawValue: string | null | undefined) => {
  if (!rawValue) {
    return null;
  }
  const unquoted = stripWrappingQuotes(rawValue);
  const wikilinkTarget = extractWikilinkTargetLoose(unquoted);
  const candidate = (wikilinkTarget ?? unquoted).trim();
  if (!candidate) {
    return null;
  }
  const [pathPart] = candidate.split(/[?#]/);
  return normalizeVaultAssetRelativePath(pathPart ?? "");
};

export const resolveVaultImageSrc = ({
  vaultPath,
  relativePath,
  absolutePath,
}: {
  vaultPath?: string | null;
  relativePath?: string | null;
  absolutePath?: string | null;
}) => {
  const normalizedAbsolute = absolutePath?.trim() ?? "";
  const normalizedRelative = normalizeVaultAssetRelativePath(relativePath) ?? "";
  const resolvedAbsolute = normalizedAbsolute ||
    (vaultPath && normalizedRelative
      ? joinVaultAndRelativePath(vaultPath, normalizedRelative)
      : "");
  if (!resolvedAbsolute) {
    return null;
  }
  if (TAURI_CONVERT_FILE_SRC) {
    try {
      return TAURI_CONVERT_FILE_SRC(resolvedAbsolute);
    } catch {
      // Fallback auf file:// wenn convertFileSrc nicht verfuegbar ist.
    }
  }
  return toFileUrl(resolvedAbsolute);
};
