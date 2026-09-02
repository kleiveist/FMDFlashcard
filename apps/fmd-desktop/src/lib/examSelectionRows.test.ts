/**
 * @file apps/fmd-desktop/src/lib/examSelectionRows.test.ts
 */

import { describe, expect, it } from "vitest";
import {
  areExamSelectionRowsEqual,
  buildExamSelectionRowsFromPaths,
  flattenExamSelectionRows,
  moveExamSelectionPathBeforeTarget,
  normalizeExamSelectionRows,
  placeExamSelectionPath,
  toggleExamSelectionPath,
} from "./examSelectionRows";

describe("examSelectionRows", () => {
  it("keeps flat paths in one row", () => {
    const rows = buildExamSelectionRowsFromPaths(["a", "b", "c", "d", "e"]);
    expect(rows).toEqual([["a", "b", "c", "d", "e"]]);
  });

  it("normalizes rows by removing duplicates, invalid paths, and extra rows", () => {
    const rows = normalizeExamSelectionRows([["a", "b", "a"], ["x", "c"], ["d"], ["e", "f"]], {
      validPaths: new Set(["a", "b", "c", "d", "e", "f"]),
    });
    expect(rows).toEqual([["a", "b"], ["c"], ["d", "e", "f"]]);
  });

  it("toggles path add/remove while keeping add-on-last-row behavior", () => {
    const added = toggleExamSelectionPath([["a", "b", "c"]], "d");
    expect(added).toEqual([["a", "b", "c", "d"]]);

    const removed = toggleExamSelectionPath(added, "b");
    expect(removed).toEqual([["a", "c", "d"]]);
  });

  it("places a path into a row/slot without row-capacity chunking", () => {
    const rows = [
      ["a", "b", "c"],
      ["d", "e"],
    ];
    const placed = placeExamSelectionPath(rows, "e", { rowIndex: 0, slotIndex: 1 });
    expect(placed).toEqual([["a", "e", "b", "c"], ["d"]]);
  });

  it("creates new row when placed after all existing rows", () => {
    const rows = [["a", "b"], ["c"]];
    const placed = placeExamSelectionPath(rows, "a", { rowIndex: 2, slotIndex: 0 });
    expect(placed).toEqual([["b"], ["c"], ["a"]]);
  });

  it("moves source path before target path in row model", () => {
    const rows = [
      ["a", "b", "c"],
      ["d", "e"],
    ];
    const moved = moveExamSelectionPathBeforeTarget(rows, "e", "b");
    expect(moved).toEqual([["a", "e", "b", "c"], ["d"]]);
  });

  it("keeps before-target move stable within the same row", () => {
    const rows = [["a", "b", "c"]];
    const moved = moveExamSelectionPathBeforeTarget(rows, "b", "c");
    expect(moved).toEqual([["a", "b", "c"]]);
  });

  it("places source into same-row slot deterministically", () => {
    const rows = [["a", "b", "c"]];
    const movedToEnd = placeExamSelectionPath(rows, "b", {
      rowIndex: 0,
      slotIndex: 3,
    });
    expect(movedToEnd).toEqual([["a", "c", "b"]]);
  });

  it("blocks placement that targets row index beyond max rows", () => {
    const rows = [["a"], ["b"], ["c"]];
    const unchanged = placeExamSelectionPath(rows, "a", {
      rowIndex: 3,
      slotIndex: 0,
    });
    expect(unchanged).toEqual([["a"], ["b"], ["c"]]);
  });

  it("keeps deterministic flatten order top-to-bottom and left-to-right", () => {
    const rows = [["a", "b"], ["c"], ["d", "e", "f"]];
    expect(flattenExamSelectionRows(rows)).toEqual(["a", "b", "c", "d", "e", "f"]);
  });

  it("compares rows deeply", () => {
    expect(areExamSelectionRowsEqual([["a"], ["b", "c"]], [["a"], ["b", "c"]])).toBe(true);
    expect(areExamSelectionRowsEqual([["a"], ["b"]], [["a", "b"]])).toBe(false);
  });
});
