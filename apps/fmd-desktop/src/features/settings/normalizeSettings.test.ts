/**
 * @file apps/fmd-desktop/src/features/settings/normalizeSettings.test.ts
 *
 * Zweck:
 * - Tests fuer normalizeSettings (Defaults + Validierung).
 */

import { describe, expect, it, vi } from "vitest";
import { normalizeSettings, type AppSettings } from "./useAppSettings";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

describe("normalizeSettings", () => {
  it("adds defaults for missing markdown preview settings", () => {
    const stored: AppSettings = { theme: "dark" };
    const { settings } = normalizeSettings(stored);

    expect(settings.markdownViewEditEnabled).toBe(false);
    expect(settings.markdownPreviewDefaultMode).toBe("markdown");
  });

  it("coerces invalid enum values to defaults", () => {
    const stored = {
      editor_blueprint_grid_intensity: "loud",
      editor_markdown_preview_default_mode: "invalid",
    } as AppSettings;
    const { settings } = normalizeSettings(stored);

    expect(settings.editorBlueprintGridIntensity).toBe("medium");
    expect(settings.markdownPreviewDefaultMode).toBe("markdown");
  });
});
