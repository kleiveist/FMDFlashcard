import { describe, expect, it, vi } from "vitest";
import {
  loadFormulaHistoryFiles,
  normalizeFormulaHistoryFiles,
  resolveFormulaHistoryFolderPath,
} from "./formula-history-source";

describe("formula-history-source", () => {
  it("resolves vault history folder path", () => {
    expect(resolveFormulaHistoryFolderPath("/vault")).toBe("/vault/.profile/exam-runs");
    expect(resolveFormulaHistoryFolderPath(null)).toBeNull();
  });

  it("normalizes and deduplicates markdown history files", () => {
    const files = normalizeFormulaHistoryFiles("/vault/.profile/exam-runs", [
      "/vault/.profile/exam-runs/2026/run-a.md",
      "/vault/.profile/exam-runs/2026/run-a.md",
      "/vault/.profile/exam-runs/run-b.md",
      "/vault/.profile/exam-runs/readme.txt",
    ]);

    expect(files).toEqual([
      {
        path: "/vault/.profile/exam-runs/2026/run-a.md",
        relativePath: ".profile/exam-runs/2026/run-a.md",
      },
      {
        path: "/vault/.profile/exam-runs/run-b.md",
        relativePath: ".profile/exam-runs/run-b.md",
      },
    ]);
  });

  it("returns stable warning and empty results when list_files fails", async () => {
    const listFiles = vi.fn(async () => {
      throw new Error("not found");
    });

    const result = await loadFormulaHistoryFiles({
      vaultPath: "/vault",
      listFiles,
    });

    expect(result.historyFolderPath).toBe("/vault/.profile/exam-runs");
    expect(result.files).toEqual([]);
    expect(result.warning).toContain("not found");
  });
});
