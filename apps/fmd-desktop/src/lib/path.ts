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
  value.replace(/\\/g, "/").replace(/^\/+/, "");

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
