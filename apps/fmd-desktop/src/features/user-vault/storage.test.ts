/**
 * @file apps/fmd-desktop/src/features/user-vault/storage.test.ts
 *
 * Zweck:
 * - Tests fuer User-Vault Persistenz (Profile Settings + Exam Runs).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  appendExamRunStore,
  deleteExamRunStoreEntry,
  ensureProfileRoot,
  loadExamRunStore,
  loadProfileSettings,
  loadSpacedRepetitionStore,
  saveProfileSettings,
  saveSpacedRepetitionStore,
} from "./storage";
import type { ExamRun } from "../../lib/examRuns";
import type { SpacedRepetitionStorage } from "../spaced-repetition/logic";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
  convertFileSrc: vi.fn((path: string) => path),
}));

const invokeMock = vi.mocked(invoke);
const files = new Map<string, string>();
const directories = new Set<string>();

const normalizePath = (value: string) => value.replace(/\\/g, "/").replace(/\/+$/, "");

const buildRun = (id: string): ExamRun => ({
  id,
  startedAt: "2024-01-01T10:00:00.000Z",
  endedAt: "2024-01-01T10:10:00.000Z",
  durationMs: 600000,
  userId: "user",
  userName: "User",
  examFilePath: "exam.md",
  tasksDetected: 5,
  maxPoints: 20,
  achievedPoints: 10,
  percent: 50,
  passed: true,
  grade: "5",
  gradeScaleId: "standard-1-6",
});

const getProfileFilePath = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/profile.json`;

const getSettingsFilePath = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/settings.json`;

const getExamRunsDir = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/exam-runs`;

const getSrRegistryPath = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/spaced-repetition/registry.json`;

const getSrProgressPath = (profilePath: string, userId: string) =>
  `${profilePath.replace(/\\/g, "/")}/spaced-repetition/users/${encodeURIComponent(
    userId,
  )}/progress.json`;

const srProgress = (
  boxCanonical: number,
  attempts: number,
  lastReviewedAt: string | null,
) => ({
  boxCanonical,
  attempts,
  lastResult: attempts > 0 ? ("correct" as const) : ("neutral" as const),
  lastReviewedAt,
});

const buildSrStorage = (
  userId: string,
  cardStates: SpacedRepetitionStorage["userStateById"][string]["cardStates"] = {},
): SpacedRepetitionStorage => ({
  users: [{ id: userId, name: `User ${userId}`, createdAt: "2024-01-01" }],
  userStateById: {
    [userId]: {
      cardStates,
      completedPerDay: {},
      lastLoadedAt: null,
    },
  },
  lastActiveUserId: userId,
});

beforeEach(() => {
  files.clear();
  directories.clear();
  invokeMock.mockReset();
  invokeMock.mockImplementation(async (command, args) => {
    if (command === "read_json_file") {
      const path = String((args as { path?: string })?.path ?? "");
      if (!files.has(path)) {
        throw new Error("File not found.");
      }
      return files.get(path) ?? "";
    }
    if (command === "write_json_file") {
      const { path, contents } = args as { path: string; contents: string };
      files.set(path, contents);
      return null;
    }
    if (command === "rename_json_file") {
      const { from, to } = args as { from: string; to: string };
      if (!files.has(from)) {
        throw new Error("Source file not found.");
      }
      const contents = files.get(from) ?? "";
      files.delete(from);
      files.set(to, contents);
      return null;
    }
    if (command === "get_path_info") {
      const path = normalizePath(String((args as { path?: string })?.path ?? ""));
      const isDir = directories.has(path);
      const isFile = files.has(path);
      return {
        exists: isDir || isFile,
        isDir,
      };
    }
    if (command === "ensure_directory") {
      const path = normalizePath(String((args as { path?: string })?.path ?? ""));
      directories.add(path);
      return null;
    }
    if (command === "list_files") {
      const path = normalizePath(String((args as { path?: string })?.path ?? ""));
      if (!directories.has(path)) {
        return [];
      }
      const prefix = path ? `${path}/` : "";
      return Array.from(files.keys()).filter((entry) => entry.startsWith(prefix));
    }
    if (command === "list_directories") {
      const path = normalizePath(String((args as { path?: string })?.path ?? ""));
      if (!directories.has(path)) {
        throw new Error("Path does not exist");
      }
      const prefix = path ? `${path}/` : "";
      const entries = new Set<string>();
      directories.forEach((entry) => {
        if (!prefix || !entry.startsWith(prefix)) {
          return;
        }
        const rest = entry.slice(prefix.length);
        const first = rest.split("/")[0] ?? "";
        if (first) {
          entries.add(first);
        }
      });
      return Array.from(entries);
    }
    if (command === "read_text_file") {
      const path = String((args as { path?: string })?.path ?? "");
      if (!files.has(path)) {
        throw new Error("File not found.");
      }
      return files.get(path) ?? "";
    }
    if (command === "write_text_file") {
      const { path, contents } = args as { path: string; contents: string };
      files.set(path, contents);
      return null;
    }
    if (command === "delete_file") {
      const path = String((args as { path?: string })?.path ?? "");
      if (!files.has(path)) {
        throw new Error("File not found.");
      }
      files.delete(path);
      return null;
    }
    throw new Error(`Unknown command: ${String(command)}`);
  });
});

describe("ensureProfileRoot", () => {
  it("creates a missing profile root and initializes user-vault.json", async () => {
    const profileRoot = "/vault/.profile";

    const result = await ensureProfileRoot(profileRoot);

    expect(result).toEqual({ ok: true, reason: "" });
    expect(directories.has("/vault/.profile")).toBe(true);
    const meta = JSON.parse(files.get("/vault/.profile/user-vault.json") ?? "{}");
    expect(meta.schemaVersion).toBe(1);
    expect(meta.activeProfileId).toBeNull();
  });

  it("rewrites invalid user-vault.json metadata", async () => {
    const profileRoot = "/vault/.profile";
    directories.add(profileRoot);
    files.set("/vault/.profile/user-vault.json", "{broken");

    const result = await ensureProfileRoot(profileRoot);

    expect(result).toEqual({ ok: true, reason: "" });
    const meta = JSON.parse(files.get("/vault/.profile/user-vault.json") ?? "{}");
    expect(meta.schemaVersion).toBe(1);
    expect(meta.activeProfileId).toBeNull();
  });

  it("returns an error when the profile root points to a file", async () => {
    files.set("/vault/.profile", "{}");

    const result = await ensureProfileRoot("/vault/.profile");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Profile root is not a directory.");
  });
});

describe("loadProfileSettings", () => {
  it("migrates legacy profile.json settings into settings.json", async () => {
    const profilePath = "/profiles/alpha";
    const profileFile = getProfileFilePath(profilePath);
    const settingsFile = getSettingsFilePath(profilePath);
    files.set(
      profileFile,
      JSON.stringify({
        id: "alpha",
        name: "Alpha",
        createdAt: "2024-01-01T00:00:00.000Z",
        settings: { theme: "dark" },
      }),
    );

    const settings = await loadProfileSettings(profilePath);

    expect(settings).toEqual({ theme: "dark" });
    expect(JSON.parse(files.get(settingsFile) ?? "{}")).toEqual({ theme: "dark" });
    const migratedProfile = JSON.parse(files.get(profileFile) ?? "{}");
    expect(migratedProfile).toEqual({
      schemaVersion: 1,
      id: "alpha",
      name: "Alpha",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("prefers settings.json over legacy embedded profile settings", async () => {
    const profilePath = "/profiles/alpha";
    const profileFile = getProfileFilePath(profilePath);
    const settingsFile = getSettingsFilePath(profilePath);
    files.set(
      profileFile,
      JSON.stringify({
        schemaVersion: 1,
        id: "alpha",
        name: "Alpha",
        createdAt: "2024-01-01T00:00:00.000Z",
        settings: { theme: "legacy-dark" },
      }),
    );
    files.set(settingsFile, JSON.stringify({ theme: "light" }));

    const settings = await loadProfileSettings(profilePath);

    expect(settings).toEqual({ theme: "light" });
  });
});

describe("saveProfileSettings", () => {
  it("writes profile settings into settings.json and keeps profile.json metadata-only", async () => {
    const profilePath = "/profiles/alpha";
    const profileFile = getProfileFilePath(profilePath);
    const settingsFile = getSettingsFilePath(profilePath);
    files.set(
      profileFile,
      JSON.stringify({
        id: "alpha",
        name: "Alpha",
        createdAt: "2024-01-01T00:00:00.000Z",
        settings: { theme: "legacy" },
      }),
    );

    const saved = await saveProfileSettings(profilePath, { theme: "dark" });

    expect(saved).toBe(true);
    expect(JSON.parse(files.get(settingsFile) ?? "{}")).toEqual({ theme: "dark" });
    expect(JSON.parse(files.get(profileFile) ?? "{}")).toEqual({
      schemaVersion: 1,
      id: "alpha",
      name: "Alpha",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
  });

  it("removes settings.json when profile settings are cleared", async () => {
    const profilePath = "/profiles/alpha";
    const profileFile = getProfileFilePath(profilePath);
    const settingsFile = getSettingsFilePath(profilePath);
    files.set(
      profileFile,
      JSON.stringify({
        schemaVersion: 1,
        id: "alpha",
        name: "Alpha",
        createdAt: "2024-01-01T00:00:00.000Z",
      }),
    );
    files.set(settingsFile, JSON.stringify({ theme: "dark" }));

    const saved = await saveProfileSettings(profilePath, null);

    expect(saved).toBe(true);
    expect(files.has(settingsFile)).toBe(false);
  });
});

describe("spaced repetition folder storage", () => {
  it("writes and loads progress from one folder per SR user", async () => {
    const profilePath = "/profiles/sr";
    const storage = buildSrStorage("u1", {
      cardA: srProgress(2, 3, "2024-01-02T00:00:00.000Z"),
    });

    await saveSpacedRepetitionStore(profilePath, {
      schemaVersion: 2,
      byVaultId: { __profile__: storage },
      migratedVaultIds: [],
    });

    expect(files.has(getSrRegistryPath(profilePath))).toBe(true);
    expect(files.has(getSrProgressPath(profilePath, "u1"))).toBe(true);

    const loaded = await loadSpacedRepetitionStore(profilePath);
    const loadedStorage = loaded.byVaultId.__profile__;

    expect(loadedStorage?.users.map((user) => user.id)).toEqual(["u1"]);
    expect(loadedStorage?.lastActiveUserId).toBe("u1");
    expect(loadedStorage?.userStateById.u1.cardStates.cardA?.attempts).toBe(3);
  });

  it("migrates all legacy vault keys instead of preferring an empty current key", async () => {
    const profilePath = "/profiles/sr-legacy";
    const emptyStorage: SpacedRepetitionStorage = {
      users: [],
      userStateById: {},
      lastActiveUserId: null,
    };
    const filledStorage = buildSrStorage("u1", {
      cardA: srProgress(3, 4, "2024-01-03T00:00:00.000Z"),
    });
    files.set(
      `${profilePath}/spaced-repetition.json`,
      JSON.stringify({
        schemaVersion: 1,
        byVaultId: {
          currentEmpty: emptyStorage,
          filledLegacy: filledStorage,
        },
        migratedVaultIds: [],
      }),
    );

    const loaded = await loadSpacedRepetitionStore(profilePath);
    const loadedStorage = loaded.byVaultId.__profile__;
    const registry = JSON.parse(files.get(getSrRegistryPath(profilePath)) ?? "{}");

    expect(loadedStorage?.users.map((user) => user.id)).toEqual(["u1"]);
    expect(loadedStorage?.userStateById.u1.cardStates.cardA?.boxCanonical).toBe(3);
    expect(registry.legacyVaultIds.sort()).toEqual([
      "currentEmpty",
      "filledLegacy",
    ]);
  });

  it("deduplicates legacy users and keeps the newest card progress", async () => {
    const profilePath = "/profiles/sr-merge";
    const older = buildSrStorage("u1", {
      cardA: srProgress(5, 8, "2024-01-01T00:00:00.000Z"),
    });
    older.userStateById.u1.completedPerDay = { "2024-01-01": 2 };
    const newer = buildSrStorage("u1", {
      cardA: srProgress(2, 1, "2024-01-02T00:00:00.000Z"),
      cardB: srProgress(1, 1, "2024-01-02T00:00:00.000Z"),
    });
    newer.userStateById.u1.completedPerDay = { "2024-01-01": 5 };
    files.set(
      `${profilePath}/spaced-repetition.json`,
      JSON.stringify({
        schemaVersion: 1,
        byVaultId: {
          vaultA: older,
          vaultB: newer,
        },
        migratedVaultIds: [],
      }),
    );

    const loaded = await loadSpacedRepetitionStore(profilePath);
    const state = loaded.byVaultId.__profile__?.userStateById.u1;

    expect(loaded.byVaultId.__profile__?.users).toHaveLength(1);
    expect(state?.cardStates.cardA?.boxCanonical).toBe(2);
    expect(state?.cardStates.cardA?.attempts).toBe(1);
    expect(state?.cardStates.cardB?.attempts).toBe(1);
    expect(state?.completedPerDay["2024-01-01"]).toBe(5);
  });

  it("does not reload deleted SR users from archived progress files", async () => {
    const profilePath = "/profiles/sr-delete";
    await saveSpacedRepetitionStore(profilePath, {
      schemaVersion: 2,
      byVaultId: {
        __profile__: {
          users: [
            { id: "u1", name: "User 1", createdAt: "2024-01-01" },
            { id: "u2", name: "User 2", createdAt: "2024-01-01" },
          ],
          userStateById: {
            u1: {
              cardStates: {},
              completedPerDay: {},
              lastLoadedAt: null,
            },
            u2: {
              cardStates: { cardB: srProgress(1, 1, null) },
              completedPerDay: {},
              lastLoadedAt: null,
            },
          },
          lastActiveUserId: "u1",
        },
      },
      migratedVaultIds: [],
    });

    await saveSpacedRepetitionStore(profilePath, {
      schemaVersion: 2,
      byVaultId: { __profile__: buildSrStorage("u1") },
      migratedVaultIds: [],
    });

    const loaded = await loadSpacedRepetitionStore(profilePath);
    const archivedU2Progress = Array.from(files.keys()).some((path) =>
      path.startsWith(
        `${profilePath}/spaced-repetition/users/u2/progress.deleted.`,
      ),
    );

    expect(loaded.byVaultId.__profile__?.users.map((user) => user.id)).toEqual([
      "u1",
    ]);
    expect(files.has(getSrProgressPath(profilePath, "u2"))).toBe(false);
    expect(archivedU2Progress).toBe(true);
  });

  it("does not resurrect deleted SR users from an already migrated legacy file", async () => {
    const profilePath = "/profiles/sr-delete-legacy";
    files.set(
      `${profilePath}/spaced-repetition.json`,
      JSON.stringify({
        schemaVersion: 1,
        byVaultId: {
          oldVault: {
            users: [
              { id: "u1", name: "User 1", createdAt: "2024-01-01" },
              { id: "u2", name: "User 2", createdAt: "2024-01-01" },
            ],
            userStateById: {
              u1: {
                cardStates: {},
                completedPerDay: {},
                lastLoadedAt: null,
              },
              u2: {
                cardStates: { cardB: srProgress(1, 1, null) },
                completedPerDay: {},
                lastLoadedAt: null,
              },
            },
            lastActiveUserId: "u2",
          },
        },
        migratedVaultIds: [],
      }),
    );

    await loadSpacedRepetitionStore(profilePath);
    await saveSpacedRepetitionStore(profilePath, {
      schemaVersion: 2,
      byVaultId: { __profile__: buildSrStorage("u1") },
      migratedVaultIds: [],
    });

    const loaded = await loadSpacedRepetitionStore(profilePath);

    expect(loaded.byVaultId.__profile__?.users.map((user) => user.id)).toEqual([
      "u1",
    ]);
  });
});

describe("exam run markdown storage", () => {
  it("writes a markdown file for new runs", async () => {
    const profileRootPath = "/profiles/exams";
    const run = buildRun("run-1");

    const filePath = await appendExamRunStore(profileRootPath, run);

    expect(filePath).toBeTruthy();
    const contents = files.get(filePath ?? "") ?? "";
    expect(contents).toContain('id: "run-1"');
    expect(contents).toContain('score: "10/20"');
    expect(contents).toContain("status: 5");
    expect(directories.has(getExamRunsDir(profileRootPath))).toBe(true);
  });

  it("loads runs from markdown files", async () => {
    const profileRootPath = "/profiles/exams";
    const examRunsDir = getExamRunsDir(profileRootPath);
    directories.add(examRunsDir);
    const runPath = `${examRunsDir}/user_2024-01-01T10-10-00_run-run-1.md`;
    files.set(
      runPath,
      [
        "---",
        "date: 2024-01-01T10:10:00.000Z",
        "user: \"User\"",
        "exam_file: \"exam.md\"",
        "score: \"10/20\"",
        "percent: 50",
        "status: 5",
        "duration: \"00:10:00\"",
        "id: \"run-1\"",
        "---",
        "",
      ].join("\n"),
    );

    const store = await loadExamRunStore(profileRootPath);

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.id).toBe("run-1");
    expect(store.runs[0]?.filePath).toBe(runPath);
    expect(store.runs[0]?.maxPoints).toBe(20);
    expect(store.runs[0]?.achievedPoints).toBe(10);
    expect(store.runs[0]?.statusValue).toBe(5);
  });

  it("deletes exam run markdown files by path", async () => {
    const profileRootPath = "/profiles/exams";
    const examRunsDir = getExamRunsDir(profileRootPath);
    directories.add(examRunsDir);
    const runPath = `${examRunsDir}/user_2024-01-01T10-10-00_run-run-1.md`;
    files.set(
      runPath,
      [
        "---",
        "date: 2024-01-01T10:10:00.000Z",
        "user: \"User\"",
        "exam_file: \"exam.md\"",
        "score: \"10/20\"",
        "percent: 50",
        "status: 5",
        "duration: \"00:10:00\"",
        "id: \"run-1\"",
        "---",
        "",
      ].join("\n"),
    );

    const success = await deleteExamRunStoreEntry(profileRootPath, "run-1", runPath);

    expect(success).toBe(true);
    expect(files.has(runPath)).toBe(false);
  });
});
