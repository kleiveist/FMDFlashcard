/**
 * @file frontend/src/lib/errors.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Errors.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Errors bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - frontend/src/components/VaultTree.tsx: Nutzt dieses Modul.
 * - frontend/src/features/preview/usePreview.ts: Nutzt dieses Modul.
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
