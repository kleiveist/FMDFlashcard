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
  ensureProfileRoot,
  loadProfileSettings,
} from "./storage";
import type { ExamRun } from "../../lib/examRuns";

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

const getExamRunsPath = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/exam-runs.json`;

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
    throw new Error(`Unknown command: ${String(command)}`);
  });
});

describe("ensureProfileRoot", () => {
  it("creates a missing profile root and initializes user-vault.json", async () => {
    const profileRoot = "/vault/profile";

    const result = await ensureProfileRoot(profileRoot);

    expect(result).toEqual({ ok: true, reason: "" });
    expect(directories.has("/vault/profile")).toBe(true);
    const meta = JSON.parse(files.get("/vault/profile/user-vault.json") ?? "{}");
    expect(meta.schemaVersion).toBe(1);
    expect(meta.activeProfileId).toBeNull();
  });

  it("rewrites invalid user-vault.json metadata", async () => {
    const profileRoot = "/vault/profile";
    directories.add(profileRoot);
    files.set("/vault/profile/user-vault.json", "{broken");

    const result = await ensureProfileRoot(profileRoot);

    expect(result).toEqual({ ok: true, reason: "" });
    const meta = JSON.parse(files.get("/vault/profile/user-vault.json") ?? "{}");
    expect(meta.schemaVersion).toBe(1);
    expect(meta.activeProfileId).toBeNull();
  });

  it("returns an error when the profile root points to a file", async () => {
    files.set("/vault/profile", "{}");

    const result = await ensureProfileRoot("/vault/profile");

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Profile root is not a directory.");
  });
});

describe("loadProfileSettings", () => {
  it("migrates profile settings to include schemaVersion", async () => {
    const profilePath = "/profiles/alpha";
    const profileFile = getProfileFilePath(profilePath);
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
    const written = JSON.parse(files.get(profileFile) ?? "{}");
    expect(written.schemaVersion).toBe(1);
    expect(written.id).toBe("alpha");
  });
});

describe("appendExamRunStore", () => {
  it("appends runs without overwriting existing history", async () => {
    const profilePath = "/profiles/exams";
    const examRunsPath = getExamRunsPath(profilePath);
    const firstRun = buildRun("run-1");
    const secondRun = buildRun("run-2");

    files.set(
      examRunsPath,
      JSON.stringify({
        schemaVersion: 1,
        runs: [firstRun],
        migratedFromAppData: false,
      }),
    );

    await appendExamRunStore(profilePath, secondRun);

    const stored = JSON.parse(files.get(examRunsPath) ?? "{}");
    expect(stored.runs).toHaveLength(2);
    expect(stored.runs[0].id).toBe("run-1");
    expect(stored.runs[1].id).toBe("run-2");
  });

  it("creates a new store when exam-runs.json is missing", async () => {
    const profilePath = "/profiles/missing";
    const examRunsPath = getExamRunsPath(profilePath);
    const run = buildRun("run-missing");

    await appendExamRunStore(profilePath, run);

    const stored = JSON.parse(files.get(examRunsPath) ?? "{}");
    expect(stored.runs).toHaveLength(1);
    expect(stored.runs[0].id).toBe("run-missing");
  });

  it("recovers from corrupt JSON by archiving and creating a fresh store", async () => {
    const profilePath = "/profiles/corrupt";
    const examRunsPath = getExamRunsPath(profilePath);
    const run = buildRun("run-corrupt");

    files.set(examRunsPath, "{not json");

    await appendExamRunStore(profilePath, run);

    const stored = JSON.parse(files.get(examRunsPath) ?? "{}");
    expect(stored.runs).toHaveLength(1);
    expect(stored.runs[0].id).toBe("run-corrupt");

    const corruptBackup = Array.from(files.keys()).find((key) =>
      key.includes(".corrupt."),
    );
    expect(corruptBackup).toBeTruthy();
  });
});
