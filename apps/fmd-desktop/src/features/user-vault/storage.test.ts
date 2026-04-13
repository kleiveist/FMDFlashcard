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

const getExamRunsDir = (profilePath: string) =>
  `${profilePath.replace(/\\/g, "/")}/exam-runs`;

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

describe("exam run markdown storage", () => {
  it("writes a markdown file for new runs", async () => {
    const profilePath = "/profiles/exams";
    const run = buildRun("run-1");

    const filePath = await appendExamRunStore(profilePath, run);

    expect(filePath).toBeTruthy();
    const contents = files.get(filePath ?? "") ?? "";
    expect(contents).toContain('id: "run-1"');
    expect(contents).toContain('score: "10/20"');
    expect(contents).toContain("status: 5");
    expect(directories.has(getExamRunsDir(profilePath))).toBe(true);
  });

  it("loads runs from markdown files", async () => {
    const profilePath = "/profiles/exams";
    const examRunsDir = getExamRunsDir(profilePath);
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

    const store = await loadExamRunStore(profilePath);

    expect(store.runs).toHaveLength(1);
    expect(store.runs[0]?.id).toBe("run-1");
    expect(store.runs[0]?.filePath).toBe(runPath);
    expect(store.runs[0]?.maxPoints).toBe(20);
    expect(store.runs[0]?.achievedPoints).toBe(10);
    expect(store.runs[0]?.statusValue).toBe(5);
  });

  it("deletes exam run markdown files by path", async () => {
    const profilePath = "/profiles/exams";
    const examRunsDir = getExamRunsDir(profilePath);
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

    const success = await deleteExamRunStoreEntry(profilePath, "run-1", runPath);

    expect(success).toBe(true);
    expect(files.has(runPath)).toBe(false);
  });
});
