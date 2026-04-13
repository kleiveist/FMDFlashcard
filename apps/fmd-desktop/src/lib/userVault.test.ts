/**
 * @file apps/fmd-desktop/src/lib/userVault.test.ts
 *
 * Zweck:
 * - Tests fuer User Vault Hilfsfunktionen.
 */

import { describe, expect, it } from "vitest";
import {
  buildProfileId,
  createEmptyProfileData,
  formatDateStamp,
  mergeProfileData,
  parseProfileId,
  resolveActiveProfileRoot,
  resolveCustomProfileRootPath,
  sanitizeProfileName,
  selectProfileFromExport,
  type UserVaultExportPayload,
  type UserVaultProfileData,
} from "./userVault";

describe("sanitizeProfileName", () => {
  it("normalizes whitespace and strips invalid path characters", () => {
    expect(sanitizeProfileName("  Jane Doe ")).toBe("Jane-Doe");
    expect(sanitizeProfileName("Dev/Prod")).toBe("Dev-Prod");
    expect(sanitizeProfileName("Test:Run*")).toBe("Test-Run");
  });
});

describe("buildProfileId", () => {
  it("combines date stamp and sanitized name", () => {
    const date = new Date(Date.UTC(2026, 0, 14, 12, 0, 0));
    const dateStamp = formatDateStamp(date);
    expect(buildProfileId("Mein Loard", date)).toBe(`${dateStamp}_Mein-Loard`);
  });
});

describe("parseProfileId", () => {
  it("extracts date stamp and name", () => {
    expect(parseProfileId("2026-01-14_MeinLoard")).toEqual({
      dateStamp: "2026-01-14",
      name: "MeinLoard",
    });
  });

  it("falls back to raw value if no date prefix exists", () => {
    expect(parseProfileId("LegacyUser")).toEqual({ dateStamp: "", name: "LegacyUser" });
  });
});

describe("resolveActiveProfileRoot", () => {
  it("resolves auto mode to vault/.profile", () => {
    expect(resolveActiveProfileRoot("auto", "/vault/main", null)).toBe(
      "/vault/main/.profile",
    );
    expect(resolveActiveProfileRoot("auto", "C:\\Vault\\Main", null)).toBe(
      "C:\\Vault\\Main\\.profile",
    );
  });

  it("normalizes custom path to a profile subfolder", () => {
    expect(
      resolveActiveProfileRoot("custom", "/vault/main", "  /data/user "),
    ).toBe("/data/user/.profile");
    expect(
      resolveActiveProfileRoot("custom", "/vault/main", "C:\\Vault\\Portable\\"),
    ).toBe("C:\\Vault\\Portable\\.profile");
  });

  it("keeps custom path when it already points to profile", () => {
    expect(
      resolveActiveProfileRoot("custom", "/vault/main", "/data/user/profile"),
    ).toBe("/data/user/profile");
    expect(
      resolveActiveProfileRoot(
        "custom",
        "/vault/main",
        "C:\\Vault\\Portable\\profile\\",
      ),
    ).toBe("C:\\Vault\\Portable\\profile");
  });

  it("returns null when custom mode has no path", () => {
    expect(resolveActiveProfileRoot("custom", "/vault/main", null)).toBeNull();
    expect(resolveActiveProfileRoot("custom", "/vault/main", " ")).toBeNull();
  });

  it("ignores custom path when mode is auto", () => {
    expect(resolveActiveProfileRoot("auto", "/vault/main", "/custom/root")).toBe(
      "/vault/main/.profile",
    );
  });
});

describe("resolveCustomProfileRootPath", () => {
  it("appends profile when selecting a parent folder", () => {
    expect(resolveCustomProfileRootPath("/workspace/IUFS")).toBe(
      "/workspace/IUFS/.profile",
    );
    expect(resolveCustomProfileRootPath("D:\\workspace\\IUFS\\")).toBe(
      "D:\\workspace\\IUFS\\.profile",
    );
    expect(resolveCustomProfileRootPath("X:\\workspace\\IUFS\\SE1")).toBe(
      "X:\\workspace\\IUFS\\SE1\\.profile",
    );
  });

  it("keeps existing profile folders untouched", () => {
    expect(resolveCustomProfileRootPath("/workspace/IUFS/profile")).toBe(
      "/workspace/IUFS/profile",
    );
    expect(resolveCustomProfileRootPath("D:\\workspace\\IUFS\\profile\\")).toBe(
      "D:\\workspace\\IUFS\\profile",
    );
  });

  it("returns null for empty values", () => {
    expect(resolveCustomProfileRootPath(null)).toBeNull();
    expect(resolveCustomProfileRootPath("   ")).toBeNull();
  });
});


