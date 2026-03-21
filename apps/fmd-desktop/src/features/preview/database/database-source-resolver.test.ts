import { describe, expect, it } from "vitest";
import { resolveDatabaseSourceFiles } from "./database-source-resolver";

const vaultFiles = [
  { path: "/vault/A/one.md", relative_path: "A/one.md" },
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
});
