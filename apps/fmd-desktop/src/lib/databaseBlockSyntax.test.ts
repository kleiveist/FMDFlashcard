import { describe, expect, it } from "vitest";
import {
  extractDatabaseBlockLineRanges,
  isDatabaseBlockMarkerLine,
  maskDatabaseBlockLines,
} from "./databaseBlockSyntax";

describe("databaseBlockSyntax", () => {
  it("detects standalone :::: marker lines", () => {
    expect(isDatabaseBlockMarkerLine("::::")).toBe(true);
    expect(isDatabaseBlockMarkerLine("  ::::  ")).toBe(true);
    expect(isDatabaseBlockMarkerLine("::::x")).toBe(false);
  });

  it("extracts closed and trailing unclosed ranges", () => {
    const lines = ["text", "::::", "a", "::::", "tail", "::::", "b"];
    const ranges = extractDatabaseBlockLineRanges(lines);
    expect(ranges).toEqual([
      { startLine: 1, endLine: 3 },
      { startLine: 5, endLine: 6 },
    ]);
  });

  it("masks full database ranges for parser isolation", () => {
    const lines = ["before", "::::", "#card", "#endcard", "::::", "after"];
    const masked = maskDatabaseBlockLines(lines);
    expect(masked).toEqual(["before", "", "", "", "", "after"]);
  });
});
