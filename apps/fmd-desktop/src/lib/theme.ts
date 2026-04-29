/**
 * @file apps/fmd-desktop/src/lib/theme.ts
 *
 * Zweck:
 * - Enthaelt Hilfsfunktionen fuer Theme.
 *
 * Verantwortlichkeiten:
 * - Stellt Hilfsfunktionen fuer Theme bereit.
 * - Normalisiert oder validiert Daten, wo erforderlich.
 *
 * Verbunden mit:
 * - apps/fmd-desktop/src/lib/color.ts: Hilfsfunktionen oder Typen.
 * - apps/fmd-desktop/src/components/AppStateProvider.tsx: Nutzt dieses Modul.
 *
 * Hinweise:
 * - Aenderungen beeinflussen alle nutzenden Module.
 */

import { buildAccentTokens } from "./color";

export type ThemeMode = "light" | "dark";
export type DesignMode = "smart" | "modern" | "desktop";

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export const applyDesignMode = (mode: DesignMode) => {
  const root = document.documentElement;
  root.dataset.designMode = mode;
};

export const applyAccentColor = (value: string) => {
  const root = document.documentElement;
  const tokens = buildAccentTokens(value);
  root.style.setProperty("--accent-rgb", tokens.accentRgb);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-strong", tokens.accentStrong);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--accent-highlight", tokens.accentHighlight);
  root.style.setProperty("--accent-border", tokens.accentBorder);
  root.style.setProperty("--accent-contrast", tokens.accentContrast);
  root.style.setProperty("--accent-contrast-strong", tokens.accentContrastStrong);
};
