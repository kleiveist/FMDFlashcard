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
  convertFileSrc: vi.fn((path: string) => path),
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

  it("normalizes vault registry entries with status and error metadata", () => {
    const stored = {
      recent_vaults: [
        {
          path: "/vaults/missing-one",
          last_opened_at: "2025-01-01T00:00:00.000Z",
          status: "missing",
          last_error: "Path does not exist.",
        },
      ],
    } as unknown as AppSettings;
    const { settings } = normalizeSettings(stored);

    expect(settings.recentVaults).toHaveLength(1);
    expect(settings.recentVaults[0]).toMatchObject({
      id: "vault:/vaults/missing-one",
      path: "/vaults/missing-one",
      status: "missing",
      lastError: "Path does not exist.",
    });
  });
});
