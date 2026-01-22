/**
 * @file apps/fmd-desktop/src/features/user-vault/storage.test.ts
 *
 * Zweck:
 * - Tests fuer User-Vault Persistenz (Profile Settings + Exam Runs).
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import { appendExamRunStore, loadProfileSettings } from "./storage";
import type { ExamRun } from "../../lib/examRuns";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);
const files = new Map<string, string>();

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
    throw new Error(`Unknown command: ${String(command)}`);
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
