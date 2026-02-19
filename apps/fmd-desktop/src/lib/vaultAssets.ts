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
  if (!trimmed.startsWith("[[") || !trimmed.endsWith("]]")) {
    return null;
  }
  const inner = trimmed.slice(2, -2).trim();
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

const joinVaultAndRelativePath = (vaultPath: string, relativePath: string) => {
  const normalizedVault = vaultPath.replace(/\\/g, "/").replace(/\/+$/, "");
  const normalizedRelative = normalizeRelativePath(relativePath).replace(/^\/+/, "");
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
  const normalized = normalizeRelativePath(pathPart ?? "").replace(/^\/+/, "");
  return normalized || null;
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
  const normalizedRelative = relativePath?.trim() ?? "";
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
