/**
 * @file apps/fmd-desktop/src/lib/types.ts
 *
 * Zweck:
 * - Definiert Typen und Schnittstellen fuer /.
 *
 * Verantwortlichkeiten:
 * - Definiert Typen fuer Datenstrukturen und APIs.
 * - Sichert konsistente Verwendung in Features und Komponenten.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/FileList.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/components/PreviewPanel.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Typanpassungen koennen mehrere Module betreffen.
 */

export type LoadState = "idle" | "loading" | "error";
