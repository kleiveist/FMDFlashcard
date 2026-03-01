import { describe, expect, it } from "vitest";
import {
  deleteTableColumns,
  deleteTableRows,
  findTableLineIndices,
  insertTableColumn,
  insertTableRow,
  moveTableColumn,
  moveTableRow,
  normalizeColumnSelectionAfterMutation,
  normalizeMarkdownPipeTables,
  normalizeRowSelectionAfterMutation,
  parseMarkdownPipeTable,
  repairMarkdownPipeTable,
  serializeMarkdownPipeTable,
  splitMarkdownBlocks,
} from "./markdownTables";

describe("markdownTables", () => {
  it("parses and serializes markdown pipe tables with escaped pipes", () => {
    const raw = [
      "| Name | Value |",
      "| :--- | ---: |",
      "| Left \\| Right | 1 |",
    ].join("\n");

    const parsed = parseMarkdownPipeTable(raw);
    expect(parsed).toBeTruthy();
    expect(parsed?.separator).toEqual([":---", "---:"]);
    expect(parsed?.bodyRows[0]?.[0]?.raw).toBe("Left \\| Right");
    expect(serializeMarkdownPipeTable(parsed!)).toBe(raw);
  });

  it("repairs missing boundary pipes and uneven rows", () => {
    const repaired = repairMarkdownPipeTable([
      "Name | Value",
      "--- | ---",
      "One",
      "Two | 2 | extra",
    ].join("\n"));

    expect(repaired.ok).toBe(true);
    if (!repaired.ok) {
      return;
    }
    expect(repaired.markdown).toBe(
      [
        "| Name | Value |  |",
        "| --- | --- | --- |",
        "| One |  |  |",
        "| Two | 2 | extra |",
      ].join("\n"),
    );
  });

  it("normalizes markdown tables outside code fences", () => {
    const markdown = [
      "Intro",
      "A | B",
      "--- | ---",
      "1 | 2",
      "```md",
      "C | D",
      "--- | ---",
      "```",
      "Outro",
    ].join("\n");

    expect(normalizeMarkdownPipeTables(markdown)).toBe(
      [
        "Intro",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "```md",
        "C | D",
        "--- | ---",
        "```",
        "",
        "Outro",
      ].join("\n"),
    );
  });

  it("finds and splits table blocks with relaxed boundary parsing", () => {
    const markdown = [
      "Before",
      "A | B",
      "--- | ---",
      "1 | 2",
      "",
      "After",
    ].join("\n");

    expect([...findTableLineIndices(markdown.split("\n"))]).toEqual([1, 2, 3]);
    expect(splitMarkdownBlocks(markdown)).toEqual([
      { type: "text", text: "Before", startLine: 0, endLine: 0 },
      {
        type: "table",
        header: ["A", "B"],
        separator: ["---", "---"],
        rows: [["1", "2"]],
        startLine: 1,
        endLine: 3,
      },
      { type: "text", text: "\nAfter", startLine: 4, endLine: 5 },
    ]);
  });

  it("supports row and column structure mutations", () => {
    const parsed = parseMarkdownPipeTable([
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "| 3 | 4 |",
    ].join("\n"));
    expect(parsed).toBeTruthy();
    if (!parsed) {
      return;
    }

    const insertedRow = insertTableRow(parsed, 1);
    expect(insertedRow.bodyRows).toHaveLength(3);
    expect(insertedRow.bodyRows[1]?.map((cell) => cell.raw)).toEqual(["", ""]);

    const movedRow = moveTableRow(insertedRow, 2, 0);
    expect(movedRow.bodyRows[0]?.map((cell) => cell.raw)).toEqual(["3", "4"]);

    const insertedColumn = insertTableColumn(movedRow, 1);
    expect(insertedColumn.columnCount).toBe(3);
    expect(insertedColumn.separator).toEqual(["---", "---", "---"]);

    const movedColumn = moveTableColumn(insertedColumn, 2, 0);
    expect(movedColumn.header.map((cell) => cell.raw)).toEqual(["B", "A", ""]);

    const deletedRow = deleteTableRows(movedColumn, [1]);
    expect(deletedRow.bodyRows).toHaveLength(2);

    const deletedColumn = deleteTableColumns(deletedRow, [2]);
    expect(deletedColumn.columnCount).toBe(2);
  });

  it("normalizes row and column selections after delete and move mutations", () => {
    expect(
      normalizeRowSelectionAfterMutation(
        { anchorIndex: 2, selectedIndices: [1, 2] },
        { kind: "delete", removedIndices: [1] },
        2,
      ),
    ).toEqual({ anchorIndex: 1, selectedIndices: [1] });

    expect(
      normalizeColumnSelectionAfterMutation(
        { anchorIndex: 1, selectedIndices: [1, 2] },
        { kind: "move", fromIndex: 2, toIndex: 0 },
        3,
      ),
    ).toEqual({ anchorIndex: 2, selectedIndices: [0, 2] });
  });
});
