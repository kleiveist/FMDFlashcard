/**
 * @file apps/fmd-desktop/src/features/settings/settingsNavigation.ts
 *
 * Zweck:
 * - Beschreibt Navigation und Seitenstruktur fuer Settings.
 *
 * Verantwortlichkeiten:
 * - Stellt das Settings-Navigationsmodell bereit.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 * - apps/fmd-desktop/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

export type SettingsNavIcon =
  | "appearance"
  | "markdown"
  | "exam-editor"
  | "exam-settings"
  | "review-tools"
  | "keyboard-shortcuts"
  | "language"
  | "performance"
  | "vault-index"
  | "data-sync";

export type SettingsSubPageId =
  | "exam-settings"
  | "exam-toggles"
  | "flashcard-tools"
  | "fast-flashcard-tools"
  | "spaced-repetition-tools";

export type SettingsNavSubPage = {
  id: SettingsSubPageId;
  label: string;
};

export const SETTINGS_NAV_MODEL = [
  { type: "divider", label: "DESIGN" },
  {
    type: "item",
    id: "appearance",
    label: "Appearance",
    icon: "appearance",
  },
  {
    type: "item",
    id: "markdown-editor",
    label: "Markdown",
    title: "Markdown editor",
    icon: "markdown",
  },
  {
    type: "item",
    id: "exam-editor",
    label: "Editor Settings",
    title: "Exam editor",
    icon: "exam-editor",
  },
  { type: "divider", label: "STUDY" },
  {
    type: "item",
    id: "exam-settings",
    label: "Exam Settings",
    icon: "exam-settings",
    subPages: [
      { id: "exam-settings", label: "Exam Settings" },
      { id: "exam-toggles", label: "Exam Toggles" },
    ],
  },
  {
    type: "item",
    id: "review-tools",
    label: "Review Tools",
    icon: "review-tools",
    subPages: [
      { id: "flashcard-tools", label: "Flashcard Tools" },
      { id: "fast-flashcard-tools", label: "Fast Flashcard Tools" },
      { id: "spaced-repetition-tools", label: "Spaced Repetition Tools" },
    ],
  },
  { type: "divider", label: "CONTROL" },
  {
    type: "item",
    id: "keyboard-shortcuts",
    label: "Keyboard Shortcuts",
    icon: "keyboard-shortcuts",
  },
  { type: "divider", label: "APP SETTINGS" },
  {
    type: "item",
    id: "language",
    label: "Language",
    title: "Language Pages",
    icon: "language",
  },
  {
    type: "item",
    id: "performance",
    label: "Performance",
    icon: "performance",
  },
  {
    type: "item",
    id: "vault-index",
    label: "Vault & Index",
    icon: "vault-index",
  },
  {
    type: "item",
    id: "data-sync",
    label: "Data & Sync",
    icon: "data-sync",
  },
] as const;

export type SettingsNavEntry = (typeof SETTINGS_NAV_MODEL)[number];
export type SettingsNavItem = Extract<SettingsNavEntry, { type: "item" }> & {
  title?: string;
  subPages?: readonly SettingsNavSubPage[];
};
export type SettingsNavDivider = Extract<SettingsNavEntry, { type: "divider" }>;
export type SettingsNavModel = readonly SettingsNavEntry[];
export type SettingsPageId = SettingsNavItem["id"];
