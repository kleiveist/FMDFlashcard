/**
 * @file apps/fmd-desktop/src/features/settings/settingsNavigation.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Settings.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Settings bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/components/SidebarNav.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export const SETTINGS_PAGES = [
  { id: "app-settings", label: "App Settings" },
  { id: "exam-settings", label: "Exam Settings" },
  { id: "review-tools", label: "Review Tools" },
  { id: "keyboard-shortcuts", label: "Keyboard Shortcuts" },
  { id: "appearance", label: "Appearance" },
  { id: "markdown-editor", label: "Editor Settings" },
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number]["id"];
