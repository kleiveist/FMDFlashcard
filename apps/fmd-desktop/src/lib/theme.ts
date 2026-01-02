import { buildAccentTokens } from "./color";

export type ThemeMode = "light" | "dark";

export const applyTheme = (theme: ThemeMode) => {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
};

export const applyAccentColor = (value: string) => {
  const root = document.documentElement;
  const tokens = buildAccentTokens(value);
  root.style.setProperty("--accent", tokens.accent);
  root.style.setProperty("--accent-strong", tokens.accentStrong);
  root.style.setProperty("--accent-soft", tokens.accentSoft);
  root.style.setProperty("--accent-highlight", tokens.accentHighlight);
  root.style.setProperty("--accent-border", tokens.accentBorder);
  root.style.setProperty("--accent-contrast", tokens.accentContrast);
  root.style.setProperty("--accent-contrast-strong", tokens.accentContrastStrong);
};
