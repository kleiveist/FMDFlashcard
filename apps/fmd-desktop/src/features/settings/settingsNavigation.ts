export const SETTINGS_PAGES = [
  { id: "app-settings", label: "App Settings" },
  { id: "data-sync", label: "Data & Sync" },
  { id: "review-tools", label: "Review Tools" },
  { id: "appearance", label: "Appearance" },
  { id: "language", label: "Language" },
] as const;

export type SettingsPageId = (typeof SETTINGS_PAGES)[number]["id"];
