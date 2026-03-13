/**
 * @file apps/fmd-desktop/src/components/settings/AppearanceSection.test.ts
 *
 * Zweck:
 * - Tests fuer AppearanceSection Rendering (Designmodus-Auswahl).
 */

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { AppearanceSection } from "./AppearanceSection";

describe("AppearanceSection", () => {
  it("renders edge design option and marks it active", () => {
    const markup = renderToStaticMarkup(
      createElement(AppearanceSection, {
        accentColor: "#e07a5f",
        accentDraft: "#e07a5f",
        accentError: "",
        onAccentInputChange: vi.fn(),
        onAccentPick: vi.fn(),
        onCopyAccent: vi.fn(),
        onDesignModeChange: vi.fn(),
        onThemeToggle: vi.fn(),
        designMode: "edge",
        theme: "light",
      }),
    );

    expect(markup).toContain("Edge Design");
    expect(markup).toMatch(/design-mode-option active[^>]*>Edge Design</);
    expect(markup).toContain("aria-label=\"Designmodus auswaehlen\"");
  });
});
