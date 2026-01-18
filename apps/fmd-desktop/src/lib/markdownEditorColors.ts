/**
 * @file apps/fmd-desktop/src/lib/markdownEditorColors.ts
 *
 * Zweck:
 * - Leitet Markdown-Editor-Farben aus einer Akzentfarbe ab.
 *
 * Verantwortlichkeiten:
 * - Erzeugt CSS-Variablen fuer Accent, Question-Background und Grid-Helper.
 *
 * Hinweise:
 * - Alle Farben basieren auf der Akzentfarbe und reagieren auf Light/Dark.
 */

import { DEFAULT_ACCENT, hexToRgb, isValidHex, normalizeHex } from "./color";
import { type ThemeMode } from "./theme";

type MarkdownEditorColorInput = {
  accentHex: string;
  themeMode: ThemeMode;
};

export type MarkdownEditorColorVars = {
  "--md-accent": string;
  "--md-question-bg": string;
  "--md-question-border": string;
  "--md-grid-line-accent-light": string;
  "--md-grid-line-accent-medium": string;
  "--md-grid-line-accent-strong": string;
  "--md-grid-dot": string;
};

const resolveAccent = (value: string) => {
  const normalized = normalizeHex(value);
  if (isValidHex(normalized)) {
    return { accent: normalized, rgb: hexToRgb(normalized)! };
  }
  return { accent: DEFAULT_ACCENT, rgb: hexToRgb(DEFAULT_ACCENT)! };
};

const toRgba = (rgb: { r: number; g: number; b: number }, alpha: number) =>
  `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;

export const deriveMarkdownEditorColors = ({
  accentHex,
  themeMode,
}: MarkdownEditorColorInput): MarkdownEditorColorVars => {
  const { accent, rgb } = resolveAccent(accentHex);
  const isDark = themeMode === "dark";
  const questionBgAlpha = isDark ? 0.18 : 0.1;
  const questionBorderAlpha = isDark ? 0.3 : 0.2;
  const gridLightAlpha = isDark ? 0.1 : 0.06;
  const gridMediumAlpha = isDark ? 0.12 : 0.08;
  const gridStrongAlpha = isDark ? 0.14 : 0.1;

  return {
    "--md-accent": accent,
    "--md-question-bg": toRgba(rgb, questionBgAlpha),
    "--md-question-border": toRgba(rgb, questionBorderAlpha),
    "--md-grid-line-accent-light": toRgba(rgb, gridLightAlpha),
    "--md-grid-line-accent-medium": toRgba(rgb, gridMediumAlpha),
    "--md-grid-line-accent-strong": toRgba(rgb, gridStrongAlpha),
    "--md-grid-dot": "var(--md-grid-line-accent)",
  };
};
