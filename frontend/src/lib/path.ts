/**
 * @file apps/fmd-desktop/src/lib/path.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Path.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Path bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/components/SidebarNav.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const normalizeRelativePath = (value: string) =>
  value.replace(/\\/g, "/").replace(/\/+/g, "/").replace(/^\/+/, "");

export const isHiddenPath = (value: string) => {
  const normalized = normalizeRelativePath(value);
  if (!normalized) {
    return false;
  }
  return normalized.split("/").some((segment) => segment.startsWith("."));
};

export const vaultBaseName = (value: string | null) => {
  if (!value) {
    return "Vault";
  }
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/);
  return parts[parts.length - 1] || "Vault";
};

export const normalizeVaultPath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  const normalized = trimmed.replace(/\\/g, "/").replace(/\/+$/, "");
  if (/^[A-Za-z]:\//.test(normalized)) {
    return normalized.replace(/^([A-Za-z]):\//, (_, drive) => `${drive.toLowerCase()}:/`);
  }
  return normalized;
};

export const isWindowsAbsolutePath = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  return /^[A-Za-z]:[\\/]/.test(trimmed) || /^\\\\[^\\]/.test(trimmed);
};

const resolvePlatformHint = () => {
  if (typeof navigator !== "undefined") {
    const nav = navigator as Navigator & {
      userAgentData?: { platform?: string };
    };
    return nav.userAgentData?.platform ?? nav.platform ?? nav.userAgent ?? "";
  }
  return "";
};

export const isWindowsRuntime = (platformHint?: string) => {
  const normalized = (platformHint ?? resolvePlatformHint()).trim().toLowerCase();
  if (!normalized) {
    return false;
  }
  return (
    normalized.includes("win32") ||
    normalized.includes("windows") ||
    normalized.startsWith("win")
  );
};

export const isPathCompatibleWithCurrentOs = (path: string, platformHint?: string) => {
  if (!path.trim()) {
    return false;
  }
  if (isWindowsAbsolutePath(path) && !isWindowsRuntime(platformHint)) {
    return false;
  }
  return true;
};

export const joinPath = (root: string, ...segments: string[]) => {
  const separator = root.includes("\\") ? "\\" : "/";
  const normalizedRoot = root.replace(/[\\/]+$/, "");
  const normalizedSegments = segments
    .map((segment) =>
      segment
        .replace(/[\\/]+/g, separator)
        .replace(/^[/\\]+/, "")
        .replace(/[/\\]+$/, ""),
    )
    .filter(Boolean);
  return [normalizedRoot, ...normalizedSegments].filter(Boolean).join(separator);
};
