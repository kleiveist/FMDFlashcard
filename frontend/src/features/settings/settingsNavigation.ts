/**
 * @file frontend/src/features/settings/settingsNavigation.ts
 *
 * Zweck:
 * - Beschreibt Navigation und Seitenstruktur fuer Settings.
 *
 * Verantwortlichkeiten:
 * - Stellt das Settings-Navigationsmodell bereit.
 *
 * Verbunden mit:
 * - frontend/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 * - frontend/src/pages/SettingsPage.tsx: Nutzt dieses Modul.
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
  | "vault-index";

export type SettingsSubPageId =
  | "exam-toggles"
  | "task-type-defaults"
  | "auto-cards"
  | "flashcard-tools"
  | "fast-flashcard-tools"
  | "spaced-repetition-tools"
  | "performance-general"
  | "performance-debug"
  | "vault-index"
  | "data-sync"
  | "export-import";

export type SettingsNavSubPage = {
  id: SettingsSubPageId;
  label: string;
};

export type SettingsPageId =
  | "appearance"
  | "markdown-editor"
  | "exam-editor"
  | "exam-settings"
  | "review-tools"
  | "keyboard-shortcuts"
  | "language"
  | "performance"
  | "vault-index";

export type SettingsNavDivider = {
  type: "divider";
  label: string;
};

export type SettingsNavItem = {
  type: "item";
  id: SettingsPageId;
  label: string;
  icon: SettingsNavIcon;
  title?: string;
  subPages?: readonly SettingsNavSubPage[];
};

export type SettingsNavEntry = SettingsNavDivider | SettingsNavItem;
export type SettingsNavModel = readonly SettingsNavEntry[];

export const SETTINGS_NAV_MODEL: SettingsNavModel = [
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
    label: "Exam Editor",
    title: "Exam Editor",
    icon: "exam-editor",
  },
  { type: "divider", label: "STUDY" },
  {
    type: "item",
    id: "exam-settings",
    label: "Exam Settings",
    icon: "exam-settings",
    subPages: [
      { id: "exam-toggles", label: "Exam Toggles" },
      { id: "task-type-defaults", label: "Task Type Points" },
      { id: "auto-cards", label: "Auto Cards" },
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
    subPages: [
      { id: "performance-general", label: "Performance" },
      { id: "performance-debug", label: "Debug" },
    ],
  },
  {
    type: "item",
    id: "vault-index",
    label: "Data & Index",
    icon: "vault-index",
    subPages: [
      { id: "vault-index", label: "Data & Index" },
      { id: "data-sync", label: "Profile Source" },
      { id: "export-import", label: "Ex- Import" },
    ],
  },
];
