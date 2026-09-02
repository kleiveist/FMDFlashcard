/**
 * @file apps/fmd-desktop/src/features/settings/normalizeSettings.test.ts
 *
 * Zweck:
 * - Tests fuer normalizeSettings (Defaults + Validierung).
 */

import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS,
  DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS,
  filterRecentVaultsForSystem,
  mergeRecentVaultsForSystem,
  normalizeSettings,
  type AppSettings,
  type RecentVaultEntry,
} from "./useAppSettings";

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
    expect(settings.markdownEditorOpenInNewTabByDefault).toBe(false);
  });

  it("restores stored markdown new-tab default when present", () => {
    const { settings } = normalizeSettings({
      editor_markdown_open_in_new_tab_by_default: true,
    } as AppSettings);

    expect(settings.markdownEditorOpenInNewTabByDefault).toBe(true);
  });

  it("normalizes Canvas custom color slots", () => {
    const { settings } = normalizeSettings({
      canvas: {
        customColors: [
          { slot: 1, name: "Signal", value: "ff0066" },
          { slot: 2, name: "", value: "not-a-color" },
          { slot: 8, name: "Ignored", value: "#111111" },
        ],
        lastPalette: "cards",
      },
    } as AppSettings);

    expect(settings.canvas.customColors).toHaveLength(6);
    expect(settings.canvas.customColors[0]).toEqual({
      slot: 1,
      name: "Signal",
      value: "#ff0066",
    });
    expect(settings.canvas.customColors[1]).toEqual({
      slot: 2,
      name: "Custom 2",
      value: null,
    });
    expect(settings.canvas.customColors[5]).toEqual({
      slot: 6,
      name: "Custom 6",
      value: null,
    });
    expect(settings.canvas.lastPalette).toBe("cards");
  });

  it("coerces invalid enum values to defaults", () => {
    const stored = {
      editor_blueprint_grid_intensity: "loud",
      editor_markdown_preview_default_mode: "invalid",
      design_mode: "future",
    } as AppSettings;
    const { settings } = normalizeSettings(stored);

    expect(settings.editorBlueprintGridIntensity).toBe("medium");
    expect(settings.markdownPreviewDefaultMode).toBe("markdown");
    expect(settings.designMode).toBe("smart");
  });

  it("keeps hybrid as a valid markdown preview default mode", () => {
    const { settings } = normalizeSettings({
      editor_markdown_preview_default_mode: "hybrid",
    } as AppSettings);

    expect(settings.markdownPreviewDefaultMode).toBe("hybrid");
  });

  it("restores stored design mode when valid", () => {
    const { settings } = normalizeSettings({
      design_mode: "modern",
    } as AppSettings);

    expect(settings.designMode).toBe("modern");
  });

  it("restores desktop design mode when valid", () => {
    const { settings } = normalizeSettings({
      design_mode: "desktop",
    } as AppSettings);

    expect(settings.designMode).toBe("desktop");
  });

  it("migrates legacy edge design mode to desktop", () => {
    const { settings } = normalizeSettings({
      design_mode: "edge",
    } as AppSettings);

    expect(settings.designMode).toBe("desktop");
  });

  it("supports new and legacy cursor accessory settings keys", () => {
    const fromNewKey = normalizeSettings({
      ui_cursor_accessory_enabled: false,
    } as AppSettings);
    expect(fromNewKey.settings.cursorAccessoryEnabled).toBe(false);

    const fromLegacyKey = normalizeSettings({
      editor_markdown_backslash_enabled: false,
    } as AppSettings);
    expect(fromLegacyKey.settings.cursorAccessoryEnabled).toBe(false);
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

  it("keeps entries with the same path when they belong to different systems", () => {
    const stored = {
      recent_vaults: [
        {
          path: "/vaults/shared",
          systemId: "linux-a",
          last_opened_at: "2025-01-01T00:00:00.000Z",
        },
        {
          path: "/vaults/shared",
          systemId: "windows-b",
          last_opened_at: "2025-01-02T00:00:00.000Z",
        },
      ],
    } as unknown as AppSettings;
    const { settings } = normalizeSettings(stored);

    expect(settings.recentVaults).toHaveLength(2);
    expect(settings.recentVaults[0]?.systemId).toBe("linux-a");
    expect(settings.recentVaults[1]?.systemId).toBe("windows-b");
  });

  it("filters legacy entries without system id out of current system vault list", () => {
    const entries: RecentVaultEntry[] = [
      {
        id: "vault:/legacy",
        path: "/legacy",
        systemId: null,
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
        status: "available",
        lastSeenAt: "2025-01-01T00:00:00.000Z",
        lastError: null,
      },
      {
        id: "vault:linux-a:/local",
        path: "/local",
        systemId: "linux-a",
        lastOpenedAt: "2025-01-02T00:00:00.000Z",
        status: "available",
        lastSeenAt: "2025-01-02T00:00:00.000Z",
        lastError: null,
      },
    ];

    const filtered = filterRecentVaultsForSystem(entries, "linux-a");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.path).toBe("/local");
  });

  it("merges current-system updates while preserving foreign and legacy slices", () => {
    const allEntries: RecentVaultEntry[] = [
      {
        id: "vault:linux-a:/old",
        path: "/old",
        systemId: "linux-a",
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
        status: "available",
        lastSeenAt: "2025-01-01T00:00:00.000Z",
        lastError: null,
      },
      {
        id: "vault:windows-b:/foreign",
        path: "/foreign",
        systemId: "windows-b",
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
        status: "missing",
        lastSeenAt: null,
        lastError: "missing",
      },
      {
        id: "vault:/legacy",
        path: "/legacy",
        systemId: null,
        lastOpenedAt: "2025-01-01T00:00:00.000Z",
        status: "available",
        lastSeenAt: "2025-01-01T00:00:00.000Z",
        lastError: null,
      },
    ];
    const nextLinuxSlice: RecentVaultEntry[] = [
      {
        id: "vault:linux-a:/new",
        path: "/new",
        systemId: "linux-a",
        lastOpenedAt: "2025-01-03T00:00:00.000Z",
        status: "available",
        lastSeenAt: "2025-01-03T00:00:00.000Z",
        lastError: null,
      },
    ];

    const merged = mergeRecentVaultsForSystem(allEntries, nextLinuxSlice, "linux-a");

    expect(merged.find((entry) => entry.path === "/new")?.systemId).toBe("linux-a");
    expect(merged.find((entry) => entry.path === "/old")).toBeUndefined();
    expect(merged.find((entry) => entry.path === "/foreign")?.systemId).toBe("windows-b");
    expect(merged.find((entry) => entry.path === "/legacy")?.systemId ?? null).toBeNull();
  });

  it("applies defaults for auto-time flags and per-type exam seconds", () => {
    const { settings } = normalizeSettings({} as AppSettings);

    expect(settings.fastFlashcardAutoTimeEnabled).toBe(false);
    expect(settings.spacedRepetitionAutoTimeEnabled).toBe(false);
    expect(settings.examShowTaskSources).toBe(true);
    expect(settings.examTaskTypeDefaultTimeSeconds).toEqual(
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS,
    );
  });

  it("restores stored task source visibility toggle", () => {
    const { settings } = normalizeSettings({
      exam_show_task_sources: false,
    } as AppSettings);

    expect(settings.examShowTaskSources).toBe(false);
  });

  it("restores stored auto-time settings and normalizes seconds map", () => {
    const stored = {
      fast_flashcard_auto_time_enabled: true,
      spaced_repetition_auto_time_enabled: true,
      exam_task_type_default_time_seconds: {
        qa: 10,
        tf: -2,
        m1: 7,
      },
    } as AppSettings;
    const { settings } = normalizeSettings(stored);

    expect(settings.fastFlashcardAutoTimeEnabled).toBe(true);
    expect(settings.spacedRepetitionAutoTimeEnabled).toBe(true);
    expect(settings.examTaskTypeDefaultTimeSeconds.qa).toBe(10);
    expect(settings.examTaskTypeDefaultTimeSeconds.tf).toBe(0);
    expect(settings.examTaskTypeDefaultTimeSeconds.m1).toBe(7);
    expect(settings.examTaskTypeDefaultTimeSeconds.m2).toBe(
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.m2,
    );
  });

  it("migrates legacy exam task-type defaults to current defaults", () => {
    const stored = {
      exam_task_type_default_points: {
        qa: 10,
        tf: 1,
        m1: 3,
        m2: 5,
        cl: 6,
        cd: 5,
        cld: 8,
      },
      exam_task_type_default_time_seconds: {
        qa: 480,
        tf: 45,
        m1: 90,
        m2: 120,
        cl: 240,
        cd: 160,
        cld: 480,
      },
    } as AppSettings;

    const normalized = normalizeSettings(stored);

    expect(normalized.settings.examTaskTypeDefaultPoints).toEqual(
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS,
    );
    expect(normalized.settings.examTaskTypeDefaultTimeSeconds).toEqual(
      DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS,
    );
    expect(normalized.needsExamTaskTypeDefaultsMigration).toBe(true);
  });

  it("keeps non-legacy exam task-type defaults unchanged", () => {
    const stored = {
      exam_task_type_default_points: {
        qa: 10,
        tf: 1,
        m1: 3,
        m2: 5,
        cl: 6,
        cd: 5,
        cld: 7,
      },
      exam_task_type_default_time_seconds: {
        qa: 480,
        tf: 45,
        m1: 90,
        m2: 120,
        cl: 240,
        cd: 160,
        cld: 480,
      },
    } as AppSettings;

    const normalized = normalizeSettings(stored);

    expect(normalized.settings.examTaskTypeDefaultPoints).toMatchObject({
      qa: 10,
      tf: 1,
      m1: 3,
      m2: 5,
      cl: 6,
      cd: 5,
      cld: 7,
    });
    expect(normalized.settings.examTaskTypeDefaultTimeSeconds).toMatchObject({
      qa: 480,
      tf: 45,
      m1: 90,
      m2: 120,
      cl: 240,
      cd: 160,
      cld: 480,
    });
    expect(normalized.needsExamTaskTypeDefaultsMigration).toBe(false);
  });

  it("normalizes per-user task-type defaults map", () => {
    const stored = {
      exam_task_type_defaults_by_user_id: {
        "user-a": {
          points: { qa: 11, tf: -1 },
          timeSeconds: { qa: 500, tf: -2 },
        },
      },
    } as AppSettings;

    const normalized = normalizeSettings(stored);

    expect(normalized.settings.examTaskTypeDefaultsByUserId["user-a"]).toEqual({
      points: {
        qa: 11,
        tf: 0,
        m1: DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS.m1,
        m2: DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS.m2,
        cl: DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS.cl,
        cd: DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS.cd,
        cld: DEFAULT_EXAM_TASK_TYPE_DEFAULT_POINTS.cld,
      },
      timeSeconds: {
        qa: 500,
        tf: 0,
        m1: DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.m1,
        m2: DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.m2,
        cl: DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.cl,
        cd: DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.cd,
        cld: DEFAULT_EXAM_TASK_TYPE_DEFAULT_TIME_SECONDS.cld,
      },
    });
  });

  it("drops invalid per-user task-type default entries", () => {
    const stored = {
      exam_task_type_defaults_by_user_id: {
        "": {
          points: { qa: 9 },
          timeSeconds: { qa: 90 },
        },
        "user-b": null,
        "user-c": {
          points: null,
          timeSeconds: null,
        },
      },
    } as AppSettings;

    const normalized = normalizeSettings(stored);

    expect(normalized.settings.examTaskTypeDefaultsByUserId).toEqual({});
  });

  it("keeps backward compatibility when per-user defaults field is missing", () => {
    const stored = {
      exam_task_type_default_points: {
        qa: 7,
      },
      exam_task_type_default_time_seconds: {
        qa: 70,
      },
    } as AppSettings;

    const normalized = normalizeSettings(stored);

    expect(normalized.settings.examTaskTypeDefaultPoints.qa).toBe(7);
    expect(normalized.settings.examTaskTypeDefaultTimeSeconds.qa).toBe(70);
    expect(normalized.settings.examTaskTypeDefaultsByUserId).toEqual({});
  });

  it("normalizes and deduplicates formula registry entries case-insensitively", () => {
    const normalized = normalizeSettings({
      formula_attribute_registry: [
        {
          key: "f-Score",
          definition: {
            version: 1,
            operation: "count",
            attributeKeys: ["score"],
            source: { type: "current-folder" },
            shortTextRule: {
              maxChars: 32,
              maxTokens: 3,
              requireSingleNumericCore: true,
            },
          },
        },
        {
          key: "f-score",
          definition: {
            version: 1,
            operation: "sum",
            attributeKeys: ["score"],
            source: { type: "current-folder" },
            shortTextRule: {
              maxChars: 40,
              maxTokens: 4,
              requireSingleNumericCore: true,
            },
          },
        },
        {
          key: "not-a-formula",
          definition: {},
        },
      ],
    } as unknown as AppSettings);

    expect(normalized.settings.formulaAttributeRegistry).toHaveLength(1);
    expect(normalized.settings.formulaAttributeRegistry[0]).toMatchObject({
      key: "f-score",
      definition: {
        operation: "sum",
      },
    });
  });

  it("keeps backward compatibility when formula registry field is missing", () => {
    const normalized = normalizeSettings({} as AppSettings);

    expect(normalized.settings.formulaAttributeRegistry).toEqual([]);
  });
});
