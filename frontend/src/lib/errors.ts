/**
 * @file apps/fmd-desktop/src/lib/errors.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Errors.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Errors bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/VaultTree.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/features/preview/usePreview.ts: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const asErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return fallback;
};
