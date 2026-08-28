/**
 * @file frontend/src/lib/markdownEditorColors.test.ts
 */

import { describe, expect, it } from "vitest";
import { deriveMarkdownEditorColors } from "./markdownEditorColors";
import { DEFAULT_ACCENT } from "./color";

describe("deriveMarkdownEditorColors", () => {
  it("derives accent-based rgba values for light mode", () => {
    const vars = deriveMarkdownEditorColors({
      accentHex: "#336699",
      themeMode: "light",
    });

    expect(vars["--md-accent"]).toBe("#336699");
    expect(vars["--md-question-bg"]).toBe("rgba(51, 102, 153, 0.1)");
    expect(vars["--md-question-border"]).toBe("rgba(51, 102, 153, 0.2)");
    expect(vars["--md-grid-line-accent-light"]).toBe("rgba(51, 102, 153, 0.06)");
    expect(vars["--md-grid-line-accent-medium"]).toBe("rgba(51, 102, 153, 0.08)");
    expect(vars["--md-grid-line-accent-strong"]).toBe("rgba(51, 102, 153, 0.1)");
  });

  it("uses stronger alphas for dark mode", () => {
    const vars = deriveMarkdownEditorColors({
      accentHex: "#336699",
      themeMode: "dark",
    });

    expect(vars["--md-question-bg"]).toBe("rgba(51, 102, 153, 0.18)");
    expect(vars["--md-question-border"]).toBe("rgba(51, 102, 153, 0.3)");
    expect(vars["--md-grid-line-accent-medium"]).toBe("rgba(51, 102, 153, 0.12)");
  });

  it("adds editor surface background vars only when explicitly enabled", () => {
    const disabledVars = deriveMarkdownEditorColors({
      accentHex: "#336699",
      themeMode: "light",
    });
    expect(disabledVars["--md-surface-bg"]).toBeUndefined();
    expect(disabledVars["--md-editor-bg"]).toBeUndefined();

    const enabledVars = deriveMarkdownEditorColors({
      accentHex: "#336699",
      themeMode: "light",
      includeSurfaceBackgrounds: true,
    });
    expect(enabledVars["--md-surface-bg"]).toBe(
      "color-mix(in srgb, var(--preview-bg) 92%, #336699 8%)",
    );
    expect(enabledVars["--md-editor-bg"]).toBe(
      "color-mix(in srgb, var(--preview-bg) 92%, #336699 8%)",
    );
    expect(enabledVars["--md-table-bg"]).toBe(
      "color-mix(in srgb, var(--preview-bg) 90%, #336699 10%)",
    );
    expect(enabledVars["--md-table-head-bg"]).toBe(
      "color-mix(in srgb, var(--panel-warm) 86%, #336699 14%)",
    );
  });

  it("falls back to the default accent for invalid hex values", () => {
    const vars = deriveMarkdownEditorColors({
      accentHex: "bad-value",
      themeMode: "light",
    });

    expect(vars["--md-accent"]).toBe(DEFAULT_ACCENT);
    expect(vars["--md-question-bg"]).toBe("rgba(224, 122, 95, 0.1)");
  });
});
