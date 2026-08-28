import { describe, expect, it } from "vitest";
import { resolveDatabaseSourceFiles } from "./database-source-resolver";

const vaultFiles = [
  {
    path: "/vault/A/one.md",
    relative_path: "A/one.md",
    created_at: 1000,
    last_modified: 2000,
    size_bytes: 300,
  },
  { path: "/vault/A/two.md", relative_path: "A/two.md" },
  { path: "/vault/A/image.png", relative_path: "A/image.png" },
  { path: "/vault/B/three.md", relative_path: "B/three.md" },
  { path: "/vault/B/Sub/four.md", relative_path: "B/Sub/four.md" },
];

describe("database-source-resolver", () => {
  it("resolves current-folder based on sourceRelativePath", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "current-folder" },
      { vaultFiles, sourceRelativePath: "A/current.md" },
    );

    expect(result.warning).toBeNull();
    expect(result.files.map((file) => file.relativePath)).toEqual(["A/one.md", "A/two.md"]);
    expect(result.files[0]).toMatchObject({
      created_at: 1000,
      last_modified: 2000,
      size_bytes: 300,
    });
  });

  it("resolves explicit-folder recursively", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "explicit-folder", path: "B" },
      { vaultFiles, sourceRelativePath: null },
    );

    expect(result.warning).toBeNull();
    expect(result.files.map((file) => file.relativePath)).toEqual(["B/three.md", "B/Sub/four.md"]);
  });

  it("resolves multi-folder union", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "multi-folder", paths: ["A", "B/Sub"] },
      { vaultFiles, sourceRelativePath: null },
    );

    expect(result.warning).toBeNull();
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "A/one.md",
      "A/two.md",
      "B/Sub/four.md",
    ]);
  });

  it("adds history files to multi-folder source when includeHistory is enabled", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "multi-folder", paths: ["A"], includeHistory: true },
      {
        vaultFiles,
        sourceRelativePath: null,
        historyFiles: [
          { path: "/vault/A/two.md", relativePath: "A/two.md" },
          { path: "/profile/exam-runs/history-1.md", relativePath: "history-1.md" },
        ],
        historyWarning: null,
      },
    );

    expect(result.warning).toBeNull();
    expect(result.files.map((file) => file.path)).toEqual([
      "/vault/A/one.md",
      "/vault/A/two.md",
      "/profile/exam-runs/history-1.md",
    ]);
  });

  it("returns history-only files for multi-folder when includeHistory is enabled without folders", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "multi-folder", paths: [], includeHistory: true },
      {
        vaultFiles,
        sourceRelativePath: null,
        historyFiles: [
          { path: "/profile/exam-runs/history-1.md", relativePath: "history-1.md" },
          { path: "/profile/exam-runs/history-2.md", relativePath: "history-2.md" },
        ],
        historyWarning: null,
      },
    );

    expect(result.warning).toBeNull();
    expect(result.files).toEqual([
      { path: "/profile/exam-runs/history-1.md", relativePath: "history-1.md" },
      { path: "/profile/exam-runs/history-2.md", relativePath: "history-2.md" },
    ]);
  });

  it("forwards history warnings for multi-folder when includeHistory is enabled", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "multi-folder", includeHistory: true, paths: ["A"] },
      {
        vaultFiles,
        sourceRelativePath: null,
        historyFiles: [],
        historyWarning: "History folder unavailable (no vault path).",
      },
    );

    expect(result.warning).toBe("History folder unavailable (no vault path).");
    expect(result.files.map((file) => file.relativePath)).toEqual([
      "A/one.md",
      "A/two.md",
    ]);
  });

  it("returns warning stubs for tag-query and manual-query in phase 1", () => {
    const tagResult = resolveDatabaseSourceFiles(
      { type: "tag-query", tags: ["Exam"] },
      { vaultFiles, sourceRelativePath: null },
    );
    const manualResult = resolveDatabaseSourceFiles(
      { type: "manual-query", query: "tags includes Exam" },
      { vaultFiles, sourceRelativePath: null },
    );

    expect(tagResult.files).toEqual([]);
    expect(tagResult.warning).toContain("phase 1");
    expect(manualResult.files).toEqual([]);
    expect(manualResult.warning).toContain("phase 1");
  });

  it("resolves history-folder from provided history files", () => {
    const result = resolveDatabaseSourceFiles(
      { type: "history-folder" },
      {
        vaultFiles,
        sourceRelativePath: null,
        historyFiles: [
          { path: "/profile/exam-runs/a.md", relativePath: "a.md" },
        ],
        historyWarning: null,
      },
    );

    expect(result.warning).toBeNull();
    expect(result.files).toEqual([{ path: "/profile/exam-runs/a.md", relativePath: "a.md" }]);
  });
});
