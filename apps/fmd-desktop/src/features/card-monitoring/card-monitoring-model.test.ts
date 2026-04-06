import { describe, expect, it } from "vitest";
import { parseFlashcardEntries } from "../../lib/flashcards";
import {
  applyCardWrapperRemovals,
  buildCardMonitoringEntries,
  buildCardMonitoringGroups,
  buildCardMonitoringSavePlan,
  filterCardMonitoringEntries,
  sortCardMonitoringEntries,
  type CardMonitoringScannedFile,
} from "./card-monitoring-model";

const buildScan = (path: string, relativePath: string, markdown: string): CardMonitoringScannedFile => ({
  sourcePath: path,
  relativePath,
  parsedEntries: parseFlashcardEntries(markdown),
});

describe("card-monitoring-model", () => {
  it("builds card entries with prompt snippets and per-file counts", () => {
    const scanned = [
      buildScan(
        "/vault/a.md",
        "folder/a.md",
        [
          "#card",
          "First question text",
          "Answer: value",
          "#endcard",
          "",
          "#card",
          "Second question",
          "Answer: value",
          "#endcard",
        ].join("\n"),
      ),
      buildScan(
        "/vault/root.md",
        "root.md",
        ["#card", "Root question", "Answer: value", "#endcard"].join("\n"),
      ),
    ];

    const entries = buildCardMonitoringEntries(scanned);

    expect(entries).toHaveLength(3);
    expect(entries[0]?.relativePath).toBe("folder/a.md");
    expect(entries[0]?.folderPath).toBe("folder");
    expect(entries[0]?.fileName).toBe("a.md");
    expect(entries[0]?.fileCardCount).toBe(2);
    expect(entries[0]?.cardIndexInFile).toBe(1);
    expect(entries[0]?.prompt).toContain("First question");
    expect(entries[2]?.folderPath).toBe("");
    expect(entries[2]?.fileCardCount).toBe(1);
  });

  it("filters and sorts entries", () => {
    const entries = buildCardMonitoringEntries([
      buildScan(
        "/vault/alpha.md",
        "one/alpha.md",
        ["#card", "Alpha prompt", "Answer: value", "#endcard"].join("\n"),
      ),
      buildScan(
        "/vault/beta.md",
        "one/beta.md",
        [
          "#card",
          "Beta one",
          "Answer: value",
          "#endcard",
          "#card",
          "Beta two",
          "Answer: value",
          "#endcard",
        ].join("\n"),
      ),
    ]);

    const filtered = filterCardMonitoringEntries(entries, {
      folderPath: "one",
      filePath: "",
      cardType: "all",
      query: "beta",
    });

    expect(filtered).toHaveLength(2);

    const sorted = sortCardMonitoringEntries(filtered, {
      sortBy: "cards-per-file",
      direction: "desc",
    });

    expect(sorted[0]?.fileName).toBe("beta.md");

    const grouped = buildCardMonitoringGroups(sorted, {
      sortBy: "cards-per-file",
      direction: "desc",
    });

    expect(grouped).toHaveLength(1);
    expect(grouped[0]?.files[0]?.fileName).toBe("beta.md");
    expect(grouped[0]?.files[0]?.entries).toHaveLength(2);
  });

  it("builds a per-file save plan with descending ranges", () => {
    const plan = buildCardMonitoringSavePlan([
      {
        id: "a",
        sourcePath: "/vault/a.md",
        sourceRange: { startLine: 5, endLine: 9 },
      },
      {
        id: "b",
        sourcePath: "/vault/a.md",
        sourceRange: { startLine: 1, endLine: 4 },
      },
      {
        id: "dup",
        sourcePath: "/vault/a.md",
        sourceRange: { startLine: 5, endLine: 9 },
      },
      {
        id: "c",
        sourcePath: "/vault/z.md",
        sourceRange: { startLine: 2, endLine: 3 },
      },
    ]);

    expect(plan).toHaveLength(2);
    expect(plan[0]?.sourcePath).toBe("/vault/a.md");
    expect(plan[0]?.ranges).toEqual([
      { startLine: 5, endLine: 9 },
      { startLine: 1, endLine: 4 },
    ]);
  });

  it("removes card wrappers safely using descending line ranges", () => {
    const source = [
      "Before",
      "#card",
      "Question 1",
      "-a answer",
      "#endcard",
      "Middle",
      "#card",
      "Question 2",
      "-a answer",
      "#endcard",
      "After",
    ].join("\n");

    const result = applyCardWrapperRemovals(source, [
      { startLine: 6, endLine: 9 },
      { startLine: 1, endLine: 4 },
    ]);

    expect(result.changed).toBe(true);
    expect(result.removedCount).toBe(2);
    expect(result.skippedCount).toBe(0);
    expect(result.nextContents).toBe(
      ["Before", "Question 1", "-a answer", "Middle", "Question 2", "-a answer", "After"].join("\n"),
    );
  });
});
