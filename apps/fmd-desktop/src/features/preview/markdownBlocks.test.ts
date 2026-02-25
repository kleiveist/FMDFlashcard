import { describe, expect, it } from "vitest";
import {
  normalizeHelpBlockSource,
  normalizeOrderedListBlockSource,
  parseMarkdownBlocks,
} from "./markdownBlocks";

describe("markdownBlocks", () => {
  it("parses headings, lists, tables and code fences as separate blocks", () => {
    const markdown = [
      "# Titel",
      "",
      "1) Eins",
      "7) Zwei",
      "",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "",
      "```ts",
      "const a = 1;",
      "```",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "heading",
      "blank",
      "ordered-list",
      "blank",
      "table",
      "blank",
      "code-fence",
    ]);
  });

  it("keeps non-table pipe lines as paragraphs", () => {
    const blocks = parseMarkdownBlocks("A | B\nNo separator");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("paragraph");
  });

  it("groups ordered list continuation lines into one block", () => {
    const markdown = ["1. Alpha", "   continuation", "2. Beta"].join("\n");
    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.kind).toBe("ordered-list");
    expect(blocks[0]?.raw).toContain("continuation");
  });

  it("treats #help ... #helpend as a single special block", () => {
    const markdown = [
      "Vorher",
      "#help",
      "# Testtitel",
      "1. Liste",
      "| A | B |",
      "| --- | --- |",
      "| 1 | 2 |",
      "#helpend",
      "Nachher",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "paragraph",
      "help-block",
      "paragraph",
    ]);
    expect(blocks[1]?.raw).toBe(
      [
        "#help",
        "# Testtitel",
        "1. Liste",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "#helpend",
      ].join("\n"),
    );
  });

  it("splits lists around an indented help block and keeps help as its own block", () => {
    const markdown = [
      "1. Erste Zeile",
      "   Fortsetzung",
      "   #help",
      "   1. bleibt im help-block roh",
      "   #helpend   ",
      "2. Zweite Zeile",
    ].join("\n");

    const blocks = parseMarkdownBlocks(markdown);
    expect(blocks.map((block) => block.kind)).toEqual([
      "ordered-list",
      "help-block",
      "ordered-list",
    ]);
    expect(blocks[0]?.raw).toBe(["1. Erste Zeile", "   Fortsetzung"].join("\n"));
    expect(blocks[1]?.raw).toBe(
      [
        "   #help",
        "   1. bleibt im help-block roh",
        "   #helpend   ",
      ].join("\n"),
    );
    expect(blocks[2]?.raw).toBe("2. Zweite Zeile");
  });
});

describe("normalizeOrderedListBlockSource", () => {
  it("renumbers ordered lists while preserving the first delimiter style", () => {
    const input = ["9) Erste", "1) Zweite", "12.) Dritte"].join("\n");
    const normalized = normalizeOrderedListBlockSource(input);
    expect(normalized).toBe(["1) Erste", "2) Zweite", "3) Dritte"].join("\n"));
  });

  it("renumbers nested ordered list items per indentation level", () => {
    const input = [
      "7. Root",
      "   9. Child A",
      "   4. Child B",
      "8. Root 2",
    ].join("\n");
    const normalized = normalizeOrderedListBlockSource(input);
    expect(normalized).toBe(
      [
        "1. Root",
        "   1. Child A",
        "   2. Child B",
        "2. Root 2",
      ].join("\n"),
    );
  });
});

describe("normalizeHelpBlockSource", () => {
  it("forces #helpend to be left-aligned without spaces or tabs", () => {
    const input = [
      "#help",
      "Inhalt",
      "   #helpend   ",
      "\t#helpend\t",
    ].join("\n");

    const normalized = normalizeHelpBlockSource(input);
    expect(normalized).toBe(
      [
        "#help",
        "Inhalt",
        "#helpend",
        "#helpend",
      ].join("\n"),
    );
  });

  it("removes blank lines directly before #helpend", () => {
    const input = [
      "#help",
      "Hint Zeile",
      "",
      "   ",
      "\t",
      "  #helpend  ",
    ].join("\n");

    const normalized = normalizeHelpBlockSource(input);
    expect(normalized).toBe(
      [
        "#help",
        "Hint Zeile",
        "#helpend",
      ].join("\n"),
    );
  });
});
