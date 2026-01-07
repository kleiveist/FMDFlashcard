/**
 * @file apps/fmd-desktop/src/features/fast-flashcard/constants.ts
 *
 * Zweck:
 * - Definiert zentrale Konstanten fuer Fast Flashcard.
 *
 * Verantwortlichkeiten:
 * - Definiert wiederverwendbare Werte und Defaults.
 * - Sichert konsistente Nutzung ueber Module hinweg.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/features/settings/useAppSettings.ts: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen wirken sich auf mehrere Module aus.
 */

export const FAST_FLASHCARD_DURATIONS = [3, 6, 12, 24, 48] as const;

export type FastFlashcardDuration = (typeof FAST_FLASHCARD_DURATIONS)[number];