describe("mergeProfileData", () => {
  const base: UserVaultProfileData = {
    ...createEmptyProfileData(),
    spacedRepetitionByVaultId: {
      vault1: {
        users: [{ id: "u1", name: "User 1", createdAt: "2026-01-14" }],
        userStateById: {
          u1: { cardStates: {}, lastLoadedAt: null, completedPerDay: {} },
        },
        lastActiveUserId: "u1",
      },
    },
    fastFlashcardSessions: [{ id: "s1", endedAt: "2026-01-14", score: 10, correct: 1, incorrect: 0, total: 1, accuracy: 100, pace: 1, durationMs: 1000 }],
    examRuns: [
      {
        id: "e1",
        startedAt: "2026-01-14",
        endedAt: "2026-01-14",
        durationMs: 1000,
        userId: null,
        userName: "User",
        examFilePath: "/vault/exam.md",
        tasksDetected: 1,
        maxPoints: 10,
        achievedPoints: 10,
        percent: 100,
        passed: true,
        grade: "1",
        gradeScaleId: "standard-1-6",
      },
    ],
  };

  const incoming: UserVaultProfileData = {
    ...createEmptyProfileData(),
    spacedRepetitionByVaultId: {
      vault1: {
        users: [{ id: "u2", name: "User 2", createdAt: "2026-01-15" }],
        userStateById: {
          u2: { cardStates: {}, lastLoadedAt: null, completedPerDay: {} },
        },
        lastActiveUserId: "u2",
      },
    },
    fastFlashcardSessions: [
      { id: "s1", endedAt: "2026-01-13", score: 5, correct: 0, incorrect: 1, total: 1, accuracy: 0, pace: 1, durationMs: 1000 },
      { id: "s2", endedAt: "2026-01-15", score: 15, correct: 2, incorrect: 0, total: 2, accuracy: 100, pace: 1, durationMs: 1000 },
    ],
    examRuns: [
      {
        id: "e1",
        startedAt: "2026-01-13",
        endedAt: "2026-01-13",
        durationMs: 1000,
        userId: null,
        userName: "User",
        examFilePath: "/vault/exam.md",
        tasksDetected: 1,
        maxPoints: 10,
        achievedPoints: 8,
        percent: 80,
        passed: true,
        grade: "2",
        gradeScaleId: "standard-1-6",
      },
      {
        id: "e2",
        startedAt: "2026-01-15",
        endedAt: "2026-01-15",
        durationMs: 1000,
        userId: null,
        userName: "User",
        examFilePath: "/vault/exam-2.md",
        tasksDetected: 1,
        maxPoints: 10,
        achievedPoints: 10,
        percent: 100,
        passed: true,
        grade: "1",
        gradeScaleId: "standard-1-6",
      },
    ],
  };

  it("merges without overwriting existing entries", () => {
    const merged = mergeProfileData(base, incoming, "merge");
    expect(Object.keys(merged.spacedRepetitionByVaultId)).toEqual(["vault1"]);
    expect(merged.spacedRepetitionByVaultId.vault1?.users.length).toBe(2);
    expect(merged.fastFlashcardSessions.map((session) => session.id)).toEqual([
      "s1",
      "s2",
    ]);
    expect(merged.examRuns.map((run) => run.id)).toEqual(["e1", "e2"]);
  });

  it("overwrites when strategy is overwrite", () => {
    const merged = mergeProfileData(base, incoming, "overwrite");
    expect(merged.fastFlashcardSessions.map((session) => session.id)).toEqual([
      "s1",
      "s2",
    ]);
    expect(merged.examRuns.map((run) => run.id)).toEqual(["e1", "e2"]);
  });

  it("keeps settings when overwrite data has none", () => {
    const baseWithSettings: UserVaultProfileData = {
      ...createEmptyProfileData(),
      settings: { theme: "dark" },
    };
    const incomingWithoutSettings: UserVaultProfileData = {
      ...createEmptyProfileData(),
    };
    delete incomingWithoutSettings.settings;
    const merged = mergeProfileData(
      baseWithSettings,
      incomingWithoutSettings,
      "overwrite",
    );
    expect(merged.settings).toEqual({ theme: "dark" });
  });
});

describe("selectProfileFromExport", () => {
  it("returns a matching profile when available", () => {
    const payload: UserVaultExportPayload = {
      schemaVersion: 1,
      exportedAt: "2026-01-14",
      profiles: [
        {
          profile: { id: "p1", name: "User 1", createdAt: "2026-01-14" },
          data: createEmptyProfileData(),
        },
        {
          profile: { id: "p2", name: "User 2", createdAt: "2026-01-15" },
          data: createEmptyProfileData(),
        },
      ],
    };
    const entry = selectProfileFromExport(payload, "p2");
    expect(entry?.profile.id).toBe("p2");
  });

  it("returns the single profile export", () => {
    const payload: UserVaultExportPayload = {
      schemaVersion: 1,
      exportedAt: "2026-01-14",
      profile: { id: "single", name: "Solo", createdAt: "2026-01-14" },
      data: createEmptyProfileData(),
    };
    const entry = selectProfileFromExport(payload, null);
    expect(entry?.profile.id).toBe("single");
  });
});
