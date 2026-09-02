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
  it("renders desktop design option and marks it active", () => {
    const markup = renderToStaticMarkup(
      createElement(AppearanceSection, {
        language: "en",
        accentColor: "#e07a5f",
        accentDraft: "#e07a5f",
        accentError: "",
        onAccentInputChange: vi.fn(),
        onAccentPick: vi.fn(),
        onCopyAccent: vi.fn(),
        markdownEditorAccentEnabled: false,
        markdownEditorAccentLightHex: "#e07a5f",
        markdownEditorAccentDarkHex: "#e07a5f",
        editorBlueprintGrid: false,
        editorBlueprintGridIntensity: "medium",
        onMarkdownEditorAccentEnabledToggle: vi.fn(),
        onMarkdownEditorAccentHexChange: vi.fn(),
        onEditorBlueprintGridToggle: vi.fn(),
        onEditorBlueprintGridIntensityChange: vi.fn(),
        onDesignModeChange: vi.fn(),
        onThemeToggle: vi.fn(),
        designMode: "desktop",
        theme: "light",
      }),
    );

    expect(markup).toContain("Desktop Design");
    expect(markup).toMatch(/design-mode-option active[^>]*>Desktop Design</);
    expect(markup).not.toContain("Edge Design");
    expect(markup).toContain('aria-label="Designmodus auswaehlen"');
    expect(markup).toContain('aria-label="Appearance pages"');
    expect(markup).toContain(">Accent Editor<");
    expect(markup).not.toContain(">Editor Accent<");
    expect(markup).toContain('id="settings-appearance-tab-appearance"');
    expect(markup).toContain('aria-controls="settings-appearance-panel-appearance"');
    expect(markup).toContain('id="settings-appearance-panel-appearance"');
    expect(markup).toContain('aria-labelledby="settings-appearance-tab-appearance"');
    expect(markup).toContain('id="settings-appearance-tab-editor-accent"');
    expect(markup).toContain('aria-controls="settings-appearance-panel-editor-accent"');
    expect(markup).toContain('id="settings-appearance-panel-editor-accent"');
    expect(markup).toContain('aria-labelledby="settings-appearance-tab-editor-accent"');
    expect(markup).toMatch(/id="settings-appearance-panel-editor-accent"[^>]*hidden=""/);
    expect(markup).not.toMatch(/id="settings-appearance-panel-appearance"[^>]*hidden=""/);
    const tabsIndex = markup.indexOf('aria-label="Appearance pages"');
    const appearancePanelIndex = markup.indexOf('class="panel appearance-panel"');
    expect(tabsIndex).toBeGreaterThanOrEqual(0);
    expect(appearancePanelIndex).toBeGreaterThanOrEqual(0);
    expect(tabsIndex).toBeLessThan(appearancePanelIndex);
  });
});
